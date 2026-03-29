-- ============================================================================
-- DATABASE SCHEMA + SEED DATA — ĐÔNG PHÚ GIA
-- Danh mục: Gạch ốp lát (active) | 4 danh mục khác (disabled)
-- Mục đích: Test độ hoàn thiện
-- Ngày tạo: 01/03/2026
-- ============================================================================

-- ============================================================================
-- PHẦN 1: SCHEMA
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1.1 DANH MỤC SẢN PHẨM CẤP 1 (product_categories)
-- Gạch ốp lát, Thiết bị vệ sinh, Thiết bị bếp, Sàn gỗ, Vật liệu nước
-- --------------------------------------------------------------------------
CREATE TABLE product_categories (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    thumbnail_url   VARCHAR(500),
    is_active       BOOLEAN DEFAULT TRUE,
    sort_order      INTEGER DEFAULT 0,
    seo_title       VARCHAR(200),
    seo_description VARCHAR(500),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------------
-- 1.2 KIỂU VÂN / LOẠI GẠCH (pattern_types)
-- Cấp 2 dưới "Gạch ốp lát": Marble, Đá tự nhiên, Vân gỗ, Xi măng, Trang trí
-- --------------------------------------------------------------------------
CREATE TABLE pattern_types (
    id              SERIAL PRIMARY KEY,
    category_id     INTEGER NOT NULL REFERENCES product_categories(id),
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    thumbnail_url   VARCHAR(500),
    hero_image_url  VARCHAR(500),
    is_active       BOOLEAN DEFAULT TRUE,
    sort_order      INTEGER DEFAULT 0,
    seo_title       VARCHAR(200),
    seo_description VARCHAR(500),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------------
-- 1.3 THƯƠNG HIỆU (brands)
-- --------------------------------------------------------------------------
CREATE TABLE brands (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    logo_url        VARCHAR(500),
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------------
-- 1.4 BỘ SƯU TẬP (collections)
-- Thuộc 1 pattern_type. Dùng làm filter, KHÔNG có trang riêng.
-- --------------------------------------------------------------------------
CREATE TABLE collections (
    id              SERIAL PRIMARY KEY,
    pattern_type_id INTEGER NOT NULL REFERENCES pattern_types(id),
    brand_id        INTEGER REFERENCES brands(id),
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    tagline         VARCHAR(200),
    description     TEXT,
    thumbnail_url   VARCHAR(500),
    is_active       BOOLEAN DEFAULT TRUE,
    is_featured     BOOLEAN DEFAULT FALSE,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------------
-- 1.5 GIÁ TRỊ FILTER — BẢNG THAM CHIẾU
-- --------------------------------------------------------------------------

-- Màu sắc
CREATE TABLE colors (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(50) NOT NULL,
    slug    VARCHAR(50) NOT NULL UNIQUE,
    hex_code VARCHAR(7)
);

-- Bề mặt
CREATE TABLE surfaces (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(50) NOT NULL,
    slug    VARCHAR(50) NOT NULL UNIQUE
);

-- Kích thước
CREATE TABLE sizes (
    id          SERIAL PRIMARY KEY,
    label       VARCHAR(30) NOT NULL,
    slug        VARCHAR(30) NOT NULL UNIQUE,
    width_mm    INTEGER NOT NULL,
    height_mm   INTEGER NOT NULL,
    sort_order  INTEGER DEFAULT 0
);

-- Vị trí ốp lát
CREATE TABLE locations (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(50) NOT NULL,
    slug    VARCHAR(50) NOT NULL UNIQUE
);

-- Xuất xứ
CREATE TABLE origins (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(100) NOT NULL,
    slug    VARCHAR(50) NOT NULL UNIQUE
);

-- --------------------------------------------------------------------------
-- 1.6 SẢN PHẨM (products)
-- --------------------------------------------------------------------------
CREATE TABLE products (
    id                  SERIAL PRIMARY KEY,
    sku                 VARCHAR(50) NOT NULL UNIQUE,
    name                VARCHAR(200) NOT NULL,
    slug                VARCHAR(200) NOT NULL UNIQUE,
    pattern_type_id     INTEGER NOT NULL REFERENCES pattern_types(id),
    collection_id       INTEGER REFERENCES collections(id),
    brand_id            INTEGER REFERENCES brands(id),
    surface_id          INTEGER REFERENCES surfaces(id),
    size_id             INTEGER REFERENCES sizes(id),
    origin_id           INTEGER REFERENCES origins(id),
    description         TEXT,
    price_display       VARCHAR(50) DEFAULT 'Liên hệ báo giá',
    image_main_url      VARCHAR(500),
    image_hover_url     VARCHAR(500),
    is_active           BOOLEAN DEFAULT TRUE,
    is_featured         BOOLEAN DEFAULT FALSE,
    sort_order          INTEGER DEFAULT 0,
    seo_title           VARCHAR(200),
    seo_description     VARCHAR(500),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sản phẩm có thể có nhiều màu sắc
CREATE TABLE product_colors (
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    color_id    INTEGER NOT NULL REFERENCES colors(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, color_id)
);

-- Sản phẩm có thể lát ở nhiều vị trí
CREATE TABLE product_locations (
    product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    location_id  INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, location_id)
);

-- Ảnh phụ sản phẩm
CREATE TABLE product_images (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url   VARCHAR(500) NOT NULL,
    alt_text    VARCHAR(200),
    sort_order  INTEGER DEFAULT 0
);

-- --------------------------------------------------------------------------
-- 1.7 REDIRECT 301
-- --------------------------------------------------------------------------
CREATE TABLE redirects (
    id          SERIAL PRIMARY KEY,
    old_url     VARCHAR(500) NOT NULL UNIQUE,
    new_url     VARCHAR(500) NOT NULL,
    status_code INTEGER DEFAULT 301,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------------
-- 1.8 INDEXES
-- --------------------------------------------------------------------------
CREATE INDEX idx_products_pattern_type ON products(pattern_type_id);
CREATE INDEX idx_products_collection ON products(collection_id);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_surface ON products(surface_id);
CREATE INDEX idx_products_size ON products(size_id);
CREATE INDEX idx_products_origin ON products(origin_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_collections_pattern_type ON collections(pattern_type_id);
CREATE INDEX idx_pattern_types_category ON pattern_types(category_id);


-- ============================================================================
-- PHẦN 2: SEED DATA
-- ============================================================================

-- --------------------------------------------------------------------------
-- 2.1 DANH MỤC CẤP 1
-- --------------------------------------------------------------------------
INSERT INTO product_categories (id, name, slug, description, is_active, sort_order) VALUES
(1, 'Gạch ốp lát',       'gach-op-lat',       'Gạch ốp lát cao cấp từ các thương hiệu hàng đầu', TRUE,  1),
(2, 'Thiết bị vệ sinh',  'thiet-bi-ve-sinh',  'Thiết bị nhà tắm cao cấp',                         FALSE, 2),
(3, 'Thiết bị bếp',      'thiet-bi-bep',      'Thiết bị nhà bếp hiện đại',                         FALSE, 3),
(4, 'Sàn gỗ',            'san-go',            'Sàn gỗ công nghiệp và tự nhiên',                    FALSE, 4),
(5, 'Vật liệu nước',     'vat-lieu-nuoc',     'Máy lọc nước và thiết bị liên quan',                FALSE, 5);

-- --------------------------------------------------------------------------
-- 2.2 KIỂU VÂN (5 loại dưới Gạch ốp lát)
-- --------------------------------------------------------------------------
INSERT INTO pattern_types (id, category_id, name, slug, description, is_active, sort_order, seo_title, seo_description) VALUES
(1, 1, 'Gạch vân đá Marble',     'gach-van-da-marble',     'Gạch vân đá marble mang vẻ đẹp xa hoa và tinh tế nhờ các đường vân đá cẩm thạch tự nhiên, sắc nét, biến mỗi viên gạch thành một tác phẩm nghệ thuật độc đáo.', TRUE, 1, 'Gạch vân đá Marble cao cấp | Đông Phú Gia Đà Lạt', 'Khám phá bộ sưu tập gạch vân đá marble cao cấp tại Đông Phú Gia. Đa dạng mẫu mã từ Vietceramics, Eurotile, Super Stone. Showroom Đà Lạt.'),
(2, 1, 'Gạch vân đá tự nhiên',   'gach-van-da-tu-nhien',   'Gạch vân đá tự nhiên tái hiện hoàn hảo nét tinh túy của tạo hóa trên từng viên gạch, mang lại không gian sống đẳng cấp và bền vững theo thời gian.', TRUE, 2, 'Gạch vân đá tự nhiên cao cấp | Đông Phú Gia Đà Lạt', 'Gạch vân đá tự nhiên nhập khẩu chính hãng. Đa dạng bộ sưu tập travertine, đá phiến, terrazzo. Showroom Đà Lạt.'),
(3, 1, 'Gạch vân gỗ',            'gach-van-go',            'Gạch vân gỗ mang đến sự ấm cúng, gần gũi của gỗ tự nhiên nhưng sở hữu ưu điểm vượt trội về độ bền, chống thấm và chống trầy xước.', TRUE, 3, 'Gạch vân gỗ cao cấp | Đông Phú Gia Đà Lạt', 'Gạch giả gỗ cao cấp, vân gỗ chân thực. Nhiều kích thước và tông màu. Đông Phú Gia - Showroom VLXD Đà Lạt.'),
(4, 1, 'Gạch thiết kế xi măng',  'gach-thiet-ke-xi-mang',  'Gạch thiết kế xi măng mang phong cách công nghiệp hiện đại, tối giản nhưng đầy cá tính, phù hợp với xu hướng kiến trúc đương đại.', TRUE, 4, 'Gạch thiết kế xi măng | Đông Phú Gia Đà Lạt', 'Gạch xi măng phong cách industrial, loft hiện đại. Đa dạng màu sắc và kích thước tại Đông Phú Gia Đà Lạt.'),
(5, 1, 'Gạch trang trí',         'gach-trang-tri',         'Gạch trang trí là điểm nhấn nghệ thuật với hoa văn tinh xảo, màu sắc ấn tượng và hiệu ứng 3D sống động, biến mỗi góc nhỏ trở nên đầy lôi cuốn.', TRUE, 5, 'Gạch trang trí cao cấp | Đông Phú Gia Đà Lạt', 'Gạch trang trí độc đáo, hoa văn tinh xảo. Tạo điểm nhấn cho mọi không gian. Đông Phú Gia Đà Lạt.');

-- --------------------------------------------------------------------------
-- 2.3 THƯƠNG HIỆU
-- --------------------------------------------------------------------------
INSERT INTO brands (id, name, slug, description, is_active, sort_order) VALUES
(1, 'Vietceramics', 'vietceramics', 'Thương hiệu gạch ốp lát cao cấp nhập khẩu hàng đầu Việt Nam', TRUE, 1),
(2, 'Eurotile',     'eurotile',     'Gạch mô phỏng chất liệu tự nhiên với thiết kế độc đáo, nguyên bản', TRUE, 2),
(3, 'Super Stone',  'super-stone',  'Thương hiệu gạch ốp lát đa dạng, chất lượng từ Vietceramics', TRUE, 3);

-- --------------------------------------------------------------------------
-- 2.4 GIÁ TRỊ FILTER
-- --------------------------------------------------------------------------

INSERT INTO colors (id, name, slug, hex_code) VALUES
(1,  'Màu Đen',                'den',    '#1a1a1a'),
(2,  'Màu Hồng',               'hong',   '#e8a0a0'),
(3,  'Màu Kem',                'kem',    '#f5e6c8'),
(4,  'Màu Nâu',                'nau',    '#8b6914'),
(5,  'Màu Tím',                'tim',    '#7b5ea7'),
(6,  'Màu Trắng',              'trang',  '#f5f5f5'),
(7,  'Màu Xám',                'xam',    '#9e9e9e'),
(8,  'Màu Xanh dương/Xanh lá', 'xanh',   '#2e8b57');

INSERT INTO surfaces (id, name, slug) VALUES
(1, 'Bóng', 'bong'),
(2, 'Mờ',   'mo');

INSERT INTO sizes (id, label, slug, width_mm, height_mm, sort_order) VALUES
(1,  '30×30cm',    '300x300',   300,  300,   1),
(2,  '30×60cm',    '300x600',   300,  600,   2),
(3,  '40×80cm',    '400x800',   400,  800,   3),
(4,  '60×60cm',    '600x600',   600,  600,   4),
(5,  '60×120cm',   '600x1200',  600,  1200,  5),
(6,  '80×80cm',    '800x800',   800,  800,   6),
(7,  '80×160cm',   '800x1600',  800,  1600,  7),
(8,  '90×90cm',    '900x900',   900,  900,   8),
(9,  '90×180cm',   '900x1800',  900,  1800,  9),
(10, '100×100cm',  '1000x1000', 1000, 1000, 10),
(11, '120×120cm',  '1200x1200', 1200, 1200, 11),
(12, '120×240cm',  '1200x2400', 1200, 2400, 12),
(13, '120×278cm',  '1200x2780', 1200, 2780, 13),
(14, '75×150cm',   '750x1500',  750,  1500, 14),
(15, '20×120cm',   '200x1200',  200,  1200, 15),
(16, '15×90cm',    '150x900',   150,  900,  16);

INSERT INTO locations (id, name, slug) VALUES
(1, 'Tường', 'tuong'),
(2, 'Sàn',   'san');

INSERT INTO origins (id, name, slug) VALUES
(1, 'Ý',           'y'),
(2, 'Tây Ban Nha', 'tay-ban-nha'),
(3, 'Việt Nam',    'viet-nam'),
(4, 'Trung Quốc',  'trung-quoc'),
(5, 'Ấn Độ',       'an-do'),
(6, 'Malaysia',    'malaysia'),
(7, 'Thái Lan',    'thai-lan'),
(8, 'Indonesia',   'indonesia');

-- --------------------------------------------------------------------------
-- 2.5 BỘ SƯU TẬP
-- --------------------------------------------------------------------------

INSERT INTO collections (id, pattern_type_id, brand_id, name, slug, tagline, is_active, is_featured, sort_order) VALUES
(1,  1, 1, 'Onyce',              'onyce',              'Vẻ đẹp vạn hoa từ đá Onyx',            TRUE, TRUE,  1),
(2,  1, 1, 'Tele Di Marmo Lumia','tele-di-marmo-lumia','Khi ánh sáng cất lời',                  TRUE, TRUE,  2),
(3,  1, 1, 'Marvel Gala',        'marvel-gala',        'Vẻ đẹp phá cách',                       TRUE, TRUE,  3),
(4,  1, 1, 'Marvel X',           'marvel-x',           'Xu thế của tương lai',                   TRUE, TRUE,  4),
(5,  1, 1, 'Marvel Diva',        'marvel-diva',        'Chân dung của một Diva',                 TRUE, FALSE, 5),
(6,  1, 1, 'Marvel Meraviglia',  'marvel-meraviglia',  'Vẻ đẹp kỳ diệu của marble',             TRUE, FALSE, 6),
(7,  1, 1, 'Mystic',             'mystic',             'Vân marble huyền bí',                    TRUE, TRUE,  7),
(8,  1, 1, 'Akoya',              'akoya',              'Sắc ngọc trai trên đá marble',           TRUE, FALSE, 8),
(9,  1, 1, 'Calacatta Classico', 'calacatta-classico', 'Cảm hứng từ đá Carrara huyền thoại',    TRUE, FALSE, 9),
(10, 1, 1, 'Marmi Classici',     'marmi-classici',     'Tinh hoa marble cổ điển Ý',              TRUE, FALSE, 10),
(11, 1, 1, 'Jewels',             'jewels',             'Marble quý hiếm lấp lánh',               TRUE, FALSE, 11),
(12, 1, 1, 'Class',              'class',              'Tôn vinh vẻ đẹp cổ điển',                TRUE, FALSE, 12),
(13, 1, 1, 'Inside Art',         'inside-art',         'Nghệ thuật bên trong đá',                TRUE, FALSE, 13),
(14, 1, 1, 'Verona',             'verona',             'Nét đẹp thành Verona nước Ý',            TRUE, FALSE, 14),
(15, 2, 1, 'Marvel Travertine',  'marvel-travertine',  'Vẻ đẹp nguyên bản của travertine',       TRUE, TRUE,  1),
(16, 2, 1, 'Travertino',         'travertino',         'Ba sắc thái của đá travertine',           TRUE, TRUE,  2),
(17, 2, 1, 'Cosmopolita',        'cosmopolita',        'Đá tối giản cho không gian hiện đại',     TRUE, FALSE, 3),
(18, 2, 1, 'Quarrazzo',          'quarrazzo',          'Terrazzo giao hòa thạch anh Ý',           TRUE, FALSE, 4),
(19, 2, 1, 'Allure',             'allure',             'Phong cách cá tính của đá tự nhiên',      TRUE, FALSE, 5),
(20, 2, 1, 'Art Rock',           'art-rock',           'Nghệ thuật từ vân đá tự nhiên',           TRUE, FALSE, 6),
(21, 2, 1, 'Austral',            'austral',            'Vân đá mềm mại, hài hòa',                TRUE, FALSE, 7),
(22, 2, 3, 'Granite Lux',        'granite-lux',        'Đá granite sang trọng',                   TRUE, TRUE,  8),
(23, 3, 1, 'Log',                'log',                'Kiệt tác từ tình yêu với gỗ',            TRUE, TRUE,  1),
(24, 3, 1, 'Timber',             'timber',             'Gỗ tự nhiên đa sắc',                     TRUE, TRUE,  2),
(25, 3, 2, 'Oakwood',            'oakwood',            'Vân gỗ sồi thanh lịch',                  TRUE, FALSE, 3),
(26, 3, 2, 'Walnut Dream',       'walnut-dream',       'Gỗ óc chó ấm áp',                        TRUE, FALSE, 4),
(27, 3, 3, 'Teak Classic',       'teak-classic',       'Gỗ teak bền bỉ vượt thời gian',          TRUE, FALSE, 5),
(28, 4, 2, 'Urban Concrete',     'urban-concrete',     'Bê tông đô thị phong cách loft',          TRUE, TRUE,  1),
(29, 4, 2, 'Minimal Cement',     'minimal-cement',     'Xi măng tối giản tinh tế',                TRUE, TRUE,  2),
(30, 4, 1, 'Industrial Grey',    'industrial-grey',    'Xám công nghiệp đương đại',              TRUE, FALSE, 3),
(31, 4, 3, 'Rustic Cement',      'rustic-cement',      'Xi măng mộc mạc gần gũi',                TRUE, FALSE, 4),
(32, 5, 1, 'Papier',             'papier',             'Hướng đi mới cho gạch trang trí tường',   TRUE, TRUE,  1),
(33, 5, 2, 'Mosaic Art',         'mosaic-art',         'Nghệ thuật mosaic đương đại',             TRUE, TRUE,  2),
(34, 5, 2, 'Geometric',          'geometric',          'Hình học ấn tượng',                       TRUE, FALSE, 3),
(35, 5, 3, 'Floral Touch',       'floral-touch',       'Hoa lá nhẹ nhàng trang nhã',             TRUE, FALSE, 4);

-- --------------------------------------------------------------------------
-- 2.6 SẢN PHẨM — 60 SẢN PHẨM MẪU (12 SP × 5 KIỂU VÂN)
-- --------------------------------------------------------------------------

INSERT INTO products (id, sku, name, slug, pattern_type_id, collection_id, brand_id, surface_id, size_id, origin_id, is_active, is_featured) VALUES
(1,  '120278EN7Z',   'Gạch 120278EN7Z',   'gach-120278en7z',   1, 2,  1, 1, 13, 1, TRUE, TRUE),
(2,  '612MTWHCRMT',  'Gạch 612MTWHCRMT',  'gach-612mtwhcrmt',  1, 15, 1, 2, 5,  1, TRUE, FALSE),
(3,  '612MTSACRMT',  'Gạch 612MTSACRMT',  'gach-612mtsacrmt',  1, 15, 1, 2, 5,  1, TRUE, FALSE),
(4,  '612MXCAAPHA',  'Gạch 612MXCAAPHA',  'gach-612mxcaapha',  1, 4,  1, 1, 5,  1, TRUE, TRUE),
(5,  '612MYPE',      'Gạch 612MYPE',      'gach-612mype',      1, 7,  1, 2, 5,  1, TRUE, FALSE),
(6,  '612MYIV',      'Gạch 612MYIV',      'gach-612myiv',      1, 7,  1, 2, 5,  1, TRUE, FALSE),
(7,  '612MYOC',      'Gạch 612MYOC',      'gach-612myoc',      1, 7,  1, 1, 5,  1, TRUE, FALSE),
(8,  '612MYDA',      'Gạch 612MYDA',      'gach-612myda',      1, 7,  1, 2, 9,  1, TRUE, FALSE),
(9,  '918AKIVKRY',   'Gạch 918AKIVKRY',   'gach-918akivkry',   1, 8,  1, 1, 9,  1, TRUE, FALSE),
(10, '612PK612547',  'Gạch 612PK612547',  'gach-612pk612547',  1, 10, 1, 1, 5,  1, TRUE, FALSE),
(11, '612JW12',      'Gạch 612JW12',      'gach-612jw12',      1, 11, 1, 1, 5,  1, TRUE, FALSE),
(12, '36CACLWHYG',   'Gạch 36CACLWHYG',   'gach-36caclwhyg',   1, 9,  1, 1, 2,  1, TRUE, FALSE),
(13, 'TR612IVORY',   'Gạch TR612IVORY',   'gach-tr612ivory',   2, 16, 1, 2, 5,  1, TRUE, TRUE),
(14, 'TR612SAND',    'Gạch TR612SAND',    'gach-tr612sand',    2, 16, 1, 2, 5,  1, TRUE, FALSE),
(15, 'TR612GREY',    'Gạch TR612GREY',    'gach-tr612grey',    2, 16, 1, 1, 5,  1, TRUE, FALSE),
(16, 'COS612WHITE',  'Gạch COS612WHITE',  'gach-cos612white',  2, 17, 1, 2, 5,  2, TRUE, FALSE),
(17, 'COS612GREY',   'Gạch COS612GREY',   'gach-cos612grey',   2, 17, 1, 2, 5,  2, TRUE, FALSE),
(18, 'QRZ66BLACK',   'Gạch QRZ66BLACK',   'gach-qrz66black',   2, 18, 1, 2, 4,  1, TRUE, FALSE),
(19, 'QRZ66WHITE',   'Gạch QRZ66WHITE',   'gach-qrz66white',   2, 18, 1, 2, 4,  1, TRUE, FALSE),
(20, 'ALR612WARM',   'Gạch ALR612WARM',   'gach-alr612warm',   2, 19, 1, 2, 5,  1, TRUE, FALSE),
(21, 'ALR612COOL',   'Gạch ALR612COOL',   'gach-alr612cool',   2, 19, 1, 2, 5,  1, TRUE, FALSE),
(22, 'AR36STONE',    'Gạch AR36STONE',    'gach-ar36stone',    2, 20, 1, 2, 2,  1, TRUE, FALSE),
(23, 'AUS612BEIGE',  'Gạch AUS612BEIGE',  'gach-aus612beige',  2, 21, 1, 1, 5,  1, TRUE, FALSE),
(24, 'GL88NERO',     'Gạch GL88NERO',     'gach-gl88nero',     2, 22, 3, 1, 6,  4, TRUE, TRUE),
(25, 'LOG2012OAK',   'Gạch LOG2012OAK',   'gach-log2012oak',   3, 23, 1, 2, 15, 1, TRUE, TRUE),
(26, 'LOG2012WALNT', 'Gạch LOG2012WALNT', 'gach-log2012walnt', 3, 23, 1, 2, 15, 1, TRUE, FALSE),
(27, 'LOG2012MAPLE', 'Gạch LOG2012MAPLE', 'gach-log2012maple', 3, 23, 1, 2, 15, 1, TRUE, FALSE),
(28, 'TMB159BROWN',  'Gạch TMB159BROWN',  'gach-tmb159brown',  3, 24, 1, 2, 16, 1, TRUE, TRUE),
(29, 'TMB159BEIGE',  'Gạch TMB159BEIGE',  'gach-tmb159beige',  3, 24, 1, 2, 16, 1, TRUE, FALSE),
(30, 'TMB159GREY',   'Gạch TMB159GREY',   'gach-tmb159grey',   3, 24, 1, 2, 16, 1, TRUE, FALSE),
(31, 'OW2012LIGHT',  'Gạch OW2012LIGHT',  'gach-ow2012light',  3, 25, 2, 2, 15, 3, TRUE, FALSE),
(32, 'OW2012HONEY',  'Gạch OW2012HONEY',  'gach-ow2012honey',  3, 25, 2, 2, 15, 3, TRUE, FALSE),
(33, 'WD2012DARK',   'Gạch WD2012DARK',   'gach-wd2012dark',   3, 26, 2, 2, 15, 3, TRUE, FALSE),
(34, 'WD2012CARAML', 'Gạch WD2012CARAML', 'gach-wd2012caraml', 3, 26, 2, 2, 15, 3, TRUE, FALSE),
(35, 'TK159NATURAL', 'Gạch TK159NATURAL', 'gach-tk159natural', 3, 27, 3, 2, 16, 6, TRUE, FALSE),
(36, 'TK159AGED',    'Gạch TK159AGED',    'gach-tk159aged',    3, 27, 3, 2, 16, 6, TRUE, FALSE),
(37, 'UC66ANTHRCTE', 'Gạch UC66ANTHRCTE', 'gach-uc66anthrcte', 4, 28, 2, 2, 4,  3, TRUE, TRUE),
(38, 'UC66LIGHTGR',  'Gạch UC66LIGHTGR',  'gach-uc66lightgr',  4, 28, 2, 2, 4,  3, TRUE, FALSE),
(39, 'UC612DARKGR',  'Gạch UC612DARKGR',  'gach-uc612darkgr',  4, 28, 2, 2, 5,  3, TRUE, FALSE),
(40, 'MC66IVORY',    'Gạch MC66IVORY',    'gach-mc66ivory',    4, 29, 2, 2, 4,  3, TRUE, TRUE),
(41, 'MC66ASH',      'Gạch MC66ASH',      'gach-mc66ash',      4, 29, 2, 2, 4,  3, TRUE, FALSE),
(42, 'MC612PEARL',   'Gạch MC612PEARL',   'gach-mc612pearl',   4, 29, 2, 2, 5,  3, TRUE, FALSE),
(43, 'IG88STEEL',    'Gạch IG88STEEL',    'gach-ig88steel',    4, 30, 1, 2, 6,  1, TRUE, FALSE),
(44, 'IG88CHARCOAL', 'Gạch IG88CHARCOAL', 'gach-ig88charcoal', 4, 30, 1, 2, 6,  1, TRUE, FALSE),
(45, 'IG612SMOKE',   'Gạch IG612SMOKE',   'gach-ig612smoke',   4, 30, 1, 2, 5,  1, TRUE, FALSE),
(46, 'RC66EARTH',    'Gạch RC66EARTH',    'gach-rc66earth',    4, 31, 3, 2, 4,  5, TRUE, FALSE),
(47, 'RC66SAND',     'Gạch RC66SAND',     'gach-rc66sand',     4, 31, 3, 2, 4,  5, TRUE, FALSE),
(48, 'RC612CLAY',    'Gạch RC612CLAY',    'gach-rc612clay',    4, 31, 3, 2, 5,  5, TRUE, FALSE),
(49, 'PAP3060WAVE',  'Gạch PAP3060WAVE',  'gach-pap3060wave',  5, 32, 1, 2, 2,  1, TRUE, TRUE),
(50, 'PAP3060PLEAT', 'Gạch PAP3060PLEAT', 'gach-pap3060pleat', 5, 32, 1, 2, 2,  1, TRUE, FALSE),
(51, 'PAP3060FOLD',  'Gạch PAP3060FOLD',  'gach-pap3060fold',  5, 32, 1, 2, 2,  1, TRUE, FALSE),
(52, 'MA3030HEX',    'Gạch MA3030HEX',    'gach-ma3030hex',    5, 33, 2, 2, 1,  3, TRUE, TRUE),
(53, 'MA3030FISH',   'Gạch MA3030FISH',   'gach-ma3030fish',   5, 33, 2, 2, 1,  3, TRUE, FALSE),
(54, 'MA3030PENNY',  'Gạch MA3030PENNY',  'gach-ma3030penny',  5, 33, 2, 1, 1,  3, TRUE, FALSE),
(55, 'GEO3060TRI',   'Gạch GEO3060TRI',   'gach-geo3060tri',   5, 34, 2, 2, 2,  3, TRUE, FALSE),
(56, 'GEO3060DMND',  'Gạch GEO3060DMND',  'gach-geo3060dmnd',  5, 34, 2, 2, 2,  3, TRUE, FALSE),
(57, 'GEO3060CHEV',  'Gạch GEO3060CHEV',  'gach-geo3060chev',  5, 34, 2, 1, 2,  3, TRUE, FALSE),
(58, 'FL3060LOTUS',  'Gạch FL3060LOTUS',  'gach-fl3060lotus',  5, 35, 3, 2, 2,  4, TRUE, FALSE),
(59, 'FL3060ORCHID', 'Gạch FL3060ORCHID', 'gach-fl3060orchid', 5, 35, 3, 2, 2,  4, TRUE, FALSE),
(60, 'FL3060BAMBOO', 'Gạch FL3060BAMBOO', 'gach-fl3060bamboo', 5, 35, 3, 2, 2,  4, TRUE, FALSE);

-- --------------------------------------------------------------------------
-- 2.7 PRODUCT COLORS
-- --------------------------------------------------------------------------
INSERT INTO product_colors (product_id, color_id) VALUES
(1, 6), (1, 7),   (2, 6),    (3, 3),    (4, 1), (4, 7),
(5, 3),            (6, 6),    (7, 3),    (8, 1),
(9, 6),            (10, 1),   (11, 6), (11, 7), (12, 6),
(13, 3),           (14, 3),   (15, 7),   (16, 6),
(17, 7),           (18, 1),   (19, 6),   (20, 3),
(21, 7),           (22, 7),   (23, 3),   (24, 1),
(25, 4),           (26, 4),   (27, 3),   (28, 4),
(29, 3),           (30, 7),   (31, 3),   (32, 4),
(33, 1),           (34, 4),   (35, 4),   (36, 4),
(37, 1),           (38, 7),   (39, 1),   (40, 3),
(41, 7),           (42, 6),   (43, 7),   (44, 1),
(45, 7),           (46, 4),   (47, 3),   (48, 4),
(49, 6),           (50, 6),   (51, 7),   (52, 8),
(53, 8),           (54, 6),   (55, 7),   (56, 1),
(57, 6),           (58, 2),   (59, 5),   (60, 8);

-- --------------------------------------------------------------------------
-- 2.8 PRODUCT LOCATIONS
-- --------------------------------------------------------------------------
INSERT INTO product_locations (product_id, location_id) VALUES
(1, 1), (1, 2),   (2, 1), (2, 2),   (3, 1), (3, 2),   (4, 1), (4, 2),
(5, 1), (5, 2),   (6, 1), (6, 2),   (7, 1), (7, 2),   (8, 1), (8, 2),
(9, 1), (9, 2),   (10, 1), (10, 2), (11, 1), (11, 2), (12, 1),
(13, 1), (13, 2), (14, 1), (14, 2), (15, 1), (15, 2), (16, 2),
(17, 2),          (18, 2),          (19, 2),          (20, 1),
(21, 1), (21, 2), (22, 2),          (23, 1), (23, 2), (24, 2),
(25, 2), (26, 2), (27, 2), (28, 2), (29, 2), (30, 2),
(31, 2), (32, 2), (33, 2), (34, 2), (35, 2), (36, 2),
(37, 1), (37, 2), (38, 1), (38, 2), (39, 2), (40, 1), (40, 2),
(41, 2),          (42, 1), (42, 2), (43, 2), (44, 2), (45, 2),
(46, 1), (46, 2), (47, 2),          (48, 2),
(49, 1), (50, 1), (51, 1), (52, 1), (53, 1), (54, 1),
(55, 1), (56, 1), (57, 1), (58, 1), (59, 1), (60, 1);

-- --------------------------------------------------------------------------
-- 2.9 REDIRECT 301
-- --------------------------------------------------------------------------
INSERT INTO redirects (old_url, new_url) VALUES
('/gach-op-lat.html',          '/san-pham/gach-op-lat/'),
('/gach-van-da-marble.html',   '/san-pham/gach-op-lat/gach-van-da-marble/'),
('/gach-van-da-tu-nhien.html', '/san-pham/gach-op-lat/gach-van-da-tu-nhien/'),
('/gach-van-go.html',          '/san-pham/gach-op-lat/gach-van-go/'),
('/gach-thiet-ke-xi-mang.html','/san-pham/gach-op-lat/gach-thiet-ke-xi-mang/'),
('/gach-trang-tri.html',       '/san-pham/gach-op-lat/gach-trang-tri/'),
('/gach-van-vai.html',         '/san-pham/gach-op-lat/gach-trang-tri/'),
('/gach-van-xuong-trang.html', '/san-pham/gach-op-lat/gach-van-da-marble/'),
('/gach-600-x-600mm.html',    '/san-pham/gach-op-lat/'),
('/gach-400-x-800-mm.html',   '/san-pham/gach-op-lat/'),
('/gach-195-x-1200-mm.html',  '/san-pham/gach-op-lat/'),
('/gach-800-x-800-mm.html',   '/san-pham/gach-op-lat/'),
('/gach-800-x-1600-mm.html',  '/san-pham/gach-op-lat/'),
('/gach-1200-x-2400-mm.html', '/san-pham/gach-op-lat/'),
('/gach-300-x-300-mm.html',   '/san-pham/gach-op-lat/'),
('/gach-600-x-1200-mm.html',  '/san-pham/gach-op-lat/'),
('/gach-1200-x-1200-mm.html', '/san-pham/gach-op-lat/'),
('/gach-200-x-200-mm.html',   '/san-pham/gach-op-lat/'),
('/gach-1000-x-1000-mm.html', '/san-pham/gach-op-lat/'),
('/gach-900-x-900-mm.html',   '/san-pham/gach-op-lat/'),
('/gach-600-x-900-mm.html',   '/san-pham/gach-op-lat/'),
('/gach-450-x-900-mm.html',   '/san-pham/gach-op-lat/'),
('/gach-300-x-900-mm.html',   '/san-pham/gach-op-lat/'),
('/gach-300-x-600-mm.html',   '/san-pham/gach-op-lat/'),
('/gach-250-x-1500-mm.html',  '/san-pham/gach-op-lat/'),
('/gach-240-x-660-mm.html',   '/san-pham/gach-op-lat/'),
('/gach-200-x-600-mm.html',   '/san-pham/gach-op-lat/'),
('/gach-150-x-800-mm.html',   '/san-pham/gach-op-lat/'),
('/gach-1200-x-2700-mm.html', '/san-pham/gach-op-lat/'),
('/gach-900-x-1800-mm.html',  '/san-pham/gach-op-lat/'),
('/gach-750-x-1500-mm.html',  '/san-pham/gach-op-lat/'),
('/gach-500-x-500-mm.html',   '/san-pham/gach-op-lat/'),
('/gach-400-x-400-mm.html',   '/san-pham/gach-op-lat/'),
('/gach-300-x-800-mm.html',   '/san-pham/gach-op-lat/'),
('/gach-250-x-500-mm.html',   '/san-pham/gach-op-lat/'),
('/gach-200-x-300-mm.html',   '/san-pham/gach-op-lat/'),
('/gach-200-x-1200-mm.html',  '/san-pham/gach-op-lat/'),
('/gach-150-x-900-mm.html',   '/san-pham/gach-op-lat/'),
('/gach-150-x-600-mm.html',   '/san-pham/gach-op-lat/');
