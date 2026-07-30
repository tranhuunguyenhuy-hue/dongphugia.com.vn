-- Review-only reconciliation queries.
-- Run these only after a separately approved export/import rehearsal.
-- Execute once against the approved Supabase source and once against the
-- self-hosted target, then compare results.
--
-- Do not paste connection strings into logs.

-- 1. Table counts for allowlisted runtime tables.
WITH table_counts AS (
  SELECT 'brands' AS table_name, count(*)::bigint AS row_count FROM brands
  UNION ALL SELECT 'categories', count(*) FROM categories
  UNION ALL SELECT 'subcategories', count(*) FROM subcategories
  UNION ALL SELECT 'product_types', count(*) FROM product_types
  UNION ALL SELECT 'product_sub_types', count(*) FROM product_sub_types
  UNION ALL SELECT 'colors', count(*) FROM colors
  UNION ALL SELECT 'origins', count(*) FROM origins
  UNION ALL SELECT 'materials', count(*) FROM materials
  UNION ALL SELECT 'product_features', count(*) FROM product_features
  UNION ALL SELECT 'filter_definitions', count(*) FROM filter_definitions
  UNION ALL SELECT 'spec_definitions', count(*) FROM spec_definitions
  UNION ALL SELECT 'spec_options', count(*) FROM spec_options
  UNION ALL SELECT 'products', count(*) FROM products
  UNION ALL SELECT 'product_images', count(*) FROM product_images
  UNION ALL SELECT 'product_relationships', count(*) FROM product_relationships
  UNION ALL SELECT 'product_feature_values', count(*) FROM product_feature_values
  UNION ALL SELECT 'product_secondary_subcategories', count(*) FROM product_secondary_subcategories
  UNION ALL SELECT 'product_variant_groups', count(*) FROM product_variant_groups
  UNION ALL SELECT 'product_descriptions', count(*) FROM product_descriptions
  UNION ALL SELECT 'product_documents', count(*) FROM product_documents
  UNION ALL SELECT 'product_package_items', count(*) FROM product_package_items
  UNION ALL SELECT 'product_source_mappings', count(*) FROM product_source_mappings
  UNION ALL SELECT 'product_spec_values', count(*) FROM product_spec_values
  UNION ALL SELECT 'catalog_taxons', count(*) FROM catalog_taxons
  UNION ALL SELECT 'product_taxon_assignments', count(*) FROM product_taxon_assignments
  UNION ALL SELECT 'external_taxonomy_mappings', count(*) FROM external_taxonomy_mappings
  UNION ALL SELECT 'product_attribute_values', count(*) FROM product_attribute_values
  UNION ALL SELECT 'blog_categories', count(*) FROM blog_categories
  UNION ALL SELECT 'blog_tags', count(*) FROM blog_tags
  UNION ALL SELECT 'blog_posts', count(*) FROM blog_posts
  UNION ALL SELECT 'blog_post_tags', count(*) FROM blog_post_tags
  UNION ALL SELECT 'banners', count(*) FROM banners
  UNION ALL SELECT 'partners', count(*) FROM partners
  UNION ALL SELECT 'projects', count(*) FROM projects
  UNION ALL SELECT 'redirects', count(*) FROM redirects
  UNION ALL SELECT 'admin_users', count(*) FROM admin_users
  UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs
  UNION ALL SELECT 'customers', count(*) FROM customers
  UNION ALL SELECT 'quote_requests', count(*) FROM quote_requests
  UNION ALL SELECT 'quote_items', count(*) FROM quote_items
  UNION ALL SELECT 'orders', count(*) FROM orders
  UNION ALL SELECT 'order_items', count(*) FROM order_items
)
SELECT table_name, row_count
FROM table_counts
ORDER BY table_name;

-- 2. Sensitive/excluded table sanity.
SELECT 'admin_sessions' AS table_name, count(*)::bigint AS row_count FROM admin_sessions
UNION ALL SELECT 'crawl_product_snapshots', count(*) FROM crawl_product_snapshots
UNION ALL SELECT 'crawl_import_decisions', count(*) FROM crawl_import_decisions
UNION ALL SELECT 'crawl_runs', count(*) FROM crawl_runs
ORDER BY table_name;

-- 3. Sequence reconciliation. Compare last_value and is_called source/target.
SELECT
  schemaname,
  sequencename,
  last_value,
  start_value,
  increment_by,
  cycle,
  cache_size
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY sequencename;

-- 4. Primary-key min/max checks for important tables.
SELECT 'products' AS table_name, min(id)::bigint AS min_id, max(id)::bigint AS max_id FROM products
UNION ALL SELECT 'orders', min(id), max(id) FROM orders
UNION ALL SELECT 'quote_requests', min(id), max(id) FROM quote_requests
UNION ALL SELECT 'customers', min(id), max(id) FROM customers
UNION ALL SELECT 'blog_posts', min(id), max(id) FROM blog_posts
UNION ALL SELECT 'admin_users', min(id), max(id) FROM admin_users
ORDER BY table_name;

-- 5. Lightweight deterministic checksums for key tables.
-- These are not cryptographic proofs of equality for all tables, but they make
-- accidental omissions visible during staging rehearsals.
WITH product_checksum AS (
  SELECT md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY id), '')) AS checksum
  FROM (
    SELECT id, sku, slug, category_id, subcategory_id, brand_id, updated_at
    FROM products
    ORDER BY id
  ) t
),
order_checksum AS (
  SELECT md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY id), '')) AS checksum
  FROM (
    SELECT id, order_number, status, payment_status, total, updated_at
    FROM orders
    ORDER BY id
  ) t
),
quote_checksum AS (
  SELECT md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY id), '')) AS checksum
  FROM (
    SELECT id, quote_number, status, customer_id, assigned_to, updated_at
    FROM quote_requests
    ORDER BY id
  ) t
),
blog_checksum AS (
  SELECT md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY id), '')) AS checksum
  FROM (
    SELECT id, slug, status, published_at, updated_at
    FROM blog_posts
    ORDER BY id
  ) t
)
SELECT 'products' AS table_name, checksum FROM product_checksum
UNION ALL SELECT 'orders', checksum FROM order_checksum
UNION ALL SELECT 'quote_requests', checksum FROM quote_checksum
UNION ALL SELECT 'blog_posts', checksum FROM blog_checksum
ORDER BY table_name;

-- 6. Referential-integrity smoke checks after restore.
SELECT 'products_without_category' AS check_name, count(*)::bigint AS failures
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE c.id IS NULL
UNION ALL
SELECT 'order_items_without_order', count(*)
FROM order_items oi
LEFT JOIN orders o ON o.id = oi.order_id
WHERE o.id IS NULL
UNION ALL
SELECT 'quote_items_without_quote', count(*)
FROM quote_items qi
LEFT JOIN quote_requests qr ON qr.id = qi.quote_id
WHERE qr.id IS NULL
UNION ALL
SELECT 'blog_posts_without_category', count(*)
FROM blog_posts bp
LEFT JOIN blog_categories bc ON bc.id = bp.category_id
WHERE bc.id IS NULL
ORDER BY check_name;
