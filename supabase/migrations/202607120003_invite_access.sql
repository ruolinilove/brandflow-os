create extension if not exists pgcrypto with schema extensions;

create table public.brandflow_user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  approved_at timestamptz not null default now(),
  invited_by uuid references auth.users(id) on delete set null
);

create table public.brandflow_invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses between 1 and 20),
  use_count integer not null default 0 check (use_count >= 0),
  revoked_at timestamptz,
  check (expires_at > created_at)
);

alter table public.brandflow_user_access enable row level security;
alter table public.brandflow_invites enable row level security;

-- Existing users predate invite-only registration and remain authorized.
insert into public.brandflow_user_access (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.is_brandflow_authorized()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.brandflow_user_access
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_brandflow_authorized() from public, anon;
grant execute on function public.is_brandflow_authorized() to authenticated;

create policy "user_access_owner_read"
on public.brandflow_user_access for select to authenticated
using (user_id = auth.uid());

create policy "invites_creator_read"
on public.brandflow_invites for select to authenticated
using (created_by = auth.uid() and public.is_brandflow_authorized());

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
  if not public.is_brandflow_authorized() then
    raise exception 'Only authorized BrandFlow users can create invitations';
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
  if not public.is_brandflow_authorized() then
    raise exception 'Authorization required';
  end if;
  update public.brandflow_invites
  set revoked_at = now()
  where id = target_id and created_by = auth.uid() and revoked_at is null;
end;
$$;

revoke all on function public.create_brandflow_invite(integer, integer) from public, anon;
revoke all on function public.revoke_brandflow_invite(uuid) from public, anon;
grant execute on function public.create_brandflow_invite(integer, integer) to authenticated;
grant execute on function public.revoke_brandflow_invite(uuid) to authenticated;

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

  insert into public.brandflow_user_access (user_id, invited_by)
  values (new.id, matched_invite.created_by);

  update public.brandflow_invites
  set use_count = use_count + 1
  where id = matched_invite.id;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'brandflow_invite_code'
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists authorize_brandflow_signup on auth.users;
create trigger authorize_brandflow_signup
after insert on auth.users
for each row execute function public.authorize_brandflow_signup();

-- Add authorization to every existing owner policy.
drop policy if exists "profiles_owner_all" on public.profiles;
drop policy if exists "brands_owner_all" on public.brands;
drop policy if exists "projects_owner_all" on public.projects;
drop policy if exists "plans_owner_all" on public.plans;
drop policy if exists "contents_owner_all" on public.contents;
drop policy if exists "metric_entries_owner_all" on public.metric_entries;
drop policy if exists "assets_owner_all" on public.assets;
drop policy if exists "ideas_owner_all" on public.ideas;
drop policy if exists "garden_state_owner_all" on public.garden_state;
drop policy if exists "garden_plots_owner_all" on public.garden_plots;

create policy "profiles_owner_all" on public.profiles for all to authenticated using (id = auth.uid() and public.is_brandflow_authorized()) with check (id = auth.uid() and public.is_brandflow_authorized());
create policy "brands_owner_all" on public.brands for all to authenticated using (owner_id = auth.uid() and public.is_brandflow_authorized()) with check (owner_id = auth.uid() and public.is_brandflow_authorized());
create policy "projects_owner_all" on public.projects for all to authenticated using (owner_id = auth.uid() and public.is_brandflow_authorized()) with check (owner_id = auth.uid() and public.is_brandflow_authorized());
create policy "plans_owner_all" on public.plans for all to authenticated using (owner_id = auth.uid() and public.is_brandflow_authorized()) with check (owner_id = auth.uid() and public.is_brandflow_authorized());
create policy "contents_owner_all" on public.contents for all to authenticated using (owner_id = auth.uid() and public.is_brandflow_authorized()) with check (owner_id = auth.uid() and public.is_brandflow_authorized());
create policy "metric_entries_owner_all" on public.metric_entries for all to authenticated using (owner_id = auth.uid() and public.is_brandflow_authorized()) with check (owner_id = auth.uid() and public.is_brandflow_authorized());
create policy "assets_owner_all" on public.assets for all to authenticated using (owner_id = auth.uid() and public.is_brandflow_authorized()) with check (owner_id = auth.uid() and public.is_brandflow_authorized());
create policy "ideas_owner_all" on public.ideas for all to authenticated using (owner_id = auth.uid() and public.is_brandflow_authorized()) with check (owner_id = auth.uid() and public.is_brandflow_authorized());
create policy "garden_state_owner_all" on public.garden_state for all to authenticated using (owner_id = auth.uid() and public.is_brandflow_authorized()) with check (owner_id = auth.uid() and public.is_brandflow_authorized());
create policy "garden_plots_owner_all" on public.garden_plots for all to authenticated using (owner_id = auth.uid() and public.is_brandflow_authorized()) with check (owner_id = auth.uid() and public.is_brandflow_authorized());

drop policy if exists "asset_objects_owner_read" on storage.objects;
drop policy if exists "asset_objects_owner_insert" on storage.objects;
drop policy if exists "asset_objects_owner_update" on storage.objects;
drop policy if exists "asset_objects_owner_delete" on storage.objects;

create policy "asset_objects_owner_read" on storage.objects for select to authenticated
using (bucket_id = 'brandflow-assets' and (storage.foldername(name))[1] = auth.uid()::text and public.is_brandflow_authorized());
create policy "asset_objects_owner_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'brandflow-assets' and (storage.foldername(name))[1] = auth.uid()::text and public.is_brandflow_authorized());
create policy "asset_objects_owner_update" on storage.objects for update to authenticated
using (bucket_id = 'brandflow-assets' and (storage.foldername(name))[1] = auth.uid()::text and public.is_brandflow_authorized())
with check (bucket_id = 'brandflow-assets' and (storage.foldername(name))[1] = auth.uid()::text and public.is_brandflow_authorized());
create policy "asset_objects_owner_delete" on storage.objects for delete to authenticated
using (bucket_id = 'brandflow-assets' and (storage.foldername(name))[1] = auth.uid()::text and public.is_brandflow_authorized());

-- The original bootstrap functions are security definer, so wrap them with an access check.
alter function public.bootstrap_brandflow() rename to bootstrap_brandflow_internal;
alter function public.bootstrap_brandflow_modules() rename to bootstrap_brandflow_modules_internal;
revoke all on function public.bootstrap_brandflow_internal() from public, anon, authenticated;
revoke all on function public.bootstrap_brandflow_modules_internal() from public, anon, authenticated;

create function public.bootstrap_brandflow()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_brandflow_authorized() then
    raise exception 'BrandFlow access has not been authorized';
  end if;
  perform public.bootstrap_brandflow_internal();
end;
$$;

create function public.bootstrap_brandflow_modules()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_brandflow_authorized() then
    raise exception 'BrandFlow access has not been authorized';
  end if;
  perform public.bootstrap_brandflow_modules_internal();
end;
$$;

revoke all on function public.bootstrap_brandflow() from public, anon;
revoke all on function public.bootstrap_brandflow_modules() from public, anon;
grant execute on function public.bootstrap_brandflow() to authenticated;
grant execute on function public.bootstrap_brandflow_modules() to authenticated;
