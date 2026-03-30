# DB Audit Report — Đông Phú Gia

> Issue: LEO-290
> Ngày: 30/03/2026
> Tác giả: Claude Code
> Schema: `prisma/schema.prisma` (sau khi xóa dien_*/khoa_* — 43 models)
> **PM cần review + approve trước khi chuyển sang Sprint 2.**

---

## 1. Tổng quan 43 Models

### Nhóm theo chức năng

#### A. Shared / Infrastructure (13 models)
| Model | Mô tả | Dùng bởi |
|-------|--------|----------|
| `product_categories` | 5 danh mục chính | Tất cả categories |
| `colors` | Màu sắc sản phẩm | Gạch, TBVS, Bếp, Nước, Sàn gỗ |
| `origins` | Xuất xứ sản phẩm | Gạch, TBVS, Bếp, Nước, Sàn gỗ |
| `sizes` | Kích thước (m²) | Gạch ốp lát |
| `surfaces` | Bề mặt (mờ, bóng...) | Gạch ốp lát |
| `locations` | Vị trí lắp đặt | Gạch ốp lát |
| `product_colors` | Junction: products ↔ colors | Gạch ốp lát |
| `product_images` | Ảnh Gạch ốp lát | Gạch ốp lát |
| `product_locations` | Junction: products ↔ locations | Gạch ốp lát |
| `pattern_types` | Kiểu vân gạch | Gạch ốp lát |
| `collections` | Bộ sưu tập gạch | Gạch ốp lát |
| `quote_requests` | Yêu cầu báo giá | Tất cả |
| `redirects` | URL redirect management | SEO |

#### B. Gạch ốp lát (1 model — dùng shared tables)
| Model | Mô tả |
|-------|--------|
| `products` | Sản phẩm gạch ốp lát |

> Gạch ốp lát dùng `products` + `pattern_types` + `collections` + 6 shared tables (colors, origins, sizes, surfaces, locations, product_*)

#### C. TB Vệ sinh (8 models)
| Model | Mô tả |
|-------|--------|
| `tbvs_products` | Sản phẩm TBVS |
| `tbvs_product_types` | Loại sản phẩm TBVS |
| `tbvs_product_images` | Ảnh TBVS |
| `tbvs_brands` | Thương hiệu TBVS |
| `tbvs_subtypes` | Phân loại con TBVS |
| `tbvs_materials` | Chất liệu TBVS |
| `tbvs_technologies` | Công nghệ TBVS |
| `tbvs_product_technologies` | Junction: tbvs_products ↔ technologies |

#### D. TB Bếp (5 models)
| Model | Mô tả |
|-------|--------|
| `bep_products` | Sản phẩm TB Bếp |
| `bep_product_types` | Loại sản phẩm Bếp |
| `bep_product_images` | Ảnh Bếp |
| `bep_brands` | Thương hiệu Bếp |
| `bep_subtypes` | Phân loại con Bếp |

#### E. Vật liệu nước (6 models)
| Model | Mô tả |
|-------|--------|
| `nuoc_products` | Sản phẩm VL Nước |
| `nuoc_product_types` | Loại sản phẩm Nước |
| `nuoc_product_images` | Ảnh Nước |
| `nuoc_brands` | Thương hiệu Nước |
| `nuoc_subtypes` | Phân loại con Nước |
| `nuoc_materials` | Chất liệu Nước |

#### F. Sàn gỗ (3 models — đơn giản nhất)
| Model | Mô tả |
|-------|--------|
| `sango_products` | Sản phẩm Sàn gỗ |
| `sango_product_types` | Loại sản phẩm Sàn gỗ |
| `sango_product_images` | Ảnh Sàn gỗ |

#### G. Content / CMS (7 models)
| Model | Mô tả |
|-------|--------|
| `blog_posts` | Bài viết blog |
| `blog_categories` | Danh mục blog |
| `blog_tags` | Tags blog |
| `blog_post_tags` | Junction: posts ↔ tags |
| `banners` | Banner homepage |
| `partners` | Đối tác |
| `projects` | Dự án showcase |

---

## 2. Phân tích Trùng lặp

### 2.1 So sánh cấu trúc bảng product

| Field | products (Gạch) | tbvs_products | bep_products | nuoc_products | sango_products |
|-------|----------------|---------------|--------------|---------------|----------------|
| sku | ✅ | ✅ | ✅ | ✅ | ✅ |
| name | ✅ | ✅ | ✅ | ✅ | ✅ |
| slug | ✅ | ✅ | ✅ | ✅ | ✅ |
| description | ✅ | ✅ | ✅ | ✅ | ✅ |
| features | ✅ | ✅ | ✅ | ✅ | ✅ |
| specifications | ✅ (JSON) | ✅ (JSON) | ✅ (JSON) | ✅ (JSON) | ✅ (JSON) |
| price / price_display | ✅ | ✅ | ✅ | ✅ | ✅ |
| image_main_url | ✅ | ✅ | ✅ | ✅ | ✅ |
| image_hover_url | ✅ | ✅ | ✅ | ✅ | ✅ |
| is_active / is_featured | ✅ | ✅ | ✅ | ✅ | ✅ |
| is_new / is_bestseller | ✅ | ✅ | ✅ | ✅ | ✅ |
| stock_status | ✅ | ✅ | ✅ | ✅ | ✅ |
| sort_order | ✅ | ✅ | ✅ | ✅ | ✅ |
| seo_title / seo_description | ✅ | ✅ | ✅ | ✅ | ✅ |
| warranty_months | ✅ | ✅ | ✅ | ✅ | ✅ |
| brand_id (FK) | ❌ | ✅ | ✅ | ✅ | ❌ |
| origin_id (FK) | ✅ | ❌ | ✅ | ❌ | ✅ |
| color_id (FK) | ❌ (junction) | ✅ | ✅ | ✅ | ✅ |

> **Nhận xét:** ~85% columns giống nhau. Chỉ khác ở FK references (brand_id, origin_id, color_id).

### 2.2 So sánh bảng product_types

Tất cả `{cat}_product_types` có cùng structure:
- `id`, `category_id`, `name`, `slug`, `description`, `thumbnail_url`, `hero_image_url`
- `is_active`, `sort_order`, `seo_title`, `seo_description`, `created_at`, `updated_at`

> **100% trùng lặp** — chỉ khác tên bảng và FK category_id default value.

### 2.3 So sánh bảng brands

4 bảng brand riêng biệt (`tbvs_brands`, `bep_brands`, `nuoc_brands`) với **structure giống hệt nhau**:
- `id`, `name`, `slug`, `logo_url`, `description`, `origin_country`, `website_url`
- `is_active`, `is_featured`, `sort_order`, `created_at`, `updated_at`

> **100% trùng lặp** — một brand (Toto, Hafele, v.v.) bị lưu nhiều lần trong nhiều bảng.

### 2.4 So sánh bảng product_images

4 bảng image riêng biệt (`tbvs_product_images`, `bep_product_images`, `nuoc_product_images`, `sango_product_images`) — **structure giống hệt nhau**:
- `id`, `product_id`, `image_url`, `alt_text`, `sort_order`, `created_at`

> **100% trùng lặp.**

---

## 3. Đề xuất Schema Mới — 3 Phương án

### Phương án A: Gộp hoàn toàn (Full Unified) ⚡

**Ý tưởng:** Một bảng `catalog_products` + `catalog_product_types` + `catalog_product_images` cho tất cả danh mục.

```sql
-- Universal product table
CREATE TABLE catalog_products (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id   INT NOT NULL REFERENCES product_categories(id),
  product_type_id INT NOT NULL REFERENCES catalog_product_types(id),
  sku           TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  brand_id      INT REFERENCES brands(id),       -- unified brands table
  origin_id     INT REFERENCES origins(id),
  color_id      INT REFERENCES colors(id),
  specifications JSONB DEFAULT '{}',
  price         NUMERIC(15,0),
  price_display TEXT DEFAULT 'Liên hệ báo giá',
  image_main_url TEXT,
  image_hover_url TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_featured   BOOLEAN NOT NULL DEFAULT false,
  is_new        BOOLEAN NOT NULL DEFAULT false,
  is_bestseller BOOLEAN NOT NULL DEFAULT false,
  stock_status  TEXT NOT NULL DEFAULT 'in_stock',
  sort_order    INT DEFAULT 0,
  -- SEO (mới)
  meta_title        TEXT,
  meta_description  TEXT,
  -- Timestamps
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

**Pro:**
- ✅ Đơn giản, dễ query cross-category
- ✅ 1 `brands` table thay vì 3
- ✅ Cart/Order dễ implement (FK tới 1 bảng)
- ✅ Admin CMS có thể gộp lại
- ✅ ~53% giảm số bảng (43 → ~20)

**Con:**
- ❌ Migration effort: **cao** — rewrite 5 actions files + 5 API files + 5 admin sections
- ❌ TBVS có `technologies`, `materials` riêng — cần xử lý riêng
- ❌ Gạch ốp lát có `collections`, `pattern_types` — cần giữ riêng
- ❌ Risk: **cao** nếu migrate data sai

**Effort:** 3–4 tuần
**Risk:** Cao

---

### Phương án B: Hybrid (Unified Core + Category Extensions) 🎯 **RECOMMENDED cho V2**

**Ý tưởng:** Tạo `brands` table thống nhất + giữ nguyên 5 category product tables nhưng normalize FK references.

```sql
-- 1. Unified brands table (thay 3 bảng riêng)
CREATE TABLE brands (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  logo_url        TEXT,
  description     TEXT,
  origin_country  TEXT,
  website_url     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  is_featured     BOOLEAN NOT NULL DEFAULT false,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. Alter existing product tables: thay brand_id FK sang brands table mới
ALTER TABLE tbvs_products DROP CONSTRAINT tbvs_products_brand_id_fkey;
ALTER TABLE tbvs_products ADD CONSTRAINT tbvs_products_brand_id_fkey
  FOREIGN KEY (brand_id) REFERENCES brands(id);
-- (tương tự cho bep_products, nuoc_products)

-- 3. Drop 3 old brand tables sau khi migrate data
DROP TABLE tbvs_brands, bep_brands, nuoc_brands;

-- 4. Add SEO columns to all product tables (ALTER TABLE)
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_description TEXT;
-- (tương tự cho tbvs_products, bep_products, nuoc_products, sango_products)

-- 5. Cart/Order system (new tables)
-- (xem Mục 4)
```

**Pro:**
- ✅ Effort **thấp** — không rewrite actions/API
- ✅ Giải quyết brand duplication (một thương hiệu = một record)
- ✅ SEO columns được chuẩn hóa
- ✅ Cart/Order có thể reference `category + product_id`
- ✅ Risk: **thấp** — thay đổi incremental

**Con:**
- ❌ Vẫn còn 5 product tables riêng
- ❌ Cross-category search vẫn cần UNION

**Effort:** 1–2 tuần
**Risk:** Thấp

---

### Phương án C: Giữ nguyên + SEO + Cart 🐢

**Ý tưởng:** Không thay đổi schema hiện tại. Chỉ thêm SEO columns + Cart/Order tables mới.

```sql
-- Chỉ ADD COLUMN, không thay đổi structure
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_description TEXT;
-- repeat for all 5 product tables

-- Add Cart/Order tables
-- (xem Mục 4)
```

**Pro:**
- ✅ Effort **rất thấp** — không rewrite gì
- ✅ Zero risk
- ✅ Có thể hoàn thành trong 1 ngày

**Con:**
- ❌ Brand duplication vẫn còn
- ❌ Technical debt tiếp tục tích lũy
- ❌ Không cải thiện developer experience

**Effort:** 1 ngày
**Risk:** Gần như zero

---

## 4. Đề xuất Cart/Order System (mới)

> Dùng cho **Phương án B** hoặc **C**. Thiết kế cho V2.

```sql
-- Anonymous cart (session-based, no login required)
CREATE TABLE carts (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id    TEXT NOT NULL UNIQUE,         -- localStorage key
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  expires_at    TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days'
);
CREATE INDEX idx_carts_session ON carts(session_id);
CREATE INDEX idx_carts_expires ON carts(expires_at);

-- Cart items — denormalized product snapshot
CREATE TABLE cart_items (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cart_id         BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  -- Product reference (flexible — supports all 5 categories)
  category_slug   TEXT NOT NULL,              -- 'gach-op-lat', 'thiet-bi-ve-sinh', etc.
  product_id      INT NOT NULL,               -- ID trong bảng category tương ứng
  -- Snapshot tại thời điểm thêm vào giỏ
  product_name    TEXT NOT NULL,
  product_sku     TEXT NOT NULL,
  product_slug    TEXT NOT NULL,
  product_image   TEXT,
  price_display   TEXT DEFAULT 'Liên hệ báo giá',
  quantity        INT NOT NULL DEFAULT 1,
  notes           TEXT,                       -- ghi chú của khách
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);

-- Orders
CREATE TABLE orders (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_number    TEXT NOT NULL UNIQUE,       -- e.g., DPG-2026-001234
  -- Customer info
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  customer_email  TEXT,
  customer_address TEXT,
  -- Order details
  status          TEXT NOT NULL DEFAULT 'pending',
                                              -- pending | confirmed | processing | completed | cancelled
  payment_method  TEXT DEFAULT 'bank_transfer', -- bank_transfer | pay_later | cash
  notes           TEXT,
  -- Totals (snapshot, all items "liên hệ báo giá")
  total_items     INT NOT NULL DEFAULT 0,
  -- Timestamps
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  confirmed_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- Order items — full denormalized snapshot
CREATE TABLE order_items (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id        BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  category_slug   TEXT NOT NULL,
  product_id      INT NOT NULL,
  product_name    TEXT NOT NULL,
  product_sku     TEXT NOT NULL,
  product_image   TEXT,
  price_display   TEXT,
  quantity        INT NOT NULL DEFAULT 1,
  notes           TEXT
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
```

**Thiết kế decisions:**
- **Không có `price` số** — tất cả sản phẩm "Liên hệ báo giá" → chỉ cần `price_display` text
- **Denormalized product snapshot** — snapshot tại thời điểm đặt, không bị ảnh hưởng khi product thay đổi
- **`category_slug` + `product_id`** — flexible reference không cần single products table
- **Anonymous cart** — không cần đăng nhập (localStorage session_id)
- **`order_number` readable** — "DPG-2026-001234" thay vì UUID

---

## 5. SEO Columns cần bổ sung

> Áp dụng cho **tất cả 5 bảng product** + **product_types**.

### Bảng products / tbvs_products / bep_products / nuoc_products / sango_products

```sql
ALTER TABLE {table} ADD COLUMN IF NOT EXISTS meta_title TEXT;
-- Mục đích: <title> tag (60 chars max)
-- Nếu NULL → dùng name

ALTER TABLE {table} ADD COLUMN IF NOT EXISTS meta_description TEXT;
-- Mục đích: <meta name="description"> (160 chars max)
-- Nếu NULL → dùng description (truncated)

ALTER TABLE {table} ADD COLUMN IF NOT EXISTS og_image_url TEXT;
-- Mục đích: Open Graph image (1200x630)
-- Nếu NULL → dùng image_main_url
```

### Bảng {cat}_product_types / pattern_types

```sql
ALTER TABLE {table} ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE {table} ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE {table} ADD COLUMN IF NOT EXISTS og_image_url TEXT;
ALTER TABLE {table} ADD COLUMN IF NOT EXISTS canonical_url TEXT;
-- Mục đích: canonical URL cho paginated pages
```

> **Hiện tại `seo_title` và `seo_description` đã có** trong hầu hết bảng — chỉ cần thêm `og_image_url`. Nhưng nếu cần tách biệt `<title>` vs `seo_title` thì thêm `meta_title`.

---

## 6. Impact Assessment

### Phương án B (Recommended) — Impact breakdown

| Layer | Files bị ảnh hưởng | Effort |
|-------|-------------------|--------|
| **Schema** | `prisma/schema.prisma` | 1–2 giờ |
| **SQL Migration** | Tạo mới trong `scripts/db/` | 2–3 giờ |
| **Server Actions** | `src/lib/tbvs-actions.ts`, `bep-actions.ts`, `nuoc-actions.ts` — chỉ update brand_id FK | 2–3 giờ |
| **Public APIs** | `src/lib/public-api-tbvs.ts`, etc. — thêm brand include từ `brands` table | 1–2 giờ |
| **Admin CMS** | Brand selector trong 3 forms — point to unified `brands` table | 2–3 giờ |
| **Data Migration** | Script merge brands từ 3 bảng → 1 bảng, re-map IDs | 3–4 giờ |
| **Verify + Test** | Build, manual test | 2 giờ |

**Tổng: ~13–17 giờ (1.5–2 ngày)**

### Phương án A (Full Unified) — Impact breakdown

| Layer | Files bị ảnh hưởng | Effort |
|-------|-------------------|--------|
| **Schema** | Toàn bộ schema rewrite | 8+ giờ |
| **SQL Migration** | Complex migration với data rewrite | 8+ giờ |
| **Server Actions** | 5 actions files → 1 unified file | 8+ giờ |
| **Public APIs** | 5 API files → 1 unified + category filter | 6+ giờ |
| **Admin CMS** | 5 admin sections → rethink UX | 10+ giờ |
| **Frontend** | 5 category page structures → may need update | 4+ giờ |
| **Verify + Test** | Full E2E test | 4+ giờ |

**Tổng: ~48–60 giờ (6–8 ngày)**

---

## 7. Migration Plan cho Phương án B

### Step 1 — Chuẩn bị SQL (ngày 1)
```
1. Tạo scripts/db/migration-v2-unified-brands.sql
2. Tạo bảng brands mới (empty)
3. INSERT INTO brands SELECT DISTINCT FROM tbvs_brands, bep_brands, nuoc_brands (dedup by slug)
4. Tạo bảng carts, cart_items, orders, order_items
5. Thêm SEO columns (og_image_url) vào 5 bảng product
```

### Step 2 — Update FK references (ngày 1)
```
1. Tạo mapping table: old brand_id → new brands.id cho mỗi category
2. UPDATE tbvs_products SET brand_id = mapping.new_id WHERE ...
3. UPDATE bep_products SET brand_id = mapping.new_id WHERE ...
4. UPDATE nuoc_products SET brand_id = mapping.new_id WHERE ...
5. ALTER TABLE: thay FK constraint trỏ tới brands table mới
```

### Step 3 — Cập nhật code (ngày 2)
```
1. npx prisma db pull → cập nhật schema.prisma
2. npx prisma generate
3. Update tbvs-actions.ts, bep-actions.ts, nuoc-actions.ts
4. Update public-api-tbvs.ts, public-api-bep.ts, public-api-nuoc.ts
5. Update admin brand forms
6. npx tsc --noEmit → verify zero errors
```

### Step 4 — Cleanup (ngày 2)
```
1. Drop tbvs_brands, bep_brands, nuoc_brands (sau khi verify OK)
2. Final prisma db pull + generate
3. npm run build
4. Commit + push
```

### Rollback Strategy
```
-- Nếu có vấn đề sau khi drop old tables:
-- 1. Restore từ Supabase Point-in-Time Recovery (nếu có)
-- 2. Hoặc re-create bảng từ scripts/db/migration-rollback-v2.sql
-- 3. Revert code: git revert commit

-- Prevention:
-- - Chạy toàn bộ trong 1 transaction (nếu có thể)
-- - Giữ old brand tables song song ít nhất 24h trước khi drop
-- - Backup data trước khi chạy migration
```

---

## 8. Quyết định cần PM Review

Trước khi implement, PM cần trả lời:

| # | Câu hỏi | Options |
|---|---------|---------|
| 1 | **Chọn phương án nào?** | A (unified) / **B (hybrid)** / C (minimal) |
| 2 | **Cart cần làm ở Sprint 2 không?** | Có / Không (để Sprint 3) |
| 3 | **SEO columns: thêm ngay ở Sprint 2?** | Có (`og_image_url`) / Không |
| 4 | **Brand unification: ưu tiên không?** | Có / Không |
| 5 | **Gạch ốp lát có migrate sang `catalog_products` không?** | Có (Plan A) / Không (Plan B/C) |

---

## 9. Khuyến nghị

**Sprint 2 (ngay):** Phương án B — Thấp risk, giải quyết brand duplication + thêm Cart/Order.

**Sprint 3 (future):** Nếu cần cross-category search hoặc unified admin → migrate sang Phương án A.

**Ưu tiên thực hiện:**
1. ✅ LEO-291: Xóa dien_*/khoa_* (đã xong — 43 models)
2. 🔜 Unified `brands` table (Phương án B Step 1–4)
3. 🔜 Cart/Order tables mới
4. 🔜 SEO columns (`og_image_url`)

---

## Appendix: Danh sách 43 Models hiện tại

```
Shared (13):        product_categories, colors, origins, sizes, surfaces, locations,
                    product_colors, product_images, product_locations, pattern_types,
                    collections, quote_requests, redirects

Gạch ốp lát (1):   products

TBVS (8):          tbvs_products, tbvs_product_types, tbvs_product_images,
                   tbvs_brands, tbvs_subtypes, tbvs_materials,
                   tbvs_technologies, tbvs_product_technologies

Bếp (5):           bep_products, bep_product_types, bep_product_images,
                   bep_brands, bep_subtypes

Nước (6):          nuoc_products, nuoc_product_types, nuoc_product_images,
                   nuoc_brands, nuoc_subtypes, nuoc_materials

Sàn gỗ (3):        sango_products, sango_product_types, sango_product_images

Content (7):        blog_posts, blog_categories, blog_tags, blog_post_tags,
                   banners, partners, projects
```

> **Total: 43 models** (trước: 53, đã xóa 10 dien_*/khoa_*)
