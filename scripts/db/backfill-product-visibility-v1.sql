WITH classified AS (
  SELECT
    p.id,
    (p.hita_product_id IS NOT NULL OR p.source_url ILIKE '%hita.com.vn%') AS mapped,
    (
      COALESCE(NULLIF(p.sku, ''), '') <> ''
      AND COALESCE(NULLIF(p.name, ''), '') <> ''
      AND (
        p.hita_product_id IS NOT NULL
        OR p.source_url IS NOT NULL
        OR p.image_main_url IS NOT NULL
      )
    ) AS has_identity,
    (p.stock_status = 'discontinued') AS is_discontinued,
    (
      p.price IS NULL
      AND (
        p.price_display ILIKE '%liên hệ%'
        OR p.price_display ILIKE '%lien he%'
        OR p.stock_status ILIKE '%contact%'
      )
    ) AS is_contact,
    (COALESCE(p.is_master, true) = false) AS is_variant_child,
    (COALESCE(p.product_type, '') ILIKE '%phu-kien%') AS is_accessory,
    (
      0
      + CASE WHEN p.name IS NOT NULL AND p.name <> '' THEN 10 ELSE 0 END
      + CASE WHEN p.sku IS NOT NULL AND p.sku <> '' THEN 10 ELSE 0 END
      + CASE WHEN p.image_main_url IS NOT NULL AND p.image_main_url <> '' THEN 20 ELSE 0 END
      + CASE WHEN p.price IS NOT NULL THEN 20 ELSE 0 END
      + CASE WHEN p.description IS NOT NULL AND length(trim(p.description)) > 80 THEN 15 ELSE 0 END
      + CASE WHEN COALESCE(p.specs::jsonb, '{}'::jsonb) <> '{}'::jsonb THEN 15 ELSE 0 END
      + CASE WHEN p.hita_product_id IS NOT NULL OR p.source_url ILIKE '%hita.com.vn%' THEN 10 ELSE 0 END
    ) AS quality_score,
    CASE
      WHEN p.is_active OR p.hita_product_id IS NOT NULL OR p.source_url ILIKE '%hita.com.vn%' THEN 'public'
      ELSE 'private'
    END AS base_publication_status,
    CASE
      WHEN p.is_featured OR p.sort_order > 0 THEN 1
      WHEN COALESCE(p.is_master, true) = false OR COALESCE(p.product_type, '') ILIKE '%phu-kien%' THEN 3
      ELSE 2
    END AS base_listing_tier,
    CASE
      WHEN p.is_featured OR p.sort_order > 0 THEN 'strategic'
      WHEN COALESCE(p.is_master, true) = false THEN 'variant_child'
      WHEN COALESCE(p.product_type, '') ILIKE '%phu-kien%' THEN 'accessory'
      ELSE 'master_product'
    END AS base_listing_reason
  FROM products p
),
patched AS (
  SELECT
    c.*,
    CASE
      WHEN NOT c.has_identity THEN 'private'
      ELSE c.base_publication_status
    END AS publication_status_next,
    CASE
      WHEN c.is_discontinued THEN 'discontinued'
      WHEN c.is_contact THEN 'contact_for_price'
      WHEN p.price IS NULL THEN 'updating'
      ELSE 'available'
    END AS sale_status_next,
    CASE
      WHEN c.is_discontinued THEN 'discontinued'
      WHEN c.is_contact THEN 'contact'
      WHEN p.price IS NULL THEN 'updating'
      ELSE 'priced'
    END AS price_state_next
  FROM classified c
  JOIN products p ON p.id = c.id
)
UPDATE products p
SET
  publication_status = patched.publication_status_next,
  pdp_visibility = CASE WHEN patched.publication_status_next = 'public' THEN 'public' ELSE 'private' END,
  search_visibility = CASE WHEN patched.publication_status_next = 'public' THEN 'visible' ELSE 'hidden' END,
  listing_visibility = CASE
    WHEN patched.publication_status_next <> 'public' THEN 'hidden'
    WHEN patched.is_discontinued THEN 'search_only'
    WHEN patched.is_variant_child AND NOT (p.is_featured OR p.sort_order > 0) THEN 'search_only'
    WHEN patched.sale_status_next IN ('contact_for_price', 'updating') THEN
      CASE
        WHEN patched.is_variant_child AND NOT (p.is_featured OR p.sort_order > 0) THEN 'search_only'
        ELSE 'low_priority'
      END
    WHEN patched.is_accessory AND NOT (p.is_featured OR p.sort_order > 0) THEN 'low_priority'
    ELSE 'default'
  END,
  listing_tier = CASE
    WHEN patched.publication_status_next <> 'public' THEN 9
    WHEN patched.is_discontinued THEN 4
    WHEN patched.sale_status_next IN ('contact_for_price', 'updating') THEN GREATEST(patched.base_listing_tier, 3)
    ELSE patched.base_listing_tier
  END,
  listing_priority = CASE WHEN p.sort_order > 0 THEN p.sort_order ELSE 0 END,
  listing_reason = CASE
    WHEN patched.publication_status_next <> 'public' THEN 'private'
    WHEN patched.is_discontinued THEN 'discontinued'
    WHEN patched.sale_status_next IN ('contact_for_price', 'updating') THEN patched.sale_status_next
    ELSE patched.base_listing_reason
  END,
  data_quality_score = LEAST(patched.quality_score, 100),
  sale_status = patched.sale_status_next,
  price_state = patched.price_state_next,
  list_price = p.original_price,
  sale_price = p.price,
  price_source = CASE WHEN patched.mapped THEN 'hita' ELSE 'manual' END,
  price_confidence = CASE
    WHEN p.price IS NOT NULL OR patched.price_state_next IN ('contact', 'discontinued') THEN 'high'
    ELSE 'low'
  END,
  price_updated_at = CASE WHEN p.price IS NOT NULL THEN now() ELSE NULL END,
  sellable_status = CASE
    WHEN patched.sale_status_next = 'discontinued' THEN 'not_sellable'
    WHEN patched.sale_status_next IN ('contact_for_price', 'updating') THEN 'quote_only'
    ELSE 'sellable'
  END,
  seo_indexing = CASE
    WHEN patched.publication_status_next <> 'public' THEN 'noindex'
    WHEN patched.is_variant_child THEN 'canonical_to_parent'
    ELSE 'index'
  END,
  sitemap_include = CASE
    WHEN patched.publication_status_next <> 'public' THEN false
    WHEN patched.is_variant_child THEN false
    ELSE true
  END,
  source_system = CASE WHEN patched.mapped THEN 'hita' ELSE 'manual' END,
  source_confidence = CASE WHEN patched.mapped THEN 'high' ELSE 'medium' END,
  last_crawled_at = CASE WHEN patched.mapped THEN now() ELSE NULL END,
  crawl_status = CASE WHEN patched.mapped THEN 'fresh' ELSE 'unknown' END
FROM patched
WHERE p.id = patched.id;
