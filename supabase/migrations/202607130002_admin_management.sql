alter table public.brandflow_user_access
drop constraint if exists brandflow_user_access_role_check;

alter table public.brandflow_user_access
alter column role set default 'member';

update public.brandflow_user_access
set role = 'member'
where role not in ('super_admin', 'admin', 'member');

alter table public.brandflow_user_access
add constraint brandflow_user_access_role_check
check (role in ('super_admin', 'admin', 'member'));

-- The first Auth account remains the only permanent super administrator.
with first_account as (
  select id from auth.users order by created_at asc limit 1
)
update public.brandflow_user_access access
set role = case
  when access.user_id = first_account.id then 'super_admin'
  when access.role = 'super_admin' then 'member'
  else access.role
end
from first_account;

create unique index if not exists brandflow_single_super_admin
on public.brandflow_user_access (role)
where role = 'super_admin';

create or replace function public.get_brandflow_access_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select role from public.brandflow_user_access
    where user_id = auth.uid()
  ), 'member');
$$;

create or replace function public.list_brandflow_users()
returns table (
  user_id uuid,
  email text,
  display_name text,
  access_role text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_brandflow_super_admin() then
    raise exception 'Only the BrandFlow super administrator can view users';
  end if;

  return query
  select
    users.id,
    coalesce(users.email, '')::text,
    coalesce(profiles.display_name, 'BrandFlow 用户')::text,
    access.role::text,
    users.created_at
  from public.brandflow_user_access access
  join auth.users users on users.id = access.user_id
  left join public.profiles profiles on profiles.id = users.id
  order by
    case access.role when 'super_admin' then 0 when 'admin' then 1 else 2 end,
    users.created_at asc;
end;
$$;

create or replace function public.set_brandflow_user_role(
  target_user uuid,
  target_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role text;
begin
  if not public.is_brandflow_super_admin() then
    raise exception 'Only the BrandFlow super administrator can manage roles';
  end if;

  if target_role not in ('admin', 'member') then
    raise exception 'Role must be admin or member';
  end if;

  select role into current_role
  from public.brandflow_user_access
  where user_id = target_user
  for update;

  if not found then
    raise exception 'BrandFlow user was not found';
  end if;

  if current_role = 'super_admin' then
    raise exception 'The permanent super administrator role cannot be changed';
  end if;

  if target_role = 'admin'
    and current_role <> 'admin'
    and (select count(*) from public.brandflow_user_access where role = 'admin') >= 2
  then
    raise exception 'BrandFlow supports at most two administrators';
  end if;

  update public.brandflow_user_access
  set role = target_role
  where user_id = target_user;
end;
$$;

revoke all on function public.list_brandflow_users() from public, anon;
revoke all on function public.set_brandflow_user_role(uuid, text) from public, anon;
grant execute on function public.list_brandflow_users() to authenticated;
grant execute on function public.set_brandflow_user_role(uuid, text) to authenticated;

alter table public.profiles
alter column display_name set default 'BrandFlow 用户';

update public.profiles profiles
set display_name = coalesce(nullif(split_part(users.email, '@', 1), ''), 'BrandFlow 用户')
from auth.users users
where profiles.id = users.id
  and profiles.display_name = '创艺运营';

create or replace function public.create_brandflow_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(split_part(new.email, '@', 1), ''), 'BrandFlow 用户')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_brandflow_profile_after_signup on auth.users;
create trigger create_brandflow_profile_after_signup
after insert on auth.users
for each row execute function public.create_brandflow_profile();

notify pgrst, 'reload schema';
