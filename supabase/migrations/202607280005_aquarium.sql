create table if not exists public.aquarium_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  level integer not null default 1 check (level >= 1),
  experience integer not null default 0 check (experience >= 0),
  shells integer not null default 880 check (shells >= 0),
  food integer not null default 20 check (food >= 0),
  notice text not null default '海洋馆水质良好',
  updated_at timestamptz not null default now()
);

create table if not exists public.aquarium_creatures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  species_key text not null,
  nickname text not null default '',
  hunger integer not null default 80 check (hunger between 0 and 100),
  health integer not null default 100 check (health between 0 and 100),
  position_x numeric(5,4) not null check (position_x between 0 and 1),
  position_y numeric(5,4) not null check (position_y between 0 and 1),
  acquired_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.aquarium_state enable row level security;
alter table public.aquarium_creatures enable row level security;

drop policy if exists "aquarium_state_owner_all" on public.aquarium_state;
drop policy if exists "aquarium_creatures_owner_all" on public.aquarium_creatures;
create policy "aquarium_state_owner_all" on public.aquarium_state for all to authenticated
using (owner_id = auth.uid() and public.is_brandflow_authorized())
with check (owner_id = auth.uid() and public.is_brandflow_authorized());
create policy "aquarium_creatures_owner_all" on public.aquarium_creatures for all to authenticated
using (owner_id = auth.uid() and public.is_brandflow_authorized())
with check (owner_id = auth.uid() and public.is_brandflow_authorized());

drop trigger if exists aquarium_state_updated_at on public.aquarium_state;
drop trigger if exists aquarium_creatures_updated_at on public.aquarium_creatures;
create trigger aquarium_state_updated_at before update on public.aquarium_state for each row execute function public.set_updated_at();
create trigger aquarium_creatures_updated_at before update on public.aquarium_creatures for each row execute function public.set_updated_at();

create index if not exists aquarium_creatures_owner_idx on public.aquarium_creatures (owner_id, acquired_at);
