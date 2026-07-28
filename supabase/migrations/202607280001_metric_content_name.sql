alter table public.metric_entries
add column if not exists content_name text;

update public.metric_entries
set content_name = '未命名内容'
where content_name is null or btrim(content_name) = '';

alter table public.metric_entries
alter column content_name set default '未命名内容',
alter column content_name set not null;

alter table public.metric_entries
drop constraint if exists metric_entries_content_name_not_blank;

alter table public.metric_entries
add constraint metric_entries_content_name_not_blank
check (btrim(content_name) <> '');
