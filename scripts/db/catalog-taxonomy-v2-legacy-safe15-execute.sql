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
  matched_count integer;
begin
  select count(*)
  into matched_count
  from products p
  join target_rows t on t.product_id = p.id
  where p.sku = t.sku
    and p.category_id = t.old_category_id
    and coalesce(p.subcategory_id, -1) = t.old_subcategory_id;

  if matched_count <> 15 then
    raise exception 'Scope lock failed before update: expected 15 exact old-state matches, got %', matched_count;
  end if;
end $$;

create temp table updated_rows on commit drop as
with updated as (
  update products p
  set category_id = t.target_category_id,
      subcategory_id = t.target_subcategory_id,
      updated_at = now()
  from target_rows t
  where p.id = t.product_id
    and p.sku = t.sku
    and p.category_id = t.old_category_id
    and coalesce(p.subcategory_id, -1) = t.old_subcategory_id
  returning p.id
)
select id as product_id
from updated;

do $$
declare
  updated_count integer;
begin
  select count(*) into updated_count from updated_rows;
  if updated_count <> 15 then
    raise exception 'Expected to update 15 rows, updated %', updated_count;
  end if;
end $$;

select
  p.id as product_id,
  p.sku,
  p.category_id,
  p.subcategory_id
from products p
join target_rows t on t.product_id = p.id
order by p.id;

commit;
