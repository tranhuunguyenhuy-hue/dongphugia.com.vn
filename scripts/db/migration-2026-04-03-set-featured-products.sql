-- ============================================================
-- LEO-334: Set is_featured = true for homepage featured tabs
-- Date: 2026-04-03
-- Author: Antigravity Agent
-- Purpose: Populate homepage featured product tabs (TBVS, BEP, NUOC)
-- 
-- Strategy: Select 12 products per category that have:
--   1. is_active = true
--   2. image_main_url IS NOT NULL (must have photo)
--   3. Prioritize products with price > 0
--   4. Then by brand popularity (known brands first)
--   5. Then by sort_order
--
-- IMPORTANT: Run this in Supabase SQL Editor
-- This script is IDEMPOTENT - safe to run multiple times
-- ============================================================

BEGIN;

-- ─── STEP 0: Reset all featured flags first ───────────────────
-- This ensures clean state before setting new featured products
UPDATE tbvs_products SET is_featured = false WHERE is_featured = true;
UPDATE bep_products SET is_featured = false WHERE is_featured = true;
UPDATE nuoc_products SET is_featured = false WHERE is_featured = true;
UPDATE products SET is_featured = false WHERE is_featured = true;

-- ─── STEP 1: TBVS (Thiết bị vệ sinh) — 12 sản phẩm ──────────
-- Select top 12 active TBVS products with images, prioritize by price & brand
UPDATE tbvs_products
SET is_featured = true, updated_at = NOW()
WHERE id IN (
    SELECT p.id
    FROM tbvs_products p
    LEFT JOIN tbvs_brands b ON p.brand_id = b.id
    WHERE p.is_active = true
      AND p.image_main_url IS NOT NULL
      AND p.image_main_url != ''
    ORDER BY
        -- Prioritize products with actual price
        CASE WHEN p.price IS NOT NULL AND p.price > 0 THEN 0 ELSE 1 END,
        -- Prioritize well-known brands
        CASE 
            WHEN LOWER(b.name) IN ('toto', 'caesar', 'inax', 'kohler', 'american standard', 'grohe') THEN 0
            WHEN LOWER(b.name) IN ('viglacera', 'picenza', 'rangos', 'euroking') THEN 1
            ELSE 2
        END,
        p.sort_order ASC NULLS LAST,
        p.created_at DESC
    LIMIT 12
);

-- ─── STEP 2: BEP (Thiết bị bếp) — 12 sản phẩm ────────────────
UPDATE bep_products
SET is_featured = true, updated_at = NOW()
WHERE id IN (
    SELECT p.id
    FROM bep_products p
    LEFT JOIN bep_brands b ON p.brand_id = b.id
    WHERE p.is_active = true
      AND p.image_main_url IS NOT NULL
      AND p.image_main_url != ''
    ORDER BY
        CASE WHEN p.price IS NOT NULL AND p.price > 0 THEN 0 ELSE 1 END,
        CASE 
            WHEN LOWER(b.name) IN ('bosch', 'malloca', 'teka', 'hafele', 'electrolux', 'kaff') THEN 0
            WHEN LOWER(b.name) IN ('faster', 'canzy', 'sunhouse', 'ferroli') THEN 1
            ELSE 2
        END,
        p.sort_order ASC NULLS LAST,
        p.created_at DESC
    LIMIT 12
);

-- ─── STEP 3: NUOC (Máy nước nóng / Lọc nước) — 12 sản phẩm ──
UPDATE nuoc_products
SET is_featured = true, updated_at = NOW()
WHERE id IN (
    SELECT p.id
    FROM nuoc_products p
    LEFT JOIN nuoc_brands b ON p.brand_id = b.id
    WHERE p.is_active = true
      AND p.image_main_url IS NOT NULL
      AND p.image_main_url != ''
    ORDER BY
        CASE WHEN p.price IS NOT NULL AND p.price > 0 THEN 0 ELSE 1 END,
        CASE 
            WHEN LOWER(b.name) IN ('ariston', 'ferroli', 'panasonic', 'electrolux', 'kangaroo', 'ao smith') THEN 0
            WHEN LOWER(b.name) IN ('midea', 'sunhouse', 'casper', 'aqua') THEN 1
            ELSE 2
        END,
        p.sort_order ASC NULLS LAST,
        p.created_at DESC
    LIMIT 12
);

-- ─── STEP 4: PRODUCTS (Gạch ốp lát) — 12 sản phẩm ────────────
-- Note: products table uses different schema (no brand_id, uses collections)
UPDATE products
SET is_featured = true, updated_at = NOW()
WHERE id IN (
    SELECT p.id
    FROM products p
    WHERE p.is_active = true
      AND p.image_main_url IS NOT NULL
      AND p.image_main_url != ''
    ORDER BY
        p.sort_order ASC NULLS LAST,
        p.created_at DESC
    LIMIT 12
);

-- ─── VERIFICATION: Count featured products per table ───────────
SELECT 'tbvs_products' AS table_name, COUNT(*) AS featured_count 
FROM tbvs_products WHERE is_featured = true
UNION ALL
SELECT 'bep_products', COUNT(*) 
FROM bep_products WHERE is_featured = true
UNION ALL
SELECT 'nuoc_products', COUNT(*) 
FROM nuoc_products WHERE is_featured = true
UNION ALL
SELECT 'products (gach)', COUNT(*) 
FROM products WHERE is_featured = true;

COMMIT;
