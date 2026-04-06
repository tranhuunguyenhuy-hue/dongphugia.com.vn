-- =============================================================================
-- LEO-366: V2 Database Schema Migration
-- Date: 2026-04-06
-- Author: Antigravity (Database Architect + Security Auditor + Backend Specialist)
-- Purpose: Restructure 53 legacy models → 22 unified tables
-- Target: Supabase PostgreSQL (run via SQL Editor)
--
-- ⚠️ DESTRUCTIVE MIGRATION — Run only after CSV backup is confirmed
-- =============================================================================

-- =====================================================
-- STEP 0: Create updated_at trigger function
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 1: DROP legacy tables (order matters — children first)
-- =====================================================

-- 1a. Drop junction/child tables first (FK dependencies)
DROP TABLE IF EXISTS product_colors CASCADE;
DROP TABLE IF EXISTS product_locations CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS tbvs_product_technologies CASCADE;
DROP TABLE IF EXISTS tbvs_product_images CASCADE;
DROP TABLE IF EXISTS bep_product_images CASCADE;
DROP TABLE IF EXISTS nuoc_product_images CASCADE;
DROP TABLE IF EXISTS sango_product_images CASCADE;

-- 1b. Drop product tables (depend on type/brand tables)
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS tbvs_products CASCADE;
DROP TABLE IF EXISTS bep_products CASCADE;
DROP TABLE IF EXISTS nuoc_products CASCADE;
DROP TABLE IF EXISTS sango_products CASCADE;

-- 1c. Drop subtype tables (depend on product_types)
DROP TABLE IF EXISTS tbvs_subtypes CASCADE;
DROP TABLE IF EXISTS bep_subtypes CASCADE;
DROP TABLE IF EXISTS nuoc_subtypes CASCADE;

-- 1d. Drop type/brand/taxonomy tables
DROP TABLE IF EXISTS tbvs_product_types CASCADE;
DROP TABLE IF EXISTS bep_product_types CASCADE;
DROP TABLE IF EXISTS nuoc_product_types CASCADE;
DROP TABLE IF EXISTS sango_product_types CASCADE;
DROP TABLE IF EXISTS tbvs_brands CASCADE;
DROP TABLE IF EXISTS bep_brands CASCADE;
DROP TABLE IF EXISTS nuoc_brands CASCADE;
DROP TABLE IF EXISTS tbvs_materials CASCADE;
DROP TABLE IF EXISTS nuoc_materials CASCADE;
DROP TABLE IF EXISTS tbvs_technologies CASCADE;

-- 1e. Drop old shared tables (will be recreated with new schema)
DROP TABLE IF EXISTS pattern_types CASCADE;
DROP TABLE IF EXISTS collections CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;
DROP TABLE IF EXISTS sizes CASCADE;
DROP TABLE IF EXISTS surfaces CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS colors CASCADE;
DROP TABLE IF EXISTS origins CASCADE;

-- 1f. Drop old quote_requests (will be recreated with new FK)
DROP TABLE IF EXISTS quote_requests CASCADE;

-- =====================================================
-- STEP 2: CREATE new unified schema (22 tables)
-- =====================================================

-- ─────────────────────────────────────────────────────
-- TABLE 1: categories (5 danh mục CL1)
-- ─────────────────────────────────────────────────────
CREATE TABLE categories (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    thumbnail_url   VARCHAR(1000),
    icon_name       VARCHAR(50),           -- Lucide icon key
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT NOT NULL DEFAULT 0,
    seo_title       VARCHAR(200),
    seo_description VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- TABLE 2: subcategories (21+ subcats, replaces 4 *_product_types)
-- ─────────────────────────────────────────────────────
CREATE TABLE subcategories (
    id              SERIAL PRIMARY KEY,
    category_id     INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    slug            VARCHAR(200) NOT NULL,
    description     TEXT,
    thumbnail_url   VARCHAR(1000),
    hero_image_url  VARCHAR(1000),
    icon_name       VARCHAR(50),           -- Lucide icon key
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT NOT NULL DEFAULT 0,
    seo_title       VARCHAR(200),
    seo_description VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(category_id, slug)
);

-- ─────────────────────────────────────────────────────
-- TABLE 3: brands (40+ unified, replaces 3 *_brands)
-- ─────────────────────────────────────────────────────
CREATE TABLE brands (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    slug            VARCHAR(200) NOT NULL UNIQUE,
    logo_url        VARCHAR(1000),
    description     TEXT,
    origin_country  VARCHAR(100),
    website_url     VARCHAR(500),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- TABLE 4: colors (shared lookup)
-- ─────────────────────────────────────────────────────
CREATE TABLE colors (
    id        SERIAL PRIMARY KEY,
    name      VARCHAR(50) NOT NULL,
    slug      VARCHAR(50) NOT NULL UNIQUE,
    hex_code  VARCHAR(7)
);

-- ─────────────────────────────────────────────────────
-- TABLE 5: origins (shared lookup)
-- ─────────────────────────────────────────────────────
CREATE TABLE origins (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE
);

-- ─────────────────────────────────────────────────────
-- TABLE 6: materials (shared lookup)
-- ─────────────────────────────────────────────────────
CREATE TABLE materials (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    sort_order  INT NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────────────
-- TABLE 7: products (UNIFIED — replaces 5 *_products tables)
-- ─────────────────────────────────────────────────────
CREATE TABLE products (
    id              SERIAL PRIMARY KEY,
    sku             VARCHAR(100) NOT NULL UNIQUE,
    name            VARCHAR(500) NOT NULL,
    slug            VARCHAR(500) NOT NULL,
    category_id     INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    subcategory_id  INT REFERENCES subcategories(id) ON DELETE SET NULL,
    brand_id        INT REFERENCES brands(id) ON DELETE SET NULL,
    origin_id       INT REFERENCES origins(id) ON DELETE SET NULL,
    color_id        INT REFERENCES colors(id) ON DELETE SET NULL,
    material_id     INT REFERENCES materials(id) ON DELETE SET NULL,
    
    -- Pricing
    price           DECIMAL(15, 2),
    price_display   VARCHAR(50) DEFAULT 'Liên hệ báo giá',
    
    -- Content
    description     TEXT,
    features        TEXT,                  -- Rich text features/highlights
    specs           JSONB NOT NULL DEFAULT '{}',  -- Key decision: JSONB over EAV
    warranty_months INT,
    
    -- Images (primary)
    image_main_url  VARCHAR(1000),
    image_hover_url VARCHAR(1000),
    
    -- Stock & Flags
    stock_status    VARCHAR(20) NOT NULL DEFAULT 'in_stock',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
    is_new          BOOLEAN NOT NULL DEFAULT FALSE,
    is_bestseller   BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order      INT NOT NULL DEFAULT 0,
    
    -- Data provenance (for hita import)
    source_url      VARCHAR(1000),         -- Original URL from hita
    hita_product_id VARCHAR(100),          -- ID from hita for dedup
    
    -- SEO
    seo_title       VARCHAR(200),
    seo_description VARCHAR(500),
    
    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Key decision: UNIQUE per category, not globally
    UNIQUE(category_id, slug)
);

-- ─────────────────────────────────────────────────────
-- TABLE 8: product_images (gallery, replaces 4 *_product_images)
-- ─────────────────────────────────────────────────────
CREATE TABLE product_images (
    id          SERIAL PRIMARY KEY,
    product_id  INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url   VARCHAR(1000) NOT NULL,
    alt_text    VARCHAR(300),
    image_type  VARCHAR(20) NOT NULL DEFAULT 'gallery',  -- main | gallery | hover
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- TABLE 9: product_features (Lớp 4 hita — feature filter icons)
-- ─────────────────────────────────────────────────────
CREATE TABLE product_features (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    icon_name   VARCHAR(50),               -- Lucide icon key (no icon_url)
    description TEXT,
    sort_order  INT NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────────────
-- TABLE 10: product_feature_values (Product ↔ Feature mapping)
-- ─────────────────────────────────────────────────────
CREATE TABLE product_feature_values (
    id          SERIAL PRIMARY KEY,
    product_id  INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    feature_id  INT NOT NULL REFERENCES product_features(id) ON DELETE CASCADE,
    value       VARCHAR(500),              -- e.g. "Có", "6L/3L", "Xả xoáy"
    
    UNIQUE(product_id, feature_id)
);

-- ─────────────────────────────────────────────────────
-- TABLE 11: filter_definitions (dynamic filter config per category/subcat)
-- ─────────────────────────────────────────────────────
CREATE TABLE filter_definitions (
    id              SERIAL PRIMARY KEY,
    category_id     INT REFERENCES categories(id) ON DELETE CASCADE,
    subcategory_id  INT REFERENCES subcategories(id) ON DELETE CASCADE,
    filter_key      VARCHAR(100) NOT NULL,   -- e.g. "brand", "material", "price_range"
    filter_label    VARCHAR(200) NOT NULL,   -- e.g. "Thương hiệu", "Chất liệu"
    filter_type     VARCHAR(50) NOT NULL DEFAULT 'select', -- select | range | boolean | multi
    options         JSONB,                    -- For select/multi: [{value, label}]
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- TABLE 12: orders (Cart/Checkout — Sprint 3)
-- ─────────────────────────────────────────────────────
CREATE TABLE orders (
    id              SERIAL PRIMARY KEY,
    order_number    VARCHAR(20) NOT NULL UNIQUE,   -- e.g. "DPG-000001"
    customer_name   VARCHAR(200) NOT NULL,
    customer_phone  VARCHAR(20) NOT NULL,
    customer_email  VARCHAR(200),
    customer_address TEXT,
    note            TEXT,
    subtotal        DECIMAL(15, 2) NOT NULL DEFAULT 0,
    shipping_fee    DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total           DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status          VARCHAR(30) NOT NULL DEFAULT 'pending',  -- pending | confirmed | shipping | delivered | cancelled
    payment_method  VARCHAR(50),                              -- cod | bank_transfer | vietqr
    payment_status  VARCHAR(30) NOT NULL DEFAULT 'unpaid',   -- unpaid | paid | refunded
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- TABLE 13: order_items
-- ─────────────────────────────────────────────────────
CREATE TABLE order_items (
    id          SERIAL PRIMARY KEY,
    order_id    INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id  INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name VARCHAR(500) NOT NULL,     -- Snapshot at order time
    product_sku  VARCHAR(100) NOT NULL,     -- Snapshot at order time
    quantity    INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price  DECIMAL(15, 2) NOT NULL,
    total_price DECIMAL(15, 2) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- TABLE 14: banners (kept from old schema, minor improvements)
-- ─────────────────────────────────────────────────────
-- NOTE: banners table already exists and is NOT dropped.
-- No changes needed for banners.

-- ─────────────────────────────────────────────────────
-- TABLE 15-18: blog_posts, blog_categories, blog_tags, blog_post_tags
-- ─────────────────────────────────────────────────────
-- NOTE: Blog tables already exist and are NOT dropped.
-- No changes needed for blog system.

-- ─────────────────────────────────────────────────────
-- TABLE 19: partners
-- ─────────────────────────────────────────────────────
-- NOTE: partners table already exists and is NOT dropped.
-- No changes needed.

-- ─────────────────────────────────────────────────────
-- TABLE 20: projects
-- ─────────────────────────────────────────────────────
-- NOTE: projects table already exists and is NOT dropped.
-- No changes needed.

-- ─────────────────────────────────────────────────────
-- TABLE 21: quote_requests (recreated with new product FK)
-- ─────────────────────────────────────────────────────
CREATE TABLE quote_requests (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    phone       VARCHAR(20) NOT NULL,
    email       VARCHAR(200),
    message     TEXT,
    product_id  INT REFERENCES products(id) ON DELETE SET NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | contacted | quoted | closed
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- TABLE 22: redirects
-- ─────────────────────────────────────────────────────
-- NOTE: redirects table already exists and is NOT dropped.
-- No changes needed.


-- =====================================================
-- STEP 3: CREATE INDEXES
-- =====================================================

-- categories
CREATE INDEX idx_categories_active ON categories(is_active);

-- subcategories
CREATE INDEX idx_subcategories_category ON subcategories(category_id);
CREATE INDEX idx_subcategories_active ON subcategories(is_active);

-- brands
CREATE INDEX idx_brands_active ON brands(is_active);
CREATE INDEX idx_brands_featured ON brands(is_featured);

-- products (critical for query performance)
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_subcategory ON products(subcategory_id);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_featured ON products(is_featured);
CREATE INDEX idx_products_bestseller ON products(is_bestseller);
CREATE INDEX idx_products_is_new ON products(is_new);
CREATE INDEX idx_products_sort ON products(sort_order);
CREATE INDEX idx_products_hita_id ON products(hita_product_id);
CREATE INDEX idx_products_created ON products(created_at DESC);

-- GIN index for JSONB specs (key PM decision)
CREATE INDEX idx_products_specs ON products USING GIN (specs);

-- product_images
CREATE INDEX idx_product_images_product ON product_images(product_id);
CREATE INDEX idx_product_images_type ON product_images(image_type);

-- product_feature_values
CREATE INDEX idx_pfv_product ON product_feature_values(product_id);
CREATE INDEX idx_pfv_feature ON product_feature_values(feature_id);

-- filter_definitions
CREATE INDEX idx_filter_def_category ON filter_definitions(category_id);
CREATE INDEX idx_filter_def_subcategory ON filter_definitions(subcategory_id);

-- orders
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_payment ON orders(payment_status);

-- order_items
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- quote_requests
CREATE INDEX idx_quote_requests_status ON quote_requests(status);
CREATE INDEX idx_quote_requests_created ON quote_requests(created_at DESC);
CREATE INDEX idx_quote_requests_product ON quote_requests(product_id);


-- =====================================================
-- STEP 4: CREATE TRIGGERS (auto-update updated_at)
-- =====================================================

CREATE TRIGGER set_updated_at_categories
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_subcategories
    BEFORE UPDATE ON subcategories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_brands
    BEFORE UPDATE ON brands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_products
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_orders
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_quote_requests
    BEFORE UPDATE ON quote_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =====================================================
-- STEP 5: SEED initial categories (5 danh mục CL1)
-- =====================================================
INSERT INTO categories (name, slug, description, icon_name, sort_order) VALUES
    ('Thiết bị vệ sinh', 'thiet-bi-ve-sinh', 'Bồn cầu, lavabo, sen tắm, phụ kiện phòng tắm', 'ShowerHead', 1),
    ('Thiết bị bếp', 'thiet-bi-bep', 'Chậu rửa, vòi rửa, bếp, máy hút mùi, lò nướng', 'ChefHat', 2),
    ('Vật liệu nước', 'vat-lieu-nuoc', 'Máy lọc nước, máy nước nóng, bồn nước', 'Droplets', 3),
    ('Sàn gỗ', 'san-go', 'Sàn gỗ công nghiệp, sàn gỗ tự nhiên, sàn nhựa', 'Layers', 4),
    ('Gạch ốp lát', 'gach-op-lat', 'Gạch men, gạch granite, gạch bông, gạch lát nền', 'BrickWall', 5);


-- =====================================================
-- STEP 6: RLS Policies (Security Auditor)
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE origins ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_feature_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE filter_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

-- Public read access for product-related tables
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public read subcategories" ON subcategories FOR SELECT USING (true);
CREATE POLICY "Public read brands" ON brands FOR SELECT USING (true);
CREATE POLICY "Public read colors" ON colors FOR SELECT USING (true);
CREATE POLICY "Public read origins" ON origins FOR SELECT USING (true);
CREATE POLICY "Public read materials" ON materials FOR SELECT USING (true);
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Public read product_images" ON product_images FOR SELECT USING (true);
CREATE POLICY "Public read product_features" ON product_features FOR SELECT USING (true);
CREATE POLICY "Public read product_feature_values" ON product_feature_values FOR SELECT USING (true);
CREATE POLICY "Public read filter_definitions" ON filter_definitions FOR SELECT USING (true);

-- Quote requests: public can insert, only authenticated can read/update
CREATE POLICY "Public insert quote_requests" ON quote_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated read quote_requests" ON quote_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update quote_requests" ON quote_requests FOR UPDATE USING (auth.role() = 'authenticated');

-- Orders: only authenticated can manage
CREATE POLICY "Authenticated all orders" ON orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated all order_items" ON order_items FOR ALL USING (auth.role() = 'authenticated');

-- Admin full access via service_role (Prisma uses service_role key)
-- Note: service_role bypasses RLS by default in Supabase


-- =====================================================
-- STEP 7: Verification queries
-- =====================================================

-- Verify table count (should be 14 new + 8 kept = 22 total for the schema)
DO $$
DECLARE
    new_table_count INT;
BEGIN
    SELECT COUNT(*) INTO new_table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name IN (
        'categories', 'subcategories', 'brands', 'colors', 'origins', 'materials',
        'products', 'product_images', 'product_features', 'product_feature_values',
        'filter_definitions', 'orders', 'order_items', 'quote_requests',
        'banners', 'blog_posts', 'blog_categories', 'blog_tags', 'blog_post_tags',
        'partners', 'projects', 'redirects'
      );
    
    IF new_table_count < 22 THEN
        RAISE WARNING 'Expected 22 tables, found %. Some tables may be missing.', new_table_count;
    ELSE
        RAISE NOTICE '✅ Migration verified: % tables found (expected 22)', new_table_count;
    END IF;
END $$;

-- Verify categories are seeded
SELECT id, name, slug, icon_name, sort_order FROM categories ORDER BY sort_order;

-- Show all tables in public schema
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
