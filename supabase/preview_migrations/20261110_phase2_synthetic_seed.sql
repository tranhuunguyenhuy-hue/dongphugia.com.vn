-- Re-runnable synthetic order fixtures for the isolated #290 project only.

do $preview_seed_guard$
begin
  if not exists (
    select 1 from dpg_control.target_contract
    where singleton
      and project_name = 'dongphugia-phase2-preview-290'
      and environment = 'preview_synthetic'
      and data_class = 'synthetic-with-approved-public-fixtures'
      and not production_data_allowed
      and not production_credentials_allowed
      and not production_writes_allowed
  ) then
    raise exception 'DPG_PREVIEW_290_TARGET_REQUIRED';
  end if;
  if exists (
    select 1 from dpg_app.products
    where sku in ('DPG-290-SYN-A', 'DPG-290-SYN-B')
      and (
        source_system <> 'synthetic-preview'
        or price_source <> 'synthetic-preview'
        or (sku = 'DPG-290-SYN-A' and id <> 1)
        or (sku = 'DPG-290-SYN-B' and id <> 2)
      )
  ) then
    raise exception 'DPG_PREVIEW_290_SEED_IDENTITY_CONFLICT';
  end if;
end
$preview_seed_guard$;

insert into dpg_app.categories (name, slug, is_active)
values ('Preview synthetic test category', 'preview-synthetic', true)
on conflict (slug) do update set name = excluded.name, is_active = true;

insert into dpg_app.brands (name, slug, is_active)
values ('Preview synthetic test brand', 'preview-synthetic', true)
on conflict (slug) do update set name = excluded.name, is_active = true;

insert into dpg_app.product_variant_groups (
  group_key, base_sku, variant_type, label, source, confidence, axes
)
values (
  'public-290', 'DPG-290-SYN-A', 'seat_type', 'Tùy chọn SKU', 'synthetic-preview', 'low',
  '[{"key":"seat_type","label":"Tùy chọn SKU"}]'::jsonb
)
on conflict (group_key) do update set
  base_sku = excluded.base_sku,
  variant_type = excluded.variant_type,
  label = excluded.label,
  source = excluded.source,
  confidence = excluded.confidence,
  axes = excluded.axes,
  updated_at = now();

insert into dpg_app.products (
  sku, name, slug, category_id, brand_id, price,
  original_price, list_price, sale_price, online_discount_amount,
  publication_status, pdp_visibility, listing_visibility, search_visibility,
  seo_indexing, sitemap_include, price_state, price_source, price_confidence,
  price_updated_at, source_system, source_confidence, stock_status, is_active,
  sellable_status, variant_group_id, variant_group, variant_type, variant_label, variant_options
)
select v.sku, v.name, v.slug, c.id, b.id, v.price,
  null, null, null, null,
  'public', 'public', 'public', 'visible',
  'noindex', false, 'priced', 'synthetic-preview', 'low',
  null, 'synthetic-preview', 'low', 'in_stock', true,
  'sellable', vg.id, 'public-290', 'seat_type', v.option_label,
  jsonb_build_array(jsonb_build_object('axis', 'seat_type', 'label', v.option_label, 'value', v.option_value))
from (values
  ('DPG-290-SYN-A', 'PREVIEW ONLY — Synthetic option A', 'preview-option-a', 100000::numeric, 'Option A', 'a'),
  ('DPG-290-SYN-B', 'PREVIEW ONLY — Synthetic option B', 'preview-option-b', 120000::numeric, 'Option B', 'b')
) as v(sku, name, slug, price, option_label, option_value)
join dpg_app.categories c on c.slug = 'preview-synthetic'
join dpg_app.brands b on b.slug = 'preview-synthetic'
join dpg_app.product_variant_groups vg on vg.group_key = 'public-290'
where not exists (select 1 from dpg_app.products p where p.sku = v.sku);

update dpg_app.products p
set name = v.name,
    slug = v.slug,
    category_id = c.id,
    brand_id = b.id,
    price = v.price,
    original_price = null,
    list_price = null,
    sale_price = null,
    online_discount_amount = null,
    publication_status = 'public',
    pdp_visibility = 'public',
    listing_visibility = 'public',
    search_visibility = 'visible',
    seo_indexing = 'noindex',
    sitemap_include = false,
    price_state = 'priced',
    price_source = 'synthetic-preview',
    price_confidence = 'low',
    price_updated_at = null,
    source_system = 'synthetic-preview',
    source_confidence = 'low',
    stock_status = 'in_stock',
    is_active = true,
    sellable_status = 'sellable',
    variant_group_id = vg.id,
    variant_group = 'public-290',
    variant_type = 'seat_type',
    variant_label = v.option_label,
    variant_options = jsonb_build_array(jsonb_build_object('axis', 'seat_type', 'label', v.option_label, 'value', v.option_value)),
    updated_at = now()
from (values
  ('DPG-290-SYN-A', 'PREVIEW ONLY — Synthetic option A', 'preview-option-a', 100000::numeric, 'Option A', 'a'),
  ('DPG-290-SYN-B', 'PREVIEW ONLY — Synthetic option B', 'preview-option-b', 120000::numeric, 'Option B', 'b')
) as v(sku, name, slug, price, option_label, option_value)
join dpg_app.categories c on c.slug = 'preview-synthetic'
join dpg_app.brands b on b.slug = 'preview-synthetic'
join dpg_app.product_variant_groups vg on vg.group_key = 'public-290'
where p.sku = v.sku
  and p.source_system = 'synthetic-preview'
  and p.price_source = 'synthetic-preview';

update dpg_app.products p
set canonical_product_id = canonical.id
from dpg_app.products canonical
where p.sku = 'DPG-290-SYN-B'
  and canonical.sku = 'DPG-290-SYN-A';

do $preview_seed_postflight$
begin
  if (select count(*) from dpg_app.products where sku in ('DPG-290-SYN-A', 'DPG-290-SYN-B')) <> 2
    or exists (
      select 1 from dpg_app.products
      where sku in ('DPG-290-SYN-A', 'DPG-290-SYN-B')
        and (publication_status <> 'public' or price_state <> 'priced'
          or price_confidence <> 'low' or price_source <> 'synthetic-preview'
          or source_system <> 'synthetic-preview' or price_updated_at is not null
          or seo_indexing <> 'noindex' or sitemap_include or pdp_visibility <> 'public'
          or stock_status <> 'in_stock' or sellable_status <> 'sellable'
          or variant_group <> 'public-290' or variant_group_id is null
          or source_confidence <> 'low' or list_price is not null
          or original_price is not null or sale_price is not null
          or online_discount_amount is not null
          or (sku = 'DPG-290-SYN-A' and (
            id <> 1 or name <> 'PREVIEW ONLY — Synthetic option A'
            or slug <> 'preview-option-a' or price <> 100000
            or canonical_product_id is not null or variant_label <> 'Option A'
            or variant_options <> '[{"axis":"seat_type","label":"Option A","value":"a"}]'::jsonb
          ))
          or (sku = 'DPG-290-SYN-B' and (
            id <> 2 or name <> 'PREVIEW ONLY — Synthetic option B'
            or slug <> 'preview-option-b' or price <> 120000
            or canonical_product_id <> 1 or variant_label <> 'Option B'
            or variant_options <> '[{"axis":"seat_type","label":"Option B","value":"b"}]'::jsonb
          )))
    ) then
    raise exception 'DPG_PREVIEW_290_SEED_POSTFLIGHT_FAILED';
  end if;
end
$preview_seed_postflight$;
