\set ON_ERROR_STOP on

begin;

with target_category as (
  select id
  from categories
  where slug = 'gach-op-lat'
),
payload(slug, name, description, sort_order) as (
  values
    (
      'gach-op-lat',
      'Gạch Ốp Lát',
      'Các dòng gạch ốp lát tổng hợp theo taxonomy canonical.',
      90
    ),
    (
      'gach-op-tuong',
      'Gạch Ốp Tường',
      'Các dòng gạch ốp tường theo taxonomy canonical.',
      91
    ),
    (
      'gach-inax-ecocarat',
      'Gạch Inax Ecocarat',
      'Các dòng gạch Inax Ecocarat theo taxonomy canonical.',
      92
    )
)
insert into subcategories (
  category_id,
  name,
  slug,
  description,
  is_active,
  sort_order,
  created_at,
  updated_at
)
select
  tc.id,
  p.name,
  p.slug,
  p.description,
  true,
  p.sort_order,
  now(),
  now()
from target_category tc
cross join payload p
on conflict (category_id, slug) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = true,
  sort_order = excluded.sort_order,
  updated_at = now();

select
  c.slug as category_slug,
  s.id as subcategory_id,
  s.slug as subcategory_slug,
  s.name,
  s.sort_order,
  s.is_active
from subcategories s
join categories c on c.id = s.category_id
where c.slug = 'gach-op-lat'
  and s.slug in ('gach-op-lat', 'gach-op-tuong', 'gach-inax-ecocarat')
order by s.sort_order asc, s.id asc;

commit;
