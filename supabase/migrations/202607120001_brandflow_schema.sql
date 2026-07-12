create extension if not exists pgcrypto;

-- Preserve the earlier integer-based schema without mixing it with BrandFlow OS.
do $$
declare
  brands_id_type text;
  legacy_table text;
begin
  if to_regclass('public.brands') is not null then
    select data_type into brands_id_type
    from information_schema.columns
    where table_schema = 'public' and table_name = 'brands' and column_name = 'id';

    if brands_id_type is distinct from 'uuid' then
      if to_regclass('public.legacy_brands') is not null then
        raise exception 'public.legacy_brands already exists; manual migration is required';
      end if;
      alter table public.brands rename to legacy_brands;
    end if;
  end if;

  foreach legacy_table in array array['app_users','legacy_brands','platform_data','platforms','video_types','videos','weekly_tasks']
  loop
    if to_regclass('public.' || legacy_table) is not null then
      execute format('alter table public.%I enable row level security', legacy_table);
    end if;
  end loop;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '创艺运营',
  role text not null default '品牌内容负责人',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null check (code in ('brandA', 'brandB')),
  name text not null,
  color text not null default '#79bf58',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, code)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  name text not null,
  project_type text not null,
  description text,
  owner_name text,
  status text not null default '待开始',
  progress integer not null default 0 check (progress between 0 and 100),
  due_date date,
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  summary text not null default '',
  period text not null check (period in ('month', 'week')),
  status text not null default '待开始',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  plan_id uuid references public.plans(id) on delete set null,
  title text not null,
  summary text not null default '',
  content_format text not null default '短视频',
  channel text not null default '抖音',
  status text not null default '脚本中',
  planned_publish_date date,
  published_at timestamptz,
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.metric_entries (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  content_id uuid references public.contents(id) on delete set null,
  metric_date date not null,
  platform text not null default 'all',
  views bigint not null default 0 check (views >= 0),
  shares bigint not null default 0 check (shares >= 0),
  follower_growth integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, brand_id, metric_date, platform)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  content_id uuid references public.contents(id) on delete set null,
  name text not null,
  category text not null,
  storage_path text,
  public_url text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text not null default '',
  category text not null,
  status text not null default '灵感',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.garden_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  water integer not null default 8 check (water >= 0),
  coins integer not null default 126 check (coins >= 0),
  notice text not null default '今天的花园状态很好',
  updated_at timestamptz not null default now()
);

create table public.garden_plots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  position smallint not null check (position between 0 and 8),
  flower text,
  stage smallint check (stage is null or stage between 1 and 3),
  color text,
  updated_at timestamptz not null default now(),
  unique (owner_id, position),
  check ((flower is null and stage is null) or (flower is not null and stage is not null))
);

create index metric_entries_brand_date_idx on public.metric_entries (brand_id, metric_date desc);
create index projects_owner_status_idx on public.projects (owner_id, status);
create index plans_owner_due_date_idx on public.plans (owner_id, due_date);
create index contents_owner_status_idx on public.contents (owner_id, status);
create index assets_project_idx on public.assets (project_id);
create index ideas_owner_created_idx on public.ideas (owner_id, created_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['profiles','brands','projects','plans','contents','metric_entries','assets','ideas','garden_state','garden_plots']
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy "profiles_owner_all" on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "brands_owner_all" on public.brands for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "projects_owner_all" on public.projects for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "plans_owner_all" on public.plans for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "contents_owner_all" on public.contents for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "metric_entries_owner_all" on public.metric_entries for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "assets_owner_all" on public.assets for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "ideas_owner_all" on public.ideas for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "garden_state_owner_all" on public.garden_state for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "garden_plots_owner_all" on public.garden_plots for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger brands_updated_at before update on public.brands for each row execute function public.set_updated_at();
create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger plans_updated_at before update on public.plans for each row execute function public.set_updated_at();
create trigger contents_updated_at before update on public.contents for each row execute function public.set_updated_at();
create trigger metric_entries_updated_at before update on public.metric_entries for each row execute function public.set_updated_at();
create trigger assets_updated_at before update on public.assets for each row execute function public.set_updated_at();
create trigger ideas_updated_at before update on public.ideas for each row execute function public.set_updated_at();
create trigger garden_state_updated_at before update on public.garden_state for each row execute function public.set_updated_at();
create trigger garden_plots_updated_at before update on public.garden_plots for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('brandflow-assets', 'brandflow-assets', false)
on conflict (id) do nothing;

create policy "asset_objects_owner_read" on storage.objects for select to authenticated
using (bucket_id = 'brandflow-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "asset_objects_owner_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'brandflow-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "asset_objects_owner_update" on storage.objects for update to authenticated
using (bucket_id = 'brandflow-assets' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'brandflow-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "asset_objects_owner_delete" on storage.objects for delete to authenticated
using (bucket_id = 'brandflow-assets' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.bootstrap_brandflow()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  user_id uuid := auth.uid();
  brand_a_id uuid;
  brand_b_id uuid;
begin
  if user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles (id) values (user_id) on conflict (id) do nothing;
  insert into public.brands (owner_id, code, name, color) values
    (user_id, 'brandA', '创艺装饰', '#79bf58'),
    (user_id, 'brandB', '喜客喜装饰', '#69b8b0')
  on conflict (owner_id, code) do nothing;

  select id into brand_a_id from public.brands where owner_id = user_id and code = 'brandA';
  select id into brand_b_id from public.brands where owner_id = user_id and code = 'brandB';

  insert into public.metric_entries (owner_id, brand_id, metric_date, views, shares, follower_growth) values
    (user_id,brand_a_id,'2026-07-01',26800,186,72),(user_id,brand_b_id,'2026-07-01',18200,112,46),
    (user_id,brand_a_id,'2026-07-03',42600,318,108),(user_id,brand_b_id,'2026-07-03',31000,204,81),
    (user_id,brand_a_id,'2026-07-05',35200,246,93),(user_id,brand_b_id,'2026-07-05',38600,260,95),
    (user_id,brand_a_id,'2026-07-07',68400,472,156),(user_id,brand_b_id,'2026-07-07',44800,301,114),
    (user_id,brand_a_id,'2026-07-09',55600,394,132),(user_id,brand_b_id,'2026-07-09',52300,366,127),
    (user_id,brand_a_id,'2026-07-11',83200,618,209),(user_id,brand_b_id,'2026-07-11',61700,432,168)
  on conflict (owner_id, brand_id, metric_date, platform) do nothing;

  insert into public.garden_state (owner_id) values (user_id) on conflict (owner_id) do nothing;
  insert into public.garden_plots (owner_id, position, flower, stage, color) values
    (user_id,0,'向日葵',3,'#f4b942'),(user_id,1,'郁金香',2,'#ef7c8e'),(user_id,2,null,null,null),
    (user_id,3,'小雏菊',1,'#f5d76e'),(user_id,4,'绣球花',3,'#75a7d8'),(user_id,5,null,null,null),
    (user_id,6,'月季',2,'#e36b7f'),(user_id,7,'薰衣草',1,'#9476bd'),(user_id,8,null,null,null)
  on conflict (owner_id, position) do nothing;
end;
$$;

grant execute on function public.bootstrap_brandflow() to authenticated;
