alter table public.garden_state
  add column if not exists level integer not null default 1 check (level >= 1),
  add column if not exists experience integer not null default 0 check (experience >= 0),
  add column if not exists seeds jsonb not null default '{"sunflower": 6}'::jsonb,
  add column if not exists inventory jsonb not null default '{"sunflower": 0}'::jsonb,
  add column if not exists selected_crop text not null default 'sunflower';

alter table public.garden_plots drop constraint if exists garden_plots_position_check;
alter table public.garden_plots
  add constraint garden_plots_position_check check (position between 0 and 11);

alter table public.garden_plots
  add column if not exists plant_key text,
  add column if not exists growth_state text,
  add column if not exists planted_at timestamptz;

alter table public.garden_plots drop constraint if exists garden_plots_growth_state_check;
alter table public.garden_plots
  add constraint garden_plots_growth_state_check
  check (growth_state is null or growth_state in ('seed','sprout','small','medium','large','ready','harvest'));

update public.garden_plots
set
  plant_key = case when flower is null then null else coalesce(plant_key, 'sunflower') end,
  growth_state = case
    when flower is null then null
    when growth_state is not null then growth_state
    when stage = 3 then 'ready'
    when stage = 2 then 'medium'
    else 'sprout'
  end,
  planted_at = case when flower is null then null else coalesce(planted_at, now() - interval '18 seconds') end;

insert into public.garden_plots (owner_id, position, flower, stage, color, plant_key, growth_state, planted_at)
select state.owner_id, position, null, null, null, null, null, null
from public.garden_state state
cross join generate_series(0, 11) as position
on conflict (owner_id, position) do nothing;

comment on column public.garden_state.seeds is 'Seed quantities keyed by plant asset id.';
comment on column public.garden_state.inventory is 'Harvested produce quantities keyed by plant asset id.';
comment on column public.garden_plots.growth_state is 'Plant state machine: seed, sprout, small, medium, large, ready, harvest.';
