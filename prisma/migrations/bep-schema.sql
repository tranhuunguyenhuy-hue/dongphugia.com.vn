-- ============================================================================
-- SCHEMA THIẾT BỊ BẾP — ĐÔNG PHÚ GIA
-- ============================================================================
-- Danh mục: Thiết bị bếp (category_id = 3)
-- Ngày: 01/03/2026
-- LƯU Ý: KHÔNG sửa đổi bảng nào của Gạch ốp lát hoặc TBVS
-- ============================================================================

-- ===================
-- PHẦN A: TẠO BẢNG
-- ===================

-- 1. Loại sản phẩm Bếp
CREATE TABLE IF NOT EXISTS bep_product_types (
    id              SERIAL PRIMARY KEY,
    category_id     INTEGER NOT NULL DEFAULT 3 REFERENCES product_categories(id),
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

-- 2. Loại con / Subtypes (filter)
CREATE TABLE IF NOT EXISTS bep_subtypes (
    id              SERIAL PRIMARY KEY,
    product_type_id INTEGER NOT NULL REFERENCES bep_product_types(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    thumbnail_url   VARCHAR(500),
    is_active       BOOLEAN DEFAULT TRUE,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Thương hiệu Bếp (riêng)
CREATE TABLE IF NOT EXISTS bep_brands (
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

-- 4. Sản phẩm Bếp
CREATE TABLE IF NOT EXISTS bep_products (
    id                  SERIAL PRIMARY KEY,
    sku                 VARCHAR(50) NOT NULL UNIQUE,
    name                VARCHAR(200) NOT NULL,
    slug                VARCHAR(200) NOT NULL UNIQUE,
    product_type_id     INTEGER NOT NULL REFERENCES bep_product_types(id),
    subtype_id          INTEGER REFERENCES bep_subtypes(id),
    brand_id            INTEGER REFERENCES bep_brands(id),
    color_id            INTEGER REFERENCES colors(id),
    origin_id           INTEGER REFERENCES origins(id),
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

-- 5. Ảnh phụ sản phẩm
CREATE TABLE IF NOT EXISTS bep_product_images (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES bep_products(id) ON DELETE CASCADE,
    image_url   VARCHAR(500) NOT NULL,
    alt_text    VARCHAR(200),
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===================
-- PHẦN B: INDEXES
-- ===================

CREATE INDEX IF NOT EXISTS idx_bep_products_type     ON bep_products(product_type_id);
CREATE INDEX IF NOT EXISTS idx_bep_products_subtype  ON bep_products(subtype_id);
CREATE INDEX IF NOT EXISTS idx_bep_products_brand    ON bep_products(brand_id);
CREATE INDEX IF NOT EXISTS idx_bep_products_active   ON bep_products(is_active);
CREATE INDEX IF NOT EXISTS idx_bep_products_featured ON bep_products(is_featured);
CREATE INDEX IF NOT EXISTS idx_bep_subtypes_type     ON bep_subtypes(product_type_id);
