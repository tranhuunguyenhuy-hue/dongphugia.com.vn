\set ON_ERROR_STOP on

begin;

create temp table target_rows (
  product_id integer primary key,
  sku text not null,
  old_category_id integer not null,
  old_subcategory_id integer not null,
  target_category_id integer not null,
  target_subcategory_id integer not null
) on commit drop;

insert into target_rows (product_id, sku, old_category_id, old_subcategory_id, target_category_id, target_subcategory_id) values
  (24561, '40986SD0', 1, 12, 2, 12),
  (5202, '23701', 1, 12, 2, 12),
  (5204, '23708', 1, 12, 2, 12),
  (5347, 'INLINE', 1, 18, 3, 18),
  (5345, 'AT-15E', 1, 18, 3, 18),
  (5346, 'AT-30E', 1, 18, 3, 18),
  (5343, 'AT-30H', 1, 18, 3, 18),
  (5344, 'AT-50HR', 1, 18, 3, 18),
  (5304, 'AT-150EV', 1, 18, 3, 18),
  (5305, 'AT-50EH', 1, 18, 3, 18),
  (5306, 'AT-50EHT', 1, 18, 3, 18),
  (5342, 'LOTUS', 1, 18, 3, 18),
  (5341, 'NEW', 1, 18, 3, 18),
  (5339, 'AT-368E', 1, 18, 3, 18),
  (5340, 'AT-378EP', 1, 18, 3, 18);

do $$
declare
  target_count integer;
  matched_count integer;
  bad_target_count integer;
begin
  select count(*) into target_count from target_rows;
  if target_count <> 15 then
    raise exception 'Expected 15 target rows, got %', target_count;
  end if;

  select count(*)
  into matched_count
  from products p
  join target_rows t on t.product_id = p.id
  where p.sku = t.sku
    and p.category_id = t.old_category_id
    and coalesce(p.subcategory_id, -1) = t.old_subcategory_id;

  if matched_count <> 15 then
    raise exception 'Scope lock failed: expected 15 exact old-state matches, got %', matched_count;
  end if;

  select count(*)
  into bad_target_count
  from target_rows
  where target_category_id not in (2, 3)
     or target_subcategory_id not in (12, 18);

  if bad_target_count <> 0 then
    raise exception 'Unexpected target IDs present in package';
  end if;
end $$;

select
  p.id as product_id,
  p.sku,
  p.category_id as old_category_id,
  p.subcategory_id as old_subcategory_id,
  t.target_category_id,
  t.target_subcategory_id,
  c_old.slug as old_category_slug,
  s_old.slug as old_subcategory_slug,
  c_new.slug as target_category_slug,
  s_new.slug as target_subcategory_slug
from products p
join target_rows t on t.product_id = p.id
join categories c_old on c_old.id = p.category_id
left join subcategories s_old on s_old.id = p.subcategory_id
join categories c_new on c_new.id = t.target_category_id
left join subcategories s_new on s_new.id = t.target_subcategory_id
order by p.id;

-- Redirect safety: expect zero collisions and zero chain-following rows.
with target_urls as (
  select *
  from (
    values
      ('/thiet-bi-ve-sinh/chau-rua-chen/bo-xa-chau-rua-chen-grohe-40986sd0-20585', '/thiet-bi-bep/chau-rua-chen/bo-xa-chau-rua-chen-grohe-40986sd0-20585'),
      ('/thiet-bi-ve-sinh/chau-rua-chen/gio-dat-len-chau-rua-chen-moen-23701-10158', '/thiet-bi-bep/chau-rua-chen/gio-dat-len-chau-rua-chen-moen-23701-10158'),
      ('/thiet-bi-ve-sinh/chau-rua-chen/khay-dat-len-chau-rua-chen-moen-23708-10160', '/thiet-bi-bep/chau-rua-chen/khay-dat-len-chau-rua-chen-moen-23708-10160'),
      ('/thiet-bi-ve-sinh/may-nuoc-nong/may-nuoc-nong-da-nang-ket-hop-gian-tiep-va-truc-tiep-atmor-inline', '/vat-lieu-nuoc/may-nuoc-nong/may-nuoc-nong-da-nang-ket-hop-gian-tiep-va-truc-tiep-atmor-inline'),
      ('/thiet-bi-ve-sinh/may-nuoc-nong/may-nuoc-nong-gian-tiep-15l-atmor-at-15e', '/vat-lieu-nuoc/may-nuoc-nong/may-nuoc-nong-gian-tiep-15l-atmor-at-15e'),
      ('/thiet-bi-ve-sinh/may-nuoc-nong/may-nuoc-nong-gian-tiep-30l-atmor-at-30e', '/vat-lieu-nuoc/may-nuoc-nong/may-nuoc-nong-gian-tiep-30l-atmor-at-30e'),
      ('/thiet-bi-ve-sinh/may-nuoc-nong/may-nuoc-nong-gian-tiep-atmor-at-30h-at-50h-at-80h', '/vat-lieu-nuoc/may-nuoc-nong/may-nuoc-nong-gian-tiep-atmor-at-30h-at-50h-at-80h'),
      ('/thiet-bi-ve-sinh/may-nuoc-nong/may-nuoc-nong-gian-tiep-dieu-khien-tu-xa-atmor-at-50hr-at-80hr', '/vat-lieu-nuoc/may-nuoc-nong/may-nuoc-nong-gian-tiep-dieu-khien-tu-xa-atmor-at-50hr-at-80hr'),
      ('/thiet-bi-ve-sinh/may-nuoc-nong/may-nuoc-nong-gian-tiep-kieu-dung-atmor', '/vat-lieu-nuoc/may-nuoc-nong/may-nuoc-nong-gian-tiep-kieu-dung-atmor'),
      ('/thiet-bi-ve-sinh/may-nuoc-nong/may-nuoc-nong-gian-tiep-kieu-ngang-atmor-at-30eh-at-50eh-at-80eh', '/vat-lieu-nuoc/may-nuoc-nong/may-nuoc-nong-gian-tiep-kieu-ngang-atmor-at-30eh-at-50eh-at-80eh'),
      ('/thiet-bi-ve-sinh/may-nuoc-nong/may-nuoc-nong-gian-tiep-kieu-ngang-atmor-at-30eht-at-50eht', '/vat-lieu-nuoc/may-nuoc-nong/may-nuoc-nong-gian-tiep-kieu-ngang-atmor-at-30eht-at-50eht'),
      ('/thiet-bi-ve-sinh/may-nuoc-nong/may-nuoc-nong-truc-tiep-5kw-atmor-lotus', '/vat-lieu-nuoc/may-nuoc-nong/may-nuoc-nong-truc-tiep-5kw-atmor-lotus'),
      ('/thiet-bi-ve-sinh/may-nuoc-nong/may-nuoc-nong-truc-tiep-5kw-atmor-new', '/vat-lieu-nuoc/may-nuoc-nong/may-nuoc-nong-truc-tiep-5kw-atmor-new'),
      ('/thiet-bi-ve-sinh/may-nuoc-nong/may-nuoc-nong-truc-tiep-sieu-mong-3-5kw-atmor-at-368e', '/vat-lieu-nuoc/may-nuoc-nong/may-nuoc-nong-truc-tiep-sieu-mong-3-5kw-atmor-at-368e'),
      ('/thiet-bi-ve-sinh/may-nuoc-nong/may-nuoc-nong-truc-tiep-sieu-mong-4-5kw-atmor-at-378ep', '/vat-lieu-nuoc/may-nuoc-nong/may-nuoc-nong-truc-tiep-sieu-mong-4-5kw-atmor-at-378ep')
  ) as t(old_url, expected_new_url)
)
select
  tu.old_url,
  r.new_url as db_new_url,
  case
    when r.old_url is null then 'missing'
    when r.new_url = tu.expected_new_url then 'ok'
    else 'collision'
  end as redirect_old_url_state,
  r2.old_url as next_hop_source,
  r2.new_url as next_hop_target
from target_urls tu
left join redirects r
  on r.old_url = tu.old_url
 and coalesce(r.is_active, true) is true
left join redirects r2
  on r2.old_url = tu.expected_new_url
 and coalesce(r2.is_active, true) is true
order by tu.old_url;

rollback;
