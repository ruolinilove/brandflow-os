alter table public.brandflow_user_access
add column role text not null default 'member'
check (role in ('super_admin', 'member'));

update public.brandflow_user_access
set role = 'super_admin'
where user_id = (
  select id from auth.users order by created_at asc limit 1
);

create or replace function public.is_brandflow_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.brandflow_user_access
    where user_id = auth.uid() and role = 'super_admin'
  );
$$;

create or replace function public.get_brandflow_access_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.brandflow_user_access
  where user_id = auth.uid();
$$;

revoke all on function public.is_brandflow_super_admin() from public, anon;
revoke all on function public.get_brandflow_access_role() from public, anon;
grant execute on function public.is_brandflow_super_admin() to authenticated;
grant execute on function public.get_brandflow_access_role() to authenticated;

drop policy if exists "invites_creator_read" on public.brandflow_invites;
create policy "invites_super_admin_read"
on public.brandflow_invites for select to authenticated
using (public.is_brandflow_super_admin());

create or replace function public.create_brandflow_invite(
  valid_hours integer default 24,
  allowed_uses integer default 1
)
returns table (code text, invite_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  candidate text;
  candidate_hash text;
  new_id uuid;
  expiry timestamptz;
begin
  if not public.is_brandflow_super_admin() then
    raise exception 'Only the BrandFlow super administrator can create invitations';
  end if;
  if valid_hours not between 1 and 168 then
    raise exception 'Invitation validity must be between 1 and 168 hours';
  end if;
  if allowed_uses not between 1 and 20 then
    raise exception 'Invitation uses must be between 1 and 20';
  end if;

  expiry := now() + make_interval(hours => valid_hours);
  loop
    candidate := lpad((floor(random() * 1000000))::integer::text, 6, '0');
    candidate_hash := encode(extensions.digest(candidate, 'sha256'), 'hex');
    begin
      insert into public.brandflow_invites (code_hash, created_by, expires_at, max_uses)
      values (candidate_hash, auth.uid(), expiry, allowed_uses)
      returning id into new_id;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  return query select candidate, new_id, expiry;
end;
$$;

create or replace function public.revoke_brandflow_invite(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_brandflow_super_admin() then
    raise exception 'Only the BrandFlow super administrator can revoke invitations';
  end if;
  update public.brandflow_invites
  set revoked_at = now()
  where id = target_id and revoked_at is null;
end;
$$;

create or replace function public.authorize_brandflow_signup()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  supplied_code text := new.raw_user_meta_data ->> 'brandflow_invite_code';
  supplied_hash text;
  matched_invite public.brandflow_invites%rowtype;
begin
  lock table public.brandflow_user_access in share row exclusive mode;

  if not exists (select 1 from public.brandflow_user_access) then
    insert into public.brandflow_user_access (user_id, role)
    values (new.id, 'super_admin');
    return new;
  end if;

  if supplied_code is null or supplied_code !~ '^[0-9]{6}$' then
    raise exception 'A valid six-digit BrandFlow invitation code is required';
  end if;

  supplied_hash := encode(extensions.digest(supplied_code, 'sha256'), 'hex');
  select * into matched_invite
  from public.brandflow_invites
  where code_hash = supplied_hash
    and revoked_at is null
    and expires_at > now()
    and use_count < max_uses
  for update;

  if not found then
    raise exception 'BrandFlow invitation code is invalid, expired, or already used';
  end if;

  insert into public.brandflow_user_access (user_id, invited_by, role)
  values (new.id, matched_invite.created_by, 'member');

  update public.brandflow_invites
  set use_count = use_count + 1
  where id = matched_invite.id;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'brandflow_invite_code'
  where id = new.id;
  return new;
end;
$$;
