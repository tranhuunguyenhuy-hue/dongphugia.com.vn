-- Dong Phu Gia existing staging-only taxonomy repair
-- Scope: synthetic STG-DEMO rows in the existing staging database only.
-- Safe properties:
-- - no DROP, TRUNCATE, DELETE, or production-domain data;
-- - creates canonical parent taxonomy only when absent;
-- - updates only the three fixed STG-DEMO product SKUs and their synthetic
--   taxonomy references;
-- - run with psql --set=ON_ERROR_STOP=1 --single-transaction.
--
-- This repair is needed only for a staging database bootstrapped by the
-- earlier seed revision, which used non-public stg-demo-* parent category
-- slugs. Fresh databases should use 002_seed_synthetic_stg_demo.sql instead.

INSERT INTO "categories" ("name", "slug", "description", "icon_name", "is_active", "sort_order", "seo_title", "seo_description")
VALUES
  ('[STG-DEMO] Thiết bị vệ sinh', 'thiet-bi-ve-sinh', 'Synthetic staging category. Do not copy to production.', 'Bath', true, 10, '[STG-DEMO] Thiết bị vệ sinh', 'Synthetic staging category for smoke testing.'),
  ('[STG-DEMO] Thiết bị bếp', 'thiet-bi-bep', 'Synthetic staging category. Do not copy to production.', 'ChefHat', true, 20, '[STG-DEMO] Thiết bị bếp', 'Synthetic staging category for smoke testing.')
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
  "filter_policy" = EXCLUDED."filter_policy",
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

UPDATE "products" p
SET
  "category_id" = c."id",
  "subcategory_id" = s."id",
  "product_type_id" = pt."id",
  "product_sub_type_id" = pst."id",
  "updated_at" = CURRENT_TIMESTAMP
FROM (
  VALUES
    ('STG-DEMO-TBVS-001', 'thiet-bi-ve-sinh', 'stg-demo-bon-cau', 'stg-demo-bon-cau-mot-khoi', 'stg-demo-basic'),
    ('STG-DEMO-TBVS-002', 'thiet-bi-ve-sinh', 'stg-demo-sen-tam', 'stg-demo-sen-tam-cay', 'stg-demo-premium'),
    ('STG-DEMO-BEP-001', 'thiet-bi-bep', 'stg-demo-voi-rua-chen', 'stg-demo-voi-bep', 'stg-demo-standard')
) AS v("sku", "category_slug", "subcategory_slug", "product_type_slug", "product_sub_type_slug")
JOIN "categories" c ON c."slug" = v."category_slug"
JOIN "subcategories" s ON s."slug" = v."subcategory_slug" AND s."category_id" = c."id"
JOIN "product_types" pt ON pt."slug" = v."product_type_slug" AND pt."subcategory_id" = s."id"
JOIN "product_sub_types" pst ON pst."slug" = v."product_sub_type_slug" AND pst."product_type_id" = pt."id"
WHERE p."sku" = v."sku";

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
