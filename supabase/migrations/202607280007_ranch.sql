create table if not exists public.ranch_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  level integer not null default 1 check (level >= 1),
  experience integer not null default 0 check (experience >= 0),
  coins integer not null default 1280 check (coins >= 0),
  feed integer not null default 24 check (feed >= 0),
  inventory jsonb not null default '{}'::jsonb,
  notice text not null default '动物们正在牧场里悠闲活动',
  updated_at timestamptz not null default now()
);

create table if not exists public.ranch_animals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  species_key text not null,
  nickname text not null default '',
  hunger integer not null default 80 check (hunger between 0 and 100),
  health integer not null default 100 check (health between 0 and 100),
  position_x numeric(5,4) not null check (position_x between 0 and 1),
  position_y numeric(5,4) not null check (position_y between 0 and 1),
  production_started_at timestamptz not null default now(),
  acquired_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ranch_state enable row level security;
alter table public.ranch_animals enable row level security;

drop policy if exists "ranch_state_owner_all" on public.ranch_state;
drop policy if exists "ranch_animals_owner_all" on public.ranch_animals;
create policy "ranch_state_owner_all" on public.ranch_state for all to authenticated
using (owner_id = auth.uid() and public.is_brandflow_authorized())
with check (owner_id = auth.uid() and public.is_brandflow_authorized());
create policy "ranch_animals_owner_all" on public.ranch_animals for all to authenticated
using (owner_id = auth.uid() and public.is_brandflow_authorized())
with check (owner_id = auth.uid() and public.is_brandflow_authorized());

drop trigger if exists ranch_state_updated_at on public.ranch_state;
drop trigger if exists ranch_animals_updated_at on public.ranch_animals;
create trigger ranch_state_updated_at before update on public.ranch_state for each row execute function public.set_updated_at();
create trigger ranch_animals_updated_at before update on public.ranch_animals for each row execute function public.set_updated_at();

create index if not exists ranch_animals_owner_idx on public.ranch_animals (owner_id, acquired_at);
