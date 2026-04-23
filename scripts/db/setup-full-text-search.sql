-- ============================================================
-- Full-Text Search Setup for Đông Phú Gia Products
-- Run via Supabase SQL Editor (direct connection, not pooler)
-- Created: 2026-04-21
-- ============================================================

-- Step 1: Add search_vector column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Step 2: Create update function using 'simple' dictionary
-- (works well for Vietnamese — no stemming, just lowercasing)
CREATE OR REPLACE FUNCTION products_search_vector_update()
RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector(
        'simple',
        coalesce(NEW.name, '') || ' ' ||
        coalesce(NEW.sku, '') || ' ' ||
        coalesce(array_to_string(string_to_array(regexp_replace(coalesce(NEW.sku, ''), '[^a-zA-Z0-9]', ' ', 'g'), ' '), ' '), '') || ' ' ||
        coalesce(substring(NEW.description from 1 for 500), '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Drop existing trigger if any, then recreate
DROP TRIGGER IF EXISTS products_search_vector_trigger ON products;
CREATE TRIGGER products_search_vector_trigger
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();

-- Step 4: Create GIN index for fast search
CREATE INDEX IF NOT EXISTS idx_products_search_vector
    ON products USING GIN(search_vector);

-- Step 5: Backfill existing products (bulk update)
-- This triggers the trigger and populates all existing rows
UPDATE products
SET updated_at = updated_at
WHERE search_vector IS NULL;

-- If the above is too slow (timeout), run in batches:
-- UPDATE products SET updated_at = updated_at WHERE id BETWEEN 1 AND 1000;
-- UPDATE products SET updated_at = updated_at WHERE id BETWEEN 1001 AND 2000;
-- etc.

-- Verification query:
-- SELECT COUNT(*) FROM products WHERE search_vector IS NOT NULL;
-- SELECT name, search_vector FROM products WHERE name ILIKE '%TOTO%' LIMIT 5;
-- SELECT name FROM products WHERE search_vector @@ to_tsquery('simple', 'TOTO:*') LIMIT 5;
