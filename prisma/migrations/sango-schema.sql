-- ============================================================================
-- SCHEMA SÀN GỖ — ĐÔNG PHÚ GIA
-- ============================================================================
-- Danh mục: Sàn gỗ (category_id = 4)
-- Ngày: 02/03/2026
-- Đặc điểm: Schema đơn giản nhất - chỉ 3 bảng, không có brands/subtypes
-- ============================================================================

-- 1. Loại sản phẩm Sàn gỗ (chỉ 2 loại)
CREATE TABLE IF NOT EXISTS sango_product_types (
    id              SERIAL PRIMARY KEY,
    category_id     INTEGER NOT NULL DEFAULT 4 REFERENCES product_categories(id),
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

-- 2. Sản phẩm Sàn gỗ
CREATE TABLE IF NOT EXISTS sango_products (
    id                  SERIAL PRIMARY KEY,
    sku                 VARCHAR(50) NOT NULL UNIQUE,
    name                VARCHAR(200) NOT NULL,
    slug                VARCHAR(200) NOT NULL UNIQUE,
    product_type_id     INTEGER NOT NULL REFERENCES sango_product_types(id),

    -- Dùng chung
    color_id            INTEGER REFERENCES colors(id),
    origin_id           INTEGER REFERENCES origins(id),

    -- Thông số đặc thù cho sàn gỗ
    thickness_mm        INTEGER,            -- Độ dày (mm): 8, 12, 14...
    width_mm            INTEGER,            -- Chiều rộng (mm)
    length_mm           INTEGER,            -- Chiều dài (mm)
    ac_rating           VARCHAR(10),        -- Tiêu chuẩn AC: AC3, AC4, AC5
    warranty_years      INTEGER,            -- Bảo hành (năm)

    description         TEXT,
    features            TEXT,
    specifications      JSONB,
    price               DECIMAL(15,0),
    price_display       VARCHAR(50) DEFAULT 'Liên hệ báo giá',
    price_unit          VARCHAR(20) DEFAULT 'm²',
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

-- 3. Ảnh phụ sản phẩm
CREATE TABLE IF NOT EXISTS sango_product_images (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES sango_products(id) ON DELETE CASCADE,
    image_url   VARCHAR(500) NOT NULL,
    alt_text    VARCHAR(200),
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_sango_products_type      ON sango_products(product_type_id);
CREATE INDEX IF NOT EXISTS idx_sango_products_active    ON sango_products(is_active);
CREATE INDEX IF NOT EXISTS idx_sango_products_featured  ON sango_products(is_featured);
CREATE INDEX IF NOT EXISTS idx_sango_products_thickness ON sango_products(thickness_mm);
