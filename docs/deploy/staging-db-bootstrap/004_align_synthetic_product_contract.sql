-- Dong Phu Gia existing staging-only Product contract repair
-- Scope: the three Product contract fixtures plus twelve synthetic redirect
-- targets required by the reviewed runtime registry in the staging database.
-- Safe properties:
-- - no DROP, TRUNCATE, DELETE, or production-domain data;
-- - creates or updates only synthetic staging taxonomy/product fixtures;
-- - fails closed unless all fifteen expected synthetic fixtures validate;
-- - run with psql --set=ON_ERROR_STOP=1 --single-transaction.

DO $$
DECLARE
  updated_count integer;
  priced_in_stock_count integer;
  priced_out_of_stock_count integer;
  quote_only_count integer;
BEGIN
  UPDATE "products" p
  SET
    "price" = v."compatibility_price",
    "original_price" = v."original_price",
    "list_price" = v."original_price",
    "sale_price" = v."sale_price",
    "price_display" = v."price_display",
    "stock_status" = v."stock_status",
    "updated_at" = CURRENT_TIMESTAMP
  FROM (
    VALUES
      ('STG-DEMO-TBVS-001', 2500000.00, 2500000.00, NULL::numeric, NULL::text, 'in_stock'),
      ('STG-DEMO-TBVS-002', 1800000.00, 1800000.00, NULL::numeric, NULL::text, 'out_of_stock'),
      ('STG-DEMO-TBVS-003', NULL::numeric, NULL::numeric, NULL::numeric, 'Liên hệ báo giá', 'in_stock')
  ) AS v(
    "sku",
    "compatibility_price",
    "original_price",
    "sale_price",
    "price_display",
    "stock_status"
  )
  WHERE p."sku" = v."sku";

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> 3 THEN
    RAISE EXCEPTION 'Expected exactly three STG-DEMO Product contract fixtures';
  END IF;

  SELECT
    count(*) FILTER (
      WHERE "sku" = 'STG-DEMO-TBVS-001'
        AND "original_price" > 0
        AND "sale_price" IS NULL
        AND "stock_status" = 'in_stock'
    ),
    count(*) FILTER (
      WHERE "sku" = 'STG-DEMO-TBVS-002'
        AND "original_price" > 0
        AND "sale_price" IS NULL
        AND "stock_status" = 'out_of_stock'
    ),
    count(*) FILTER (
      WHERE "sku" = 'STG-DEMO-TBVS-003'
        AND "price" IS NULL
        AND "original_price" IS NULL
        AND "sale_price" IS NULL
    )
  INTO priced_in_stock_count, priced_out_of_stock_count, quote_only_count
  FROM "products"
  WHERE "sku" LIKE 'STG-DEMO-%';

  IF priced_in_stock_count <> 1
    OR priced_out_of_stock_count <> 1
    OR quote_only_count <> 1 THEN
    RAISE EXCEPTION 'STG-DEMO Product contract fixture validation failed';
  END IF;
END $$;

DO $$
DECLARE
  redirect_target_count integer;
BEGIN
  INSERT INTO "categories" (
    "name", "slug", "description", "icon_name", "is_active", "sort_order",
    "seo_title", "seo_description"
  )
  VALUES (
    '[STG-DEMO] Vật liệu nước', 'vat-lieu-nuoc',
    'Synthetic staging category. Do not copy to production.', 'Droplets', true, 30,
    '[STG-DEMO] Vật liệu nước',
    'Synthetic staging category for smoke testing.'
  )
  ON CONFLICT ("slug") DO NOTHING;

  INSERT INTO "subcategories" (
    "category_id", "name", "slug", "description", "icon_name", "is_active",
    "sort_order", "seo_title", "seo_description"
  )
  SELECT
    c."id", '[STG-DEMO] Máy nước nóng', 'may-nuoc-nong',
    'Synthetic staging redirect-target subcategory.', 'Droplets', true, 10,
    '[STG-DEMO] Máy nước nóng',
    'Synthetic staging redirect-target subcategory for smoke testing.'
  FROM "categories" c
  WHERE c."slug" = 'vat-lieu-nuoc'
  ON CONFLICT ("category_id", "slug") DO NOTHING;

  INSERT INTO "products" (
    "sku", "name", "slug", "category_id", "subcategory_id", "price",
    "original_price", "price_display", "description", "features", "specs",
    "image_main_url", "stock_status", "is_active", "publication_status",
    "pdp_visibility", "listing_visibility", "search_visibility", "listing_tier",
    "listing_priority", "data_quality_score", "sale_status", "price_state",
    "list_price", "sale_price", "price_source", "price_confidence",
    "sellable_status", "seo_indexing", "sitemap_include", "source_system",
    "source_confidence", "crawl_status"
  )
  SELECT
    v."sku", '[STG-DEMO] Redirect target ' || v."sku", v."slug", c."id", s."id",
    1000000.00, 1000000.00, NULL,
    'Synthetic redirect target for staging smoke tests only.',
    'Synthetic features only. Not production data.',
    '{"STG-DEMO Type":"Redirect target"}'::jsonb,
    'https://placehold.co/800x800?text=' || v."sku", 'in_stock', true, 'public',
    'public', 'default', 'visible', 1, 1, 100, 'available', 'known', 1000000.00,
    NULL, 'stg-demo', 'high', 'sellable', 'index', false, 'stg-demo', 'high', 'fresh'
  FROM (
    VALUES
      ('STG-DEMO-REDIRECT-001', 'may-nuoc-nong-da-nang-ket-hop-gian-tiep-va-truc-tiep-atmor-inline'),
      ('STG-DEMO-REDIRECT-002', 'may-nuoc-nong-gian-tiep-15l-atmor-at-15e'),
      ('STG-DEMO-REDIRECT-003', 'may-nuoc-nong-gian-tiep-30l-atmor-at-30e'),
      ('STG-DEMO-REDIRECT-004', 'may-nuoc-nong-gian-tiep-atmor-at-30h-at-50h-at-80h'),
      ('STG-DEMO-REDIRECT-005', 'may-nuoc-nong-gian-tiep-dieu-khien-tu-xa-atmor-at-50hr-at-80hr'),
      ('STG-DEMO-REDIRECT-006', 'may-nuoc-nong-gian-tiep-kieu-dung-atmor'),
      ('STG-DEMO-REDIRECT-007', 'may-nuoc-nong-gian-tiep-kieu-ngang-atmor-at-30eh-at-50eh-at-80eh'),
      ('STG-DEMO-REDIRECT-008', 'may-nuoc-nong-gian-tiep-kieu-ngang-atmor-at-30eht-at-50eht'),
      ('STG-DEMO-REDIRECT-009', 'may-nuoc-nong-truc-tiep-5kw-atmor-lotus'),
      ('STG-DEMO-REDIRECT-010', 'may-nuoc-nong-truc-tiep-5kw-atmor-new'),
      ('STG-DEMO-REDIRECT-011', 'may-nuoc-nong-truc-tiep-sieu-mong-3-5kw-atmor-at-368e'),
      ('STG-DEMO-REDIRECT-012', 'may-nuoc-nong-truc-tiep-sieu-mong-4-5kw-atmor-at-378ep')
  ) AS v("sku", "slug")
  JOIN "categories" c ON c."slug" = 'vat-lieu-nuoc'
  JOIN "subcategories" s ON s."slug" = 'may-nuoc-nong' AND s."category_id" = c."id"
  ON CONFLICT ("sku") DO UPDATE
  SET
    "name" = EXCLUDED."name",
    "slug" = EXCLUDED."slug",
    "category_id" = EXCLUDED."category_id",
    "subcategory_id" = EXCLUDED."subcategory_id",
    "price" = EXCLUDED."price",
    "original_price" = EXCLUDED."original_price",
    "description" = EXCLUDED."description",
    "image_main_url" = EXCLUDED."image_main_url",
    "stock_status" = EXCLUDED."stock_status",
    "is_active" = EXCLUDED."is_active",
    "publication_status" = EXCLUDED."publication_status",
    "pdp_visibility" = EXCLUDED."pdp_visibility",
    "listing_visibility" = EXCLUDED."listing_visibility",
    "search_visibility" = EXCLUDED."search_visibility",
    "listing_tier" = EXCLUDED."listing_tier",
    "listing_priority" = EXCLUDED."listing_priority",
    "data_quality_score" = EXCLUDED."data_quality_score",
    "sale_status" = EXCLUDED."sale_status",
    "price_state" = EXCLUDED."price_state",
    "list_price" = EXCLUDED."list_price",
    "sale_price" = EXCLUDED."sale_price",
    "price_source" = EXCLUDED."price_source",
    "price_confidence" = EXCLUDED."price_confidence",
    "sellable_status" = EXCLUDED."sellable_status",
    "seo_indexing" = EXCLUDED."seo_indexing",
    "sitemap_include" = EXCLUDED."sitemap_include",
    "source_system" = EXCLUDED."source_system",
    "source_confidence" = EXCLUDED."source_confidence",
    "crawl_status" = EXCLUDED."crawl_status",
    "updated_at" = CURRENT_TIMESTAMP;

  SELECT count(*)
  INTO redirect_target_count
  FROM "products" p
  JOIN "categories" c ON c."id" = p."category_id"
  JOIN "subcategories" s ON s."id" = p."subcategory_id"
  WHERE p."sku" LIKE 'STG-DEMO-REDIRECT-%'
    AND c."slug" = 'vat-lieu-nuoc'
    AND s."slug" = 'may-nuoc-nong'
    AND p."is_active" = true
    AND p."publication_status" = 'public'
    AND p."pdp_visibility" = 'public'
    AND p."search_visibility" = 'visible';

  IF redirect_target_count <> 12 THEN
    RAISE EXCEPTION 'Expected exactly twelve STG-DEMO redirect targets';
  END IF;
END $$;
