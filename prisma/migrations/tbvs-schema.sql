-- ============================================================================
-- SCHEMA THIẾT BỊ VỆ SINH — ĐÔNG PHÚ GIA
-- ============================================================================
-- Ngày: 02/03/2026
-- LƯU Ý: KHÔNG sửa đổi bảng nào của Gạch ốp lát
-- ============================================================================

-- ===================
-- PHẦN A: TẠO BẢNG
-- ===================

-- 1. Loại sản phẩm TBVS (tương đương pattern_types)
CREATE TABLE IF NOT EXISTS tbvs_product_types (
    id              SERIAL PRIMARY KEY,
    category_id     INTEGER NOT NULL DEFAULT 2 REFERENCES product_categories(id),
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

-- 2. Loại con / Subtypes (tương đương collections, dùng làm filter)
CREATE TABLE IF NOT EXISTS tbvs_subtypes (
    id              SERIAL PRIMARY KEY,
    product_type_id INTEGER NOT NULL REFERENCES tbvs_product_types(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    thumbnail_url   VARCHAR(500),
    is_active       BOOLEAN DEFAULT TRUE,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Thương hiệu TBVS (riêng, không dùng chung với Gạch)
CREATE TABLE IF NOT EXISTS tbvs_brands (
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

-- 4. Chất liệu
CREATE TABLE IF NOT EXISTS tbvs_materials (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    sort_order  INTEGER DEFAULT 0
);

-- 5. Công nghệ
CREATE TABLE IF NOT EXISTS tbvs_technologies (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(50) NOT NULL UNIQUE,
    brand_id    INTEGER REFERENCES tbvs_brands(id),
    description TEXT,
    sort_order  INTEGER DEFAULT 0
);

-- 6. Sản phẩm TBVS
CREATE TABLE IF NOT EXISTS tbvs_products (
    id                  SERIAL PRIMARY KEY,
    sku                 VARCHAR(50) NOT NULL UNIQUE,
    name                VARCHAR(200) NOT NULL,
    slug                VARCHAR(200) NOT NULL UNIQUE,
    product_type_id     INTEGER NOT NULL REFERENCES tbvs_product_types(id),
    subtype_id          INTEGER REFERENCES tbvs_subtypes(id),
    brand_id            INTEGER REFERENCES tbvs_brands(id),
    material_id         INTEGER REFERENCES tbvs_materials(id),
    color_id            INTEGER REFERENCES colors(id),
    origin_id           INTEGER REFERENCES origins(id),
    description         TEXT,
    features            TEXT,
    specifications      JSONB,
    warranty_months     INTEGER DEFAULT 12,
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

-- 7. Quan hệ N-N: Sản phẩm - Công nghệ
CREATE TABLE IF NOT EXISTS tbvs_product_technologies (
    product_id      INTEGER NOT NULL REFERENCES tbvs_products(id) ON DELETE CASCADE,
    technology_id   INTEGER NOT NULL REFERENCES tbvs_technologies(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, technology_id)
);

-- 8. Ảnh phụ sản phẩm
CREATE TABLE IF NOT EXISTS tbvs_product_images (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES tbvs_products(id) ON DELETE CASCADE,
    image_url   VARCHAR(500) NOT NULL,
    alt_text    VARCHAR(200),
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===================
-- PHẦN B: INDEXES
-- ===================

CREATE INDEX IF NOT EXISTS idx_tbvs_products_type ON tbvs_products(product_type_id);
CREATE INDEX IF NOT EXISTS idx_tbvs_products_subtype ON tbvs_products(subtype_id);
CREATE INDEX IF NOT EXISTS idx_tbvs_products_brand ON tbvs_products(brand_id);
CREATE INDEX IF NOT EXISTS idx_tbvs_products_material ON tbvs_products(material_id);
CREATE INDEX IF NOT EXISTS idx_tbvs_products_color ON tbvs_products(color_id);
CREATE INDEX IF NOT EXISTS idx_tbvs_products_active ON tbvs_products(is_active);
CREATE INDEX IF NOT EXISTS idx_tbvs_products_featured ON tbvs_products(is_featured);
CREATE INDEX IF NOT EXISTS idx_tbvs_subtypes_type ON tbvs_subtypes(product_type_id);
CREATE INDEX IF NOT EXISTS idx_tbvs_technologies_brand ON tbvs_technologies(brand_id);
