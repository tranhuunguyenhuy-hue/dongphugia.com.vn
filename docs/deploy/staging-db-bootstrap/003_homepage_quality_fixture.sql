-- Homepage-quality CI-only fixture. Run after the workflow normalizes the
-- shared STG-DEMO slugs; it deliberately does not alter that shared seed.
-- The data is synthetic and exists only in the ephemeral GitHub Actions DB.

INSERT INTO "subcategories" (
  "category_id", "name", "slug", "description", "icon_name", "is_active", "sort_order"
)
SELECT c."id", v."name", v."slug", 'Synthetic homepage-quality fixture only.', 'Bath', true, v."sort_order"
FROM (
  VALUES
    ('Lavabo HQ fixture', 'lavabo', 30),
    ('Bồn tắm HQ fixture', 'bon-tam', 40),
    ('Chậu rửa HQ fixture', 'chau-rua', 50),
    ('Phụ kiện HQ fixture', 'phu-kien', 60)
) AS v("name", "slug", "sort_order")
JOIN "categories" c ON c."slug" = 'thiet-bi-ve-sinh'
ON CONFLICT ("category_id", "slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "is_active" = EXCLUDED."is_active",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "products" (
  "sku",
  "name",
  "slug",
  "category_id",
  "subcategory_id",
  "price",
  "specs",
  "image_main_url",
  "stock_status",
  "is_active",
  "is_featured",
  "sort_order",
  "variant_group",
  "product_type",
  "publication_status",
  "pdp_visibility",
  "listing_visibility",
  "search_visibility"
)
SELECT
  v."sku",
  v."name",
  v."slug",
  c."id",
  s."id",
  1000000.00,
  '{}'::jsonb,
  '/banners/banner-kitchen.jpg',
  'in_stock',
  true,
  v."is_featured",
  v."sort_order",
  v."variant_group",
  v."product_type",
  'public',
  'public',
  'default',
  'visible'
FROM (
  VALUES
    -- Four priority families: one card per group, largest families first.
    ('HQ-TBVS-TOILET-01', 'HQ toilet family representative', 'hq-tbvs-toilet-representative', 'bon-cau', 'hq-toilet-family', true, 300, NULL),
    ('HQ-TBVS-TOILET-02', 'HQ toilet family variant', 'hq-tbvs-toilet-variant-a', 'bon-cau', 'hq-toilet-family', false, 299, NULL),
    ('HQ-TBVS-TOILET-03', 'HQ toilet family variant', 'hq-tbvs-toilet-variant-b', 'bon-cau', 'hq-toilet-family', false, 298, NULL),
    ('HQ-TBVS-LAVABO-01', 'HQ lavabo family representative', 'hq-tbvs-lavabo-representative', 'lavabo', 'hq-lavabo-family', false, 290, NULL),
    ('HQ-TBVS-LAVABO-02', 'HQ lavabo family variant', 'hq-tbvs-lavabo-variant-a', 'lavabo', 'hq-lavabo-family', false, 289, NULL),
    ('HQ-TBVS-BATHTUB-01', 'HQ bathtub family representative', 'hq-tbvs-bathtub-representative', 'bon-tam', 'hq-bathtub-family', false, 280, NULL),
    ('HQ-TBVS-BATHTUB-02', 'HQ bathtub family variant', 'hq-tbvs-bathtub-variant-a', 'bon-tam', 'hq-bathtub-family', false, 279, NULL),
    ('HQ-TBVS-SHOWER-01', 'HQ shower family representative', 'hq-tbvs-shower-representative', 'sen-tam', 'hq-shower-family', false, 270, NULL),
    ('HQ-TBVS-SHOWER-02', 'HQ shower family variant', 'hq-tbvs-shower-variant-a', 'sen-tam', 'hq-shower-family', false, 269, NULL),
    -- Four independent priority cards plus four fallback candidates.
    ('HQ-TBVS-TOILET-04', 'HQ toilet priority single', 'hq-tbvs-toilet-single', 'bon-cau', 'hq-toilet-single', false, 260, NULL),
    ('HQ-TBVS-LAVABO-03', 'HQ lavabo priority single', 'hq-tbvs-lavabo-single', 'lavabo', 'hq-lavabo-single', false, 250, NULL),
    ('HQ-TBVS-BATHTUB-03', 'HQ bathtub priority single', 'hq-tbvs-bathtub-single', 'bon-tam', 'hq-bathtub-single', false, 240, NULL),
    ('HQ-TBVS-SHOWER-03', 'HQ shower priority single', 'hq-tbvs-shower-single', 'sen-tam', 'hq-shower-single', false, 230, NULL),
    ('HQ-TBVS-FALLBACK-01', 'HQ fallback one', 'hq-tbvs-fallback-one', 'chau-rua', 'hq-fallback-one', false, 220, NULL),
    ('HQ-TBVS-FALLBACK-02', 'HQ fallback two', 'hq-tbvs-fallback-two', 'chau-rua', 'hq-fallback-two', false, 210, NULL),
    ('HQ-TBVS-FALLBACK-03', 'HQ fallback three', 'hq-tbvs-fallback-three', 'chau-rua', 'hq-fallback-three', false, 200, NULL),
    ('HQ-TBVS-FALLBACK-04', 'HQ fallback four', 'hq-tbvs-fallback-four', 'chau-rua', 'hq-fallback-four', false, 190, NULL),
    -- Must be excluded by semantic accessory filtering, never by its name.
    ('HQ-TBVS-ACCESSORY-01', 'HQ accessory control', 'hq-tbvs-accessory-control', 'phu-kien', 'hq-accessory-control', false, 400, 'phu-kien')
) AS v("sku", "name", "slug", "subcategory_slug", "variant_group", "is_featured", "sort_order", "product_type")
JOIN "categories" c ON c."slug" = 'thiet-bi-ve-sinh'
JOIN "subcategories" s ON s."slug" = v."subcategory_slug" AND s."category_id" = c."id"
ON CONFLICT ("sku") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "slug" = EXCLUDED."slug",
  "category_id" = EXCLUDED."category_id",
  "subcategory_id" = EXCLUDED."subcategory_id",
  "price" = EXCLUDED."price",
  "specs" = EXCLUDED."specs",
  "image_main_url" = EXCLUDED."image_main_url",
  "stock_status" = EXCLUDED."stock_status",
  "is_active" = EXCLUDED."is_active",
  "is_featured" = EXCLUDED."is_featured",
  "sort_order" = EXCLUDED."sort_order",
  "variant_group" = EXCLUDED."variant_group",
  "product_type" = EXCLUDED."product_type",
  "publication_status" = EXCLUDED."publication_status",
  "pdp_visibility" = EXCLUDED."pdp_visibility",
  "listing_visibility" = EXCLUDED."listing_visibility",
  "search_visibility" = EXCLUDED."search_visibility",
  "updated_at" = CURRENT_TIMESTAMP;
