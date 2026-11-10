-- Re-runnable, non-public test data for the isolated #290 project only.
-- Synthetic prices are deliberately unverified and must never be published.
begin;

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
      and (source_system <> 'synthetic-preview' or price_source <> 'synthetic-preview')
  ) then
    raise exception 'DPG_PREVIEW_290_SEED_IDENTITY_CONFLICT';
  end if;
end
$preview_seed_guard$;

insert into dpg_app.categories (name, slug, is_active)
values ('Preview synthetic test category', 'preview-290-synthetic', false)
on conflict (slug) do nothing;

insert into dpg_app.brands (name, slug, is_active)
values ('Preview synthetic test brand', 'preview-290-synthetic', false)
on conflict (slug) do nothing;

insert into dpg_app.products (
  sku, name, slug, category_id, brand_id, price,
  publication_status, pdp_visibility, listing_visibility, search_visibility,
  seo_indexing, sitemap_include, price_state, price_source,
  price_confidence, source_system, source_confidence,
  variant_group, variant_type, variant_label, variant_options
)
select v.sku, v.name, v.slug, c.id, b.id, v.price,
  'draft', 'hidden', 'hidden', 'hidden',
  'noindex', false, 'unknown', 'synthetic-preview',
  'low', 'synthetic-preview', 'low',
  'preview-290-test', 'seat_type', v.option_label,
  jsonb_build_array(jsonb_build_object('axis', 'seat_type', 'label', v.option_label, 'value', v.option_value))
from (values
  ('DPG-290-SYN-A', 'PREVIEW ONLY — Synthetic option A', 'preview-290-synthetic-a', 100000::numeric, 'Option A', 'a'),
  ('DPG-290-SYN-B', 'PREVIEW ONLY — Synthetic option B', 'preview-290-synthetic-b', 120000::numeric, 'Option B', 'b')
) as v(sku, name, slug, price, option_label, option_value)
join dpg_app.categories c on c.slug = 'preview-290-synthetic'
join dpg_app.brands b on b.slug = 'preview-290-synthetic'
where not exists (select 1 from dpg_app.products p where p.sku = v.sku);

update dpg_app.products p
set canonical_product_id = canonical.id
from dpg_app.products canonical
where p.sku = 'DPG-290-SYN-B'
  and canonical.sku = 'DPG-290-SYN-A'
  and p.canonical_product_id is null;

do $preview_seed_postflight$
begin
  if (select count(*) from dpg_app.products where sku in ('DPG-290-SYN-A', 'DPG-290-SYN-B')) <> 2
    or exists (
      select 1 from dpg_app.products
      where sku in ('DPG-290-SYN-A', 'DPG-290-SYN-B')
        and (publication_status <> 'draft' or price_state <> 'unknown'
          or price_source <> 'synthetic-preview' or seo_indexing <> 'noindex'
          or sitemap_include or pdp_visibility <> 'hidden')
    ) then
    raise exception 'DPG_PREVIEW_290_SEED_POSTFLIGHT_FAILED';
  end if;
end
$preview_seed_postflight$;

commit;
