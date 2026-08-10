-- Dong Phu Gia staging database bootstrap seed
-- Scope: synthetic, non-sensitive STG-DEMO data only.
-- Safe properties:
-- - idempotent inserts/updates;
-- - no admin account;
-- - no customer, quote, order, session, or production data;
-- - no secrets, passwords, Supabase keys, or connection strings.
--
-- Execute only together with 001_schema_from_prisma.sql through the approved
-- runbook command, which wraps both files in one psql --single-transaction
-- boundary. This file intentionally does not open or close its own transaction.

INSERT INTO "origins" ("name", "slug")
VALUES
  ('[STG-DEMO] Việt Nam', 'stg-demo-viet-nam'),
  ('[STG-DEMO] Singapore', 'stg-demo-singapore')
ON CONFLICT ("slug") DO UPDATE
SET "name" = EXCLUDED."name";

INSERT INTO "materials" ("name", "slug", "description", "sort_order")
VALUES
  ('[STG-DEMO] Sứ demo', 'stg-demo-su', 'Synthetic material for staging smoke tests only.', 10),
  ('[STG-DEMO] Inox demo', 'stg-demo-inox', 'Synthetic material for staging smoke tests only.', 20)
ON CONFLICT ("slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "sort_order" = EXCLUDED."sort_order";

INSERT INTO "colors" ("name", "slug", "hex_code")
VALUES
  ('[STG-DEMO] Trắng', 'stg-demo-trang', '#FFFFFF'),
  ('[STG-DEMO] Xám', 'stg-demo-xam', '#808080')
ON CONFLICT ("slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "hex_code" = EXCLUDED."hex_code";

INSERT INTO "brands" ("name", "slug", "description", "origin_country", "is_active", "is_featured", "sort_order")
VALUES
  ('[STG-DEMO] Demo Sanitary Brand', 'stg-demo-sanitary-brand', 'Synthetic brand for staging smoke tests only.', '[STG-DEMO] Việt Nam', true, true, 10),
  ('[STG-DEMO] Demo Kitchen Brand', 'stg-demo-kitchen-brand', 'Synthetic brand for staging smoke tests only.', '[STG-DEMO] Singapore', true, false, 20)
ON CONFLICT ("slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "origin_country" = EXCLUDED."origin_country",
  "is_active" = EXCLUDED."is_active",
  "is_featured" = EXCLUDED."is_featured",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "categories" ("name", "slug", "description", "icon_name", "is_active", "sort_order", "seo_title", "seo_description")
VALUES
  ('[STG-DEMO] Thiết bị vệ sinh', 'thiet-bi-ve-sinh', 'Synthetic staging category. Do not copy to production.', 'Bath', true, 10, '[STG-DEMO] Thiết bị vệ sinh', 'Synthetic staging category for smoke testing.'),
  ('[STG-DEMO] Thiết bị bếp', 'thiet-bi-bep', 'Synthetic staging category. Do not copy to production.', 'ChefHat', true, 20, '[STG-DEMO] Thiết bị bếp', 'Synthetic staging category for smoke testing.'),
  ('[STG-DEMO] Vật liệu nước', 'vat-lieu-nuoc', 'Synthetic staging category. Do not copy to production.', 'Droplets', true, 30, '[STG-DEMO] Vật liệu nước', 'Synthetic staging category for smoke testing.'),
  ('[STG-DEMO] Gạch ốp lát', 'gach-op-lat', 'Synthetic staging category. Do not copy to production.', 'Grid3X3', true, 40, '[STG-DEMO] Gạch ốp lát', 'Synthetic staging category for smoke testing.')
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "subcategories" ("category_id", "name", "slug", "description", "icon_name", "is_active", "sort_order", "seo_title", "seo_description")
SELECT c."id", v."name", v."slug", v."description", v."icon_name", true, v."sort_order", v."seo_title", v."seo_description"
FROM (
  VALUES
    ('thiet-bi-ve-sinh', '[STG-DEMO] Bồn cầu', 'stg-demo-bon-cau', 'Synthetic staging subcategory.', 'Toilet', 10, '[STG-DEMO] Bồn cầu', 'Synthetic staging subcategory for smoke testing.'),
    ('thiet-bi-ve-sinh', '[STG-DEMO] Sen tắm', 'stg-demo-sen-tam', 'Synthetic staging subcategory.', 'ShowerHead', 20, '[STG-DEMO] Sen tắm', 'Synthetic staging subcategory for smoke testing.'),
    ('thiet-bi-bep', '[STG-DEMO] Vòi rửa chén', 'stg-demo-voi-rua-chen', 'Synthetic staging subcategory.', 'Waves', 10, '[STG-DEMO] Vòi rửa chén', 'Synthetic staging subcategory for smoke testing.')
) AS v("category_slug", "name", "slug", "description", "icon_name", "sort_order", "seo_title", "seo_description")
JOIN "categories" c ON c."slug" = v."category_slug"
ON CONFLICT ("category_id", "slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "icon_name" = EXCLUDED."icon_name",
  "is_active" = EXCLUDED."is_active",
  "sort_order" = EXCLUDED."sort_order",
  "seo_title" = EXCLUDED."seo_title",
  "seo_description" = EXCLUDED."seo_description",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "product_features" ("name", "slug", "icon_name", "description", "sort_order")
VALUES
  ('[STG-DEMO] Dễ vệ sinh', 'stg-demo-de-ve-sinh', 'Sparkles', 'Synthetic product feature for staging smoke tests only.', 10),
  ('[STG-DEMO] Tiết kiệm nước', 'stg-demo-tiet-kiem-nuoc', 'Droplet', 'Synthetic product feature for staging smoke tests only.', 20)
ON CONFLICT ("slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "icon_name" = EXCLUDED."icon_name",
  "description" = EXCLUDED."description",
  "sort_order" = EXCLUDED."sort_order";

INSERT INTO "product_types" ("subcategory_id", "slug", "name", "description", "sort_order", "is_active", "filter_policy")
SELECT s."id", v."slug", v."name", v."description", v."sort_order", true, '{}'::jsonb
FROM (
  VALUES
    ('thiet-bi-ve-sinh', 'stg-demo-bon-cau', 'stg-demo-bon-cau-mot-khoi', '[STG-DEMO] Bồn cầu một khối', 'Synthetic product type for staging.', 10),
    ('thiet-bi-ve-sinh', 'stg-demo-sen-tam', 'stg-demo-sen-tam-cay', '[STG-DEMO] Sen tắm cây', 'Synthetic product type for staging.', 20),
    ('thiet-bi-bep', 'stg-demo-voi-rua-chen', 'stg-demo-voi-bep', '[STG-DEMO] Vòi bếp', 'Synthetic product type for staging.', 30)
) AS v("category_slug", "subcategory_slug", "slug", "name", "description", "sort_order")
JOIN "categories" c ON c."slug" = v."category_slug"
JOIN "subcategories" s ON s."slug" = v."subcategory_slug" AND s."category_id" = c."id"
ON CONFLICT ("subcategory_id", "slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "sort_order" = EXCLUDED."sort_order",
  "is_active" = EXCLUDED."is_active",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "product_sub_types" ("product_type_id", "slug", "name", "sort_order", "is_active")
SELECT pt."id", v."slug", v."name", v."sort_order", true
FROM (
  VALUES
    ('thiet-bi-ve-sinh', 'stg-demo-bon-cau', 'stg-demo-bon-cau-mot-khoi', 'stg-demo-basic', '[STG-DEMO] Basic', 10),
    ('thiet-bi-ve-sinh', 'stg-demo-sen-tam', 'stg-demo-sen-tam-cay', 'stg-demo-premium', '[STG-DEMO] Premium', 20),
    ('thiet-bi-bep', 'stg-demo-voi-rua-chen', 'stg-demo-voi-bep', 'stg-demo-standard', '[STG-DEMO] Standard', 30)
) AS v("category_slug", "subcategory_slug", "product_type_slug", "slug", "name", "sort_order")
JOIN "categories" c ON c."slug" = v."category_slug"
JOIN "subcategories" s ON s."slug" = v."subcategory_slug" AND s."category_id" = c."id"
JOIN "product_types" pt ON pt."slug" = v."product_type_slug" AND pt."subcategory_id" = s."id"
ON CONFLICT ("product_type_id", "slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "sort_order" = EXCLUDED."sort_order",
  "is_active" = EXCLUDED."is_active";

INSERT INTO "products" (
  "sku",
  "name",
  "slug",
  "category_id",
  "subcategory_id",
  "brand_id",
  "origin_id",
  "color_id",
  "material_id",
  "product_type_id",
  "product_sub_type_id",
  "price",
  "price_display",
  "description",
  "features",
  "specs",
  "warranty_months",
  "image_main_url",
  "stock_status",
  "is_active",
  "is_featured",
  "is_home_featured",
  "publication_status",
  "pdp_visibility",
  "listing_visibility",
  "search_visibility",
  "listing_tier",
  "listing_priority",
  "sale_status",
  "price_state",
  "list_price",
  "sale_price",
  "price_source",
  "price_confidence",
  "sellable_status",
  "seo_indexing",
  "sitemap_include",
  "source_system",
  "source_confidence",
  "crawl_status",
  "data_quality_score"
)
SELECT
  v."sku",
  v."name",
  v."slug",
  c."id",
  s."id",
  b."id",
  o."id",
  co."id",
  m."id",
  pt."id",
  pst."id",
  v."price",
  'Liên hệ báo giá',
  v."description",
  v."features",
  v."specs"::jsonb,
  24,
  v."image_main_url",
  'in_stock',
  true,
  v."is_featured",
  v."is_home_featured",
  'public',
  'public',
  'default',
  'visible',
  1,
  v."listing_priority",
  'available',
  'known',
  v."price",
  v."price",
  'stg-demo',
  'high',
  'sellable',
  'index',
  false,
  'stg-demo',
  'high',
  'fresh',
  100
FROM (
  VALUES
    ('STG-DEMO-TBVS-001', '[STG-DEMO] Bồn cầu smoke test', 'stg-demo-bon-cau-smoke-test', 'thiet-bi-ve-sinh', 'stg-demo-bon-cau', 'stg-demo-sanitary-brand', 'stg-demo-viet-nam', 'stg-demo-trang', 'stg-demo-su', 'stg-demo-bon-cau-mot-khoi', 'stg-demo-basic', 2500000.00, 'Synthetic product for staging smoke tests only.', 'Synthetic features only. Not production data.', '{"STG-DEMO Loại":"Bồn cầu","STG-DEMO Màu":"Trắng"}', 'https://placehold.co/800x800?text=STG-DEMO-TBVS-001', true, true, 30),
    ('STG-DEMO-TBVS-002', '[STG-DEMO] Sen tắm smoke test', 'stg-demo-sen-tam-smoke-test', 'thiet-bi-ve-sinh', 'stg-demo-sen-tam', 'stg-demo-sanitary-brand', 'stg-demo-viet-nam', 'stg-demo-xam', 'stg-demo-inox', 'stg-demo-sen-tam-cay', 'stg-demo-premium', 1800000.00, 'Synthetic product for staging smoke tests only.', 'Synthetic features only. Not production data.', '{"STG-DEMO Loại":"Sen tắm","STG-DEMO Màu":"Xám"}', 'https://placehold.co/800x800?text=STG-DEMO-TBVS-002', true, false, 20),
    ('STG-DEMO-TBVS-003', '[STG-DEMO] Bồn cầu route smoke test A', 'stg-demo-bon-cau-route-a', 'thiet-bi-ve-sinh', 'stg-demo-bon-cau', 'stg-demo-sanitary-brand', 'stg-demo-viet-nam', 'stg-demo-trang', 'stg-demo-su', 'stg-demo-bon-cau-mot-khoi', 'stg-demo-basic', 2600000.00, 'Synthetic product for staging route tests only.', 'Synthetic features only. Not production data.', '{"STG-DEMO Loại":"Bồn cầu","STG-DEMO Màu":"Trắng"}', 'https://placehold.co/800x800?text=STG-DEMO-TBVS-003', false, false, 19),
    ('STG-DEMO-TBVS-004', '[STG-DEMO] Bồn cầu route smoke test B', 'stg-demo-bon-cau-route-b', 'thiet-bi-ve-sinh', 'stg-demo-bon-cau', 'stg-demo-sanitary-brand', 'stg-demo-viet-nam', 'stg-demo-trang', 'stg-demo-su', 'stg-demo-bon-cau-mot-khoi', 'stg-demo-basic', 2700000.00, 'Synthetic product for staging route tests only.', 'Synthetic features only. Not production data.', '{"STG-DEMO Loại":"Bồn cầu","STG-DEMO Màu":"Trắng"}', 'https://placehold.co/800x800?text=STG-DEMO-TBVS-004', false, false, 18),
    ('STG-DEMO-BEP-001', '[STG-DEMO] Vòi bếp smoke test', 'stg-demo-voi-bep-smoke-test', 'thiet-bi-bep', 'stg-demo-voi-rua-chen', 'stg-demo-kitchen-brand', 'stg-demo-singapore', 'stg-demo-xam', 'stg-demo-inox', 'stg-demo-voi-bep', 'stg-demo-standard', 1200000.00, 'Synthetic product for staging smoke tests only.', 'Synthetic features only. Not production data.', '{"STG-DEMO Loại":"Vòi bếp","STG-DEMO Màu":"Xám"}', 'https://placehold.co/800x800?text=STG-DEMO-BEP-001', false, true, 10)
) AS v(
  "sku",
  "name",
  "slug",
  "category_slug",
  "subcategory_slug",
  "brand_slug",
  "origin_slug",
  "color_slug",
  "material_slug",
  "product_type_slug",
  "product_sub_type_slug",
  "price",
  "description",
  "features",
  "specs",
  "image_main_url",
  "is_featured",
  "is_home_featured",
  "listing_priority"
)
JOIN "categories" c ON c."slug" = v."category_slug"
JOIN "subcategories" s ON s."slug" = v."subcategory_slug" AND s."category_id" = c."id"
JOIN "brands" b ON b."slug" = v."brand_slug"
JOIN "origins" o ON o."slug" = v."origin_slug"
JOIN "colors" co ON co."slug" = v."color_slug"
JOIN "materials" m ON m."slug" = v."material_slug"
JOIN "product_types" pt ON pt."slug" = v."product_type_slug" AND pt."subcategory_id" = s."id"
JOIN "product_sub_types" pst ON pst."slug" = v."product_sub_type_slug" AND pst."product_type_id" = pt."id"
ON CONFLICT ("sku") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "slug" = EXCLUDED."slug",
  "category_id" = EXCLUDED."category_id",
  "subcategory_id" = EXCLUDED."subcategory_id",
  "brand_id" = EXCLUDED."brand_id",
  "origin_id" = EXCLUDED."origin_id",
  "color_id" = EXCLUDED."color_id",
  "material_id" = EXCLUDED."material_id",
  "product_type_id" = EXCLUDED."product_type_id",
  "product_sub_type_id" = EXCLUDED."product_sub_type_id",
  "price" = EXCLUDED."price",
  "price_display" = EXCLUDED."price_display",
  "description" = EXCLUDED."description",
  "features" = EXCLUDED."features",
  "specs" = EXCLUDED."specs",
  "warranty_months" = EXCLUDED."warranty_months",
  "image_main_url" = EXCLUDED."image_main_url",
  "stock_status" = EXCLUDED."stock_status",
  "is_active" = EXCLUDED."is_active",
  "is_featured" = EXCLUDED."is_featured",
  "is_home_featured" = EXCLUDED."is_home_featured",
  "publication_status" = EXCLUDED."publication_status",
  "pdp_visibility" = EXCLUDED."pdp_visibility",
  "listing_visibility" = EXCLUDED."listing_visibility",
  "search_visibility" = EXCLUDED."search_visibility",
  "listing_tier" = EXCLUDED."listing_tier",
  "listing_priority" = EXCLUDED."listing_priority",
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
  "data_quality_score" = EXCLUDED."data_quality_score",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "filter_definitions" ("subcategory_id", "filter_key", "filter_label", "filter_type", "options", "sort_order", "is_active")
SELECT s."id", v."filter_key", v."filter_label", 'checkbox', v."options"::jsonb, v."sort_order", true
FROM (
  VALUES
    ('thiet-bi-ve-sinh', 'stg-demo-bon-cau', 'stg_demo_type', '[STG-DEMO] Loại', '{"source":"specs","values":["Bồn cầu"]}', 10),
    ('thiet-bi-ve-sinh', 'stg-demo-sen-tam', 'stg_demo_type', '[STG-DEMO] Loại', '{"source":"specs","values":["Sen tắm"]}', 10),
    ('thiet-bi-bep', 'stg-demo-voi-rua-chen', 'stg_demo_type', '[STG-DEMO] Loại', '{"source":"specs","values":["Vòi bếp"]}', 10)
) AS v("category_slug", "subcategory_slug", "filter_key", "filter_label", "options", "sort_order")
JOIN "categories" c ON c."slug" = v."category_slug"
JOIN "subcategories" s ON s."slug" = v."subcategory_slug" AND s."category_id" = c."id"
WHERE NOT EXISTS (
  SELECT 1
  FROM "filter_definitions" fd
  WHERE fd."subcategory_id" = s."id"
    AND fd."filter_key" = v."filter_key"
    AND fd."filter_label" = v."filter_label"
);

INSERT INTO "blog_categories" ("name", "slug", "description", "is_active", "sort_order", "seo_title", "seo_description")
VALUES
  ('[STG-DEMO] Blog staging', 'stg-demo-blog', 'Synthetic blog category for staging smoke tests only.', true, 10, '[STG-DEMO] Blog staging', 'Synthetic blog category for staging.')
ON CONFLICT ("slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "is_active" = EXCLUDED."is_active",
  "sort_order" = EXCLUDED."sort_order",
  "seo_title" = EXCLUDED."seo_title",
  "seo_description" = EXCLUDED."seo_description",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "blog_posts" (
  "title",
  "slug",
  "excerpt",
  "content",
  "category_id",
  "seo_title",
  "seo_description",
  "reading_time",
  "status",
  "published_at",
  "author_name",
  "is_featured",
  "is_pinned"
)
SELECT
  '[STG-DEMO] Bài viết staging smoke test',
  'stg-demo-blog-smoke-test',
  'Synthetic excerpt for staging smoke tests only.',
  '<p>[STG-DEMO] Synthetic blog content for staging smoke tests only.</p>',
  bc."id",
  '[STG-DEMO] Bài viết staging smoke test',
  'Synthetic blog post for staging smoke tests.',
  1,
  'published',
  CURRENT_TIMESTAMP,
  '[STG-DEMO] Đông Phú Gia staging',
  false,
  false
FROM "blog_categories" bc
WHERE bc."slug" = 'stg-demo-blog'
ON CONFLICT ("slug") DO UPDATE
SET
  "title" = EXCLUDED."title",
  "excerpt" = EXCLUDED."excerpt",
  "content" = EXCLUDED."content",
  "category_id" = EXCLUDED."category_id",
  "seo_title" = EXCLUDED."seo_title",
  "seo_description" = EXCLUDED."seo_description",
  "reading_time" = EXCLUDED."reading_time",
  "status" = EXCLUDED."status",
  "published_at" = EXCLUDED."published_at",
  "author_name" = EXCLUDED."author_name",
  "is_featured" = EXCLUDED."is_featured",
  "is_pinned" = EXCLUDED."is_pinned",
  "updated_at" = CURRENT_TIMESTAMP;
