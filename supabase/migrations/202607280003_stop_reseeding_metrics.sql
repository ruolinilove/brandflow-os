create or replace function public.bootstrap_brandflow_internal()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  user_id uuid := auth.uid();
begin
  if user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles (id) values (user_id) on conflict (id) do nothing;
  insert into public.brands (owner_id, code, name, color) values
    (user_id, 'brandA', '创艺装饰', '#79bf58'),
    (user_id, 'brandB', '喜客喜装饰', '#69b8b0')
  on conflict (owner_id, code) do nothing;

  insert into public.garden_state (owner_id) values (user_id) on conflict (owner_id) do nothing;
  insert into public.garden_plots (owner_id, position, flower, stage, color) values
    (user_id,0,'向日葵',3,'#f4b942'),(user_id,1,'郁金香',2,'#ef7c8e'),(user_id,2,null,null,null),
    (user_id,3,'小雏菊',1,'#f5d76e'),(user_id,4,'绣球花',3,'#75a7d8'),(user_id,5,null,null,null),
    (user_id,6,'月季',2,'#e36b7f'),(user_id,7,'薰衣草',1,'#9476bd'),(user_id,8,null,null,null)
  on conflict (owner_id, position) do nothing;
end;
$$;
