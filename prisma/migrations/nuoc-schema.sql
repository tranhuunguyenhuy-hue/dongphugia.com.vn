-- ============================================================================
-- SCHEMA VẬT LIỆU NƯỚC — ĐÔNG PHÚ GIA
-- ============================================================================
-- Danh mục: Vật liệu nước (category_id = 5)
-- Ngày: 02/03/2026
-- ============================================================================

-- 1. Loại sản phẩm Nước
CREATE TABLE IF NOT EXISTS nuoc_product_types (
    id              SERIAL PRIMARY KEY,
    category_id     INTEGER NOT NULL DEFAULT 5 REFERENCES product_categories(id),
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    thumbnail_url   VARCHAR(500),
    hero_image_url  VARCHAR(500),
    icon_name       VARCHAR(50),
    is_active       BOOLEAN DEFAULT TRUE,
    sort_order      INTEGER DEFAULT 0,
    seo_title       VARCHAR(200),
    seo_description VARCHAR(500),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Loại con / Subtypes
CREATE TABLE IF NOT EXISTS nuoc_subtypes (
    id              SERIAL PRIMARY KEY,
    product_type_id INTEGER NOT NULL REFERENCES nuoc_product_types(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    thumbnail_url   VARCHAR(500),
    is_active       BOOLEAN DEFAULT TRUE,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Thương hiệu Nước
CREATE TABLE IF NOT EXISTS nuoc_brands (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    logo_url        VARCHAR(500),
    description     TEXT,
    origin_country  VARCHAR(100),
    website_url     VARCHAR(500),
    is_active       BOOLEAN DEFAULT TRUE,
    is_featured     BOOLEAN DEFAULT FALSE,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Chất liệu (cho Bồn nước)
CREATE TABLE IF NOT EXISTS nuoc_materials (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    sort_order  INTEGER DEFAULT 0
);

-- 5. Sản phẩm Nước
CREATE TABLE IF NOT EXISTS nuoc_products (
    id                  SERIAL PRIMARY KEY,
    sku                 VARCHAR(50) NOT NULL UNIQUE,
    name                VARCHAR(200) NOT NULL,
    slug                VARCHAR(200) NOT NULL UNIQUE,
    product_type_id     INTEGER NOT NULL REFERENCES nuoc_product_types(id),
    subtype_id          INTEGER REFERENCES nuoc_subtypes(id),
    brand_id            INTEGER REFERENCES nuoc_brands(id),
    material_id         INTEGER REFERENCES nuoc_materials(id),
    color_id            INTEGER REFERENCES colors(id),
    origin_id           INTEGER REFERENCES origins(id),

    -- Thông số đặc thù
    capacity_liters     INTEGER,
    power_watts         INTEGER,

    description         TEXT,
    features            TEXT,
    specifications      JSONB,
    warranty_months     INTEGER DEFAULT 24,
    price               DECIMAL(15,0),
    price_display       VARCHAR(50) DEFAULT 'Liên hệ báo giá',
    image_main_url      VARCHAR(500),
    image_hover_url     VARCHAR(500),
    is_active           BOOLEAN DEFAULT TRUE,
    is_featured         BOOLEAN DEFAULT FALSE,
    is_new              BOOLEAN DEFAULT FALSE,
    is_bestseller       BOOLEAN DEFAULT FALSE,
    stock_status        VARCHAR(20) DEFAULT 'in_stock',
    sort_order          INTEGER DEFAULT 0,
    seo_title           VARCHAR(200),
    seo_description     VARCHAR(500),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Ảnh phụ sản phẩm
CREATE TABLE IF NOT EXISTS nuoc_product_images (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES nuoc_products(id) ON DELETE CASCADE,
    image_url   VARCHAR(500) NOT NULL,
    alt_text    VARCHAR(200),
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_nuoc_products_type     ON nuoc_products(product_type_id);
CREATE INDEX IF NOT EXISTS idx_nuoc_products_subtype  ON nuoc_products(subtype_id);
CREATE INDEX IF NOT EXISTS idx_nuoc_products_brand    ON nuoc_products(brand_id);
CREATE INDEX IF NOT EXISTS idx_nuoc_products_material ON nuoc_products(material_id);
CREATE INDEX IF NOT EXISTS idx_nuoc_products_active   ON nuoc_products(is_active);
CREATE INDEX IF NOT EXISTS idx_nuoc_products_featured ON nuoc_products(is_featured);
CREATE INDEX IF NOT EXISTS idx_nuoc_products_capacity ON nuoc_products(capacity_liters);
CREATE INDEX IF NOT EXISTS idx_nuoc_subtypes_type     ON nuoc_subtypes(product_type_id);
