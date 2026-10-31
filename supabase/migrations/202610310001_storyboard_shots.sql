create table if not exists public.storyboard_shots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.contents(id) on delete cascade,
  shot_number text not null default '',
  shot_content text not null default '',
  shot_type_movement text not null default '',
  visual_description text not null default '',
  dialogue_subtitle text not null default '',
  duration text not null default '',
  notes text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_id, sort_order)
);

create index if not exists storyboard_shots_owner_content_idx
  on public.storyboard_shots (owner_id, content_id, sort_order);

alter table public.storyboard_shots enable row level security;

drop policy if exists "storyboard_shots_owner_all" on public.storyboard_shots;
create policy "storyboard_shots_owner_all"
  on public.storyboard_shots
  for all
  to authenticated
  using (owner_id = auth.uid() and public.is_brandflow_authorized())
  with check (owner_id = auth.uid() and public.is_brandflow_authorized());

drop trigger if exists storyboard_shots_updated_at on public.storyboard_shots;
create trigger storyboard_shots_updated_at
  before update on public.storyboard_shots
  for each row execute function public.set_updated_at();
