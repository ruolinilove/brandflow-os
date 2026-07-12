create or replace function public.bootstrap_brandflow_modules()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  user_id uuid := auth.uid();
  brand_a_id uuid;
  brand_b_id uuid;
  brand_project_id uuid;
begin
  if user_id is null then
    raise exception 'Authentication required';
  end if;

  select id into brand_a_id from public.brands where owner_id = user_id and code = 'brandA';
  select id into brand_b_id from public.brands where owner_id = user_id and code = 'brandB';

  insert into public.projects (owner_id, brand_id, name, project_type, description, owner_name, status, progress, cover_url)
  select user_id, brand_a_id, seed.name, seed.project_type, seed.description, '内容运营', '进行中', seed.progress, seed.cover_url
  from (values
    ('嗨，我的新家','品牌视频','创艺装饰品牌叙事视频',76,'/assets/project-home.jpg'),
    ('云上九州 128㎡','完工案例','完工空间案例内容项目',92,'/assets/finished-home.jpg'),
    ('观山湖工地日记','内容栏目','真实装修过程记录栏目',48,'/assets/site-safety.jpg'),
    ('设计师人物栏目','长期栏目','设计师人物内容系列',34,'/assets/content-team.jpg')
  ) as seed(name, project_type, description, progress, cover_url)
  where not exists (select 1 from public.projects p where p.owner_id = user_id and p.name = seed.name);

  select id into brand_project_id from public.projects where owner_id = user_id and name = '嗨，我的新家' limit 1;

  insert into public.plans (owner_id, brand_id, project_id, title, summary, period, status, due_date)
  select user_id, brand_a_id, brand_project_id, seed.title, seed.summary, seed.period, seed.status, seed.due_date
  from (values
    ('品牌片分镜与拍摄计划','完成分镜细化、场地确认和核心画面拍摄','week','进行中','2026-07-18'::date),
    ('七月双品牌内容计划','保持双品牌稳定更新并完成月度数据复盘','month','进行中','2026-07-31'::date)
  ) as seed(title, summary, period, status, due_date)
  where not exists (select 1 from public.plans p where p.owner_id = user_id and p.title = seed.title);

  insert into public.contents (owner_id, brand_id, project_id, title, summary, content_format, channel, status, cover_url)
  select user_id, seed.brand_id, brand_project_id, seed.title, seed.summary, '短视频', seed.channel, seed.status, seed.cover_url
  from (values
    (brand_a_id,'装修不是选择题','围绕装修选择焦虑展开内容','抖音','待审核','/assets/content-video.jpg'),
    (brand_a_id,'看不见的工程，也有标准','展示隐蔽工程施工标准','视频号','剪辑中','/assets/site-safety.jpg'),
    (brand_b_id,'设计师如何听懂你的生活','设计师人物观察内容','小红书','已发布','/assets/content-team.jpg'),
    (brand_a_id,'新家交付的第一天','记录新家交付后的真实体验','抖音','脚本中','/assets/finished-home.jpg')
  ) as seed(brand_id,title,summary,channel,status,cover_url)
  where not exists (select 1 from public.contents c where c.owner_id = user_id and c.title = seed.title);

  insert into public.ideas (owner_id, brand_id, title, description, category)
  select user_id, seed.brand_id, seed.title, seed.description, seed.category
  from (values
    (brand_a_id,'家的第一句问候','品牌片开场不介绍公司，先让家成为说话的人。','品牌叙事'),
    (brand_a_id,'把隐蔽工程拍成可见的安心','用极近特写和检测动作，把标准变成用户能理解的证据。','工艺内容'),
    (brand_b_id,'设计师不是给答案的人','把设计师拍成帮助客户发现生活方式的人。','人物栏目')
  ) as seed(brand_id,title,description,category)
  where not exists (select 1 from public.ideas i where i.owner_id = user_id and i.title = seed.title);

  insert into public.assets (owner_id, brand_id, project_id, name, category, public_url, mime_type)
  select user_id, brand_a_id, brand_project_id, seed.name, seed.category, seed.public_url, 'image/jpeg'
  from (values
    ('嗨，我的新家','品牌视频','/assets/project-home.jpg'),
    ('隐蔽工程标准','工地内容','/assets/site-safety.jpg'),
    ('装修不是选择题','短视频','/assets/content-video.jpg'),
    ('设计师人物栏目','人物内容','/assets/content-team.jpg')
  ) as seed(name,category,public_url)
  where not exists (select 1 from public.assets a where a.owner_id = user_id and a.name = seed.name);
end;
$$;

grant execute on function public.bootstrap_brandflow_modules() to authenticated;
