alter table public.metric_entries
drop constraint if exists metric_entries_owner_id_brand_id_metric_date_platform_key;

alter table public.metric_entries
drop constraint if exists metric_entries_owner_brand_date_platform_content_name_key;

alter table public.metric_entries
add constraint metric_entries_owner_brand_date_platform_content_name_key
unique (owner_id, brand_id, metric_date, platform, content_name);

create or replace function public.bootstrap_brandflow_internal()
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
  on conflict (owner_id, brand_id, metric_date, platform, content_name) do nothing;

  insert into public.garden_state (owner_id) values (user_id) on conflict (owner_id) do nothing;
  insert into public.garden_plots (owner_id, position, flower, stage, color) values
    (user_id,0,'向日葵',3,'#f4b942'),(user_id,1,'郁金香',2,'#ef7c8e'),(user_id,2,null,null,null),
    (user_id,3,'小雏菊',1,'#f5d76e'),(user_id,4,'绣球花',3,'#75a7d8'),(user_id,5,null,null,null),
    (user_id,6,'月季',2,'#e36b7f'),(user_id,7,'薰衣草',1,'#9476bd'),(user_id,8,null,null,null)
  on conflict (owner_id, position) do nothing;
end;
$$;
