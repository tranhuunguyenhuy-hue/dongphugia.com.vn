-- Migration: Drop dien_* and khoa_* tables
-- Date: 2026-03-30
-- Issue: LEO-291
-- Context: dien_* (Điện) and khoa_* (Khóa) removed from project scope in V1.
-- These 10 tables are no longer used in any code.
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor).

-- Step 1: Drop image tables first (they have FK to products)
DROP TABLE IF EXISTS dien_product_images CASCADE;
DROP TABLE IF EXISTS khoa_product_images CASCADE;

-- Step 2: Drop product tables (they have FK to types, subtypes, brands, colors, origins)
DROP TABLE IF EXISTS dien_products CASCADE;
DROP TABLE IF EXISTS khoa_products CASCADE;

-- Step 3: Drop subtype tables (they have FK to product_types)
DROP TABLE IF EXISTS dien_subtypes CASCADE;
DROP TABLE IF EXISTS khoa_subtypes CASCADE;

-- Step 4: Drop product_types tables (they have FK to product_categories)
DROP TABLE IF EXISTS dien_product_types CASCADE;
DROP TABLE IF EXISTS khoa_product_types CASCADE;

-- Step 5: Drop brand tables (standalone)
DROP TABLE IF EXISTS dien_brands CASCADE;
DROP TABLE IF EXISTS khoa_brands CASCADE;

-- Verify: should return 0 rows
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'dien_%' OR table_name LIKE 'khoa_%';

-- After running this SQL:
-- 1. Run: npx prisma db pull  (sync schema from DB)
-- 2. Run: npx prisma generate  (regenerate Prisma Client)
-- 3. Restart dev server
-- Target: 43 models remaining (53 - 10 = 43)
