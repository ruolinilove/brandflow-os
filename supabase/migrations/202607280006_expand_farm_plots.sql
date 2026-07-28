alter table public.garden_plots drop constraint if exists garden_plots_position_check;
alter table public.garden_plots
  add constraint garden_plots_position_check check (position between 0 and 17);

insert into public.garden_plots (owner_id, position, flower, stage, color, plant_key, growth_state, planted_at)
select state.owner_id, position, null, null, null, null, null, null
from public.garden_state state
cross join generate_series(0, 17) as position
on conflict (owner_id, position) do nothing;

comment on constraint garden_plots_position_check on public.garden_plots is 'Classic three-row farm layout with 18 interactive plots.';
