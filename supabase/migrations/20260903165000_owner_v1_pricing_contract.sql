begin;

-- Owner-approved V1 pricing contract (2026-09-03).
-- Historical retail_price/list_price columns are intentionally retained as
-- compatibility-only fields so completed LEO-561/562 evidence and tooling are
-- not destructively rewritten. Current V1 application code must use only the
-- canonical fields introduced below.

alter table dpg_v1.products
  add column if not exists price numeric(15,2),
  add column if not exists sale_price numeric(15,2),
  add column if not exists voucher_online_discount_amount numeric(15,2);

comment on column dpg_v1.products.price is
  'Canonical regular public selling price published by Dong Phu Gia.';
comment on column dpg_v1.products.sale_price is
  'Optional promotional public selling price. When present it must be lower than price and is the current displayed commerce price.';
comment on column dpg_v1.products.voucher_online_discount_amount is
  'Optional additional fixed discount applied only to an online order after sale_price when present, otherwise after price. Not a generic coupon/voucher engine.';
comment on column dpg_v1.products.retail_price is
  'DEPRECATED_COMPATIBILITY_ONLY after Owner pricing amendment 2026-09-03. Do not use as current V1 pricing authority.';
comment on column dpg_v1.products.list_price is
  'DEPRECATED_COMPATIBILITY_ONLY after Owner pricing amendment 2026-09-03. Do not use as current V1 pricing authority.';

alter table dpg_v1.products
  drop constraint if exists products_canonical_prices_check;
alter table dpg_v1.products
  add constraint products_canonical_prices_check check (
    (price is null or price > 0)
    and (
      sale_price is null
      or (price is not null and sale_price > 0 and sale_price < price)
    )
    and (
      voucher_online_discount_amount is null
      or (
        voucher_online_discount_amount > 0
        and coalesce(sale_price, price) is not null
        and voucher_online_discount_amount < coalesce(sale_price, price)
      )
    )
  );

-- Publication authority now requires canonical price, not historical
-- retail_price compatibility data.
alter table dpg_v1.products
  drop constraint if exists products_public_price_check;
alter table dpg_v1.products
  add constraint products_public_price_check check (
    status <> 'PUBLISHED' or (price is not null and price > 0)
  );

create or replace function dpg_v1.product_publication_failures(p_product_id uuid)
returns text[]
language sql
stable
set search_path = pg_catalog, dpg_v1
as $$
  select array_remove(array[
    case when p.brand_id is null or not b.is_active then 'BRAND' end,
    case when p.primary_category_id is null or not c.is_active or not c.is_leaf then 'PRIMARY_LEAF_CATEGORY' end,
    case when p.price is null or p.price <= 0 then 'PUBLIC_PRICE' end,
    case when p.availability = 'DISCONTINUED' then 'AVAILABILITY' end,
    case when p.unresolved_critical_conflict then 'CRITICAL_CONFLICT' end,
    case when not exists (
      select 1 from dpg_v1.product_media pm join dpg_v1.media_assets ma on ma.id = pm.media_asset_id
      where pm.product_id = p.id and pm.role = 'PRIMARY' and ma.kind = 'IMAGE' and ma.state = 'READY'
    ) then 'PRIMARY_IMAGE' end,
    case when not exists (
      select 1 from dpg_v1.product_source_provenance sp
      where sp.product_id = p.id
        and (
          (c.sector = 'sanitary' and sp.source_kind = 'manufacturer' and sp.quality = 'official')
          or (c.sector <> 'sanitary' and sp.quality in ('official', 'verified'))
        )
    ) then 'PROVENANCE' end,
    case when exists (
      select 1 from dpg_v1.category_attribute_policies cap
      where cap.category_id = p.primary_category_id and cap.requirement_tier <> 'none'
        and not exists (
          select 1 from dpg_v1.product_attribute_values pav
          where pav.product_id = p.id and pav.attribute_definition_id = cap.attribute_definition_id
            and pav.quality in ('official', 'verified')
            and exists (
              select 1 from dpg_v1.product_source_provenance sp
              where sp.id = pav.source_provenance_id and sp.product_id = p.id
                and (
                  (c.sector <> 'sanitary' or cap.requirement_tier <> 'deep')
                  or (pav.quality = 'official' and sp.source_kind = 'manufacturer' and sp.quality = 'official')
                )
            )
            and (exists (
              select 1 from dpg_v1.attribute_definitions ad
              where ad.id = pav.attribute_definition_id and ad.value_type <> 'multi_enum'
            ) or exists (
              select 1 from dpg_v1.product_attribute_multi_options pamo
              where pamo.product_attribute_value_id = pav.id
            ))
        )
    ) then 'REQUIRED_ATTRIBUTES' end
  ], null)
  from dpg_v1.products p
  left join dpg_v1.brands b on b.id = p.brand_id
  left join dpg_v1.categories c on c.id = p.primary_category_id
  where p.id = p_product_id
$$;

commit;
