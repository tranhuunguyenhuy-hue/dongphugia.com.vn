\set ON_ERROR_STOP on

begin;

create temp table rollback_rows (
  product_id integer primary key,
  sku text not null,
  rollback_category_id integer not null,
  rollback_subcategory_id integer not null
) on commit drop;

insert into rollback_rows (product_id, sku, rollback_category_id, rollback_subcategory_id) values
  (24561, '40986SD0', 1, 12),
  (5202, '23701', 1, 12),
  (5204, '23708', 1, 12),
  (5347, 'INLINE', 1, 18),
  (5345, 'AT-15E', 1, 18),
  (5346, 'AT-30E', 1, 18),
  (5343, 'AT-30H', 1, 18),
  (5344, 'AT-50HR', 1, 18),
  (5304, 'AT-150EV', 1, 18),
  (5305, 'AT-50EH', 1, 18),
  (5306, 'AT-50EHT', 1, 18),
  (5342, 'LOTUS', 1, 18),
  (5341, 'NEW', 1, 18),
  (5339, 'AT-368E', 1, 18),
  (5340, 'AT-378EP', 1, 18);

create temp table rolled_back_rows on commit drop as
with rolled_back as (
  update products p
  set category_id = r.rollback_category_id,
      subcategory_id = r.rollback_subcategory_id,
      updated_at = now()
  from rollback_rows r
  where p.id = r.product_id
    and p.sku = r.sku
  returning p.id
)
select id as product_id
from rolled_back;

do $$
declare
  updated_count integer;
begin
  select count(*) into updated_count from rolled_back_rows;
  if updated_count <> 15 then
    raise exception 'Expected to rollback 15 rows, rolled back %', updated_count;
  end if;
end $$;

select
  p.id as product_id,
  p.sku,
  p.category_id,
  p.subcategory_id
from products p
join rollback_rows r on r.product_id = p.id
order by p.id;

commit;
