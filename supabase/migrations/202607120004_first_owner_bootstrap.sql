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

  -- A fresh installation has no inviter. Its first account becomes the owner.
  if not exists (select 1 from public.brandflow_user_access) then
    insert into public.brandflow_user_access (user_id) values (new.id);
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
