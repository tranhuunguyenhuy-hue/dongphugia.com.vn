# PRD — Trang Chi Tiết Sản Phẩm (Product Detail)
**Dự án:** Đông Phú Gia V2
**Route:** `/san-pham/[categorySlug]/[productSlug]`
**Phiên bản:** 1.0 — 09/04/2026
**Dành cho:** Designer + Frontend Dev

---

## 1. Mục tiêu trang

1. **Trình bày đầy đủ thông tin sản phẩm** — ảnh, mô tả, thông số kỹ thuật
2. **Tạo trust** — brand info, xuất xứ, bảo hành
3. **Kích hoạt hành động** — "Thêm vào báo giá" / "Liên hệ ngay"
4. **Cross-sell** — sản phẩm tương tự cùng category

---

## 2. Cấu trúc page (Section Order)

```
[1] Breadcrumb
[2] Product Hero (gallery + info + CTA)
[3] Product Detail Tabs (Mô tả / Thông số / Bảo hành)
[4] Related Products (same category, is_featured)
```

---

## 3. Sections Chi Tiết

---

### [Section 1] Breadcrumb

**Nguồn:** Data từ product detail (categories + subcategories)

| Breadcrumb item | Nguồn | Link |
|----------------|-------|------|
| "Trang chủ" | Static | `/` |
| `categories.name` | DB | `/san-pham/{categories.slug}` |
| `subcategories.name` | DB (nếu có) | `/san-pham/{cat.slug}/{sub.slug}` |
| `products.name` | DB | Không có link (current page) |

---

### [Section 2] Product Hero

**Mô tả:** Layout 2 cột — Gallery trái, thông tin & CTA phải.

#### 📦 DB Contract

**Model:** `products` (full include)

**Ảnh sản phẩm — `product_images`:**
| Field | Type | Dùng để làm gì |
|-------|------|----------------|
| `image_url` | `String` | URL ảnh |
| `alt_text` | `String?` | Alt text — nullable |
| `image_type` | `String` | `"main"`, `"gallery"`, `"technical"` |
| `sort_order` | `Int` | Thứ tự trong gallery |

**Thông tin sản phẩm — `products`:**
| Field | Type | Dùng để làm gì |
|-------|------|----------------|
| `name` | `String` | Tên SP — H1 |
| `sku` | `String` | Mã SKU hiển thị |
| `price_display` | `String?` | Giá — default "Liên hệ báo giá" |
| `stock_status` | `String` | Badge trạng thái kho |
| `is_new` | `Boolean` | Badge "Mới" |
| `is_bestseller` | `Boolean` | Badge "Bán chạy" |
| `warranty_months` | `Int?` | Bảo hành N tháng — nullable |
| `brands.name` | `String?` | Tên thương hiệu |
| `brands.logo_url` | `String?` | Logo brand — nullable |
| `brands.website_url` | `String?` | Link website brand — nullable |
| `origins.name` | `String?` | Xuất xứ — nullable |
| `colors.name` | `String?` | Tên màu — nullable |
| `colors.hex_code` | `String?` | Mã màu HEX — nullable |
| `materials.name` | `String?` | Vật liệu — nullable |

#### 🔌 API Contract

```typescript
// getPublicProductBySlug(categorySlug, productSlug)
type ProductDetail = {
  id: number
  name: string
  sku: string
  price_display: string | null
  stock_status: string          // "in_stock" | "out_of_stock" | "pre_order"
  is_new: boolean
  is_bestseller: boolean
  warranty_months: number | null
  categories: { id: number; name: string; slug: string }
  subcategories: { id: number; name: string; slug: string } | null
  brands: {
    id: number; name: string; slug: string
    logo_url: string | null
    website_url: string | null
  } | null
  origins: { id: number; name: string } | null
  colors: { id: number; name: string; hex_code: string | null } | null
  materials: { id: number; name: string } | null
  product_images: Array<{
    id: number; image_url: string; alt_text: string | null
    image_type: string; sort_order: number
  }>
  product_feature_values: Array<{
    value: string | null
    product_features: { name: string; icon_name: string | null }
  }>
}
```

#### 🎨 UI → Data Mapping — Left (Gallery)

| UI Element | Data field | Ghi chú |
|-----------|------------|---------|
| Main image | `product_images` where `image_type="main"` hoặc index 0 | |
| Thumbnail strip | Tất cả `product_images` | Horizontal scroll |
| Zoom on hover | main image | Desktop only |
| Empty gallery | `product_images.length === 0` | Show `image_main_url` fallback |

#### 🎨 UI → Data Mapping — Right (Info)

| UI Element | Data field | Ghi chú |
|-----------|------------|---------|
| H1 tên SP | `name` | |
| Mã SKU | `sku` | `"Mã: {sku}"` |
| Badge "Mới" | `is_new` | |
| Badge "Bán chạy" | `is_bestseller` | |
| Badge tồn kho | `stock_status` | "Còn hàng" / "Hết hàng" / "Đặt trước" |
| Màu sắc | `colors.name` + `colors.hex_code` | Dot màu + label |
| Vật liệu | `materials.name` | Tag |
| Xuất xứ | `origins.name` | Tag |
| Bảo hành | `warranty_months` | Nếu null → ẩn. Format: "12 tháng" |
| Brand logo | `brands.logo_url` | Nếu null → text name |
| Brand name | `brands.name` | Link → `brands.website_url` nếu có |
| Giá | `price_display` | Luôn có value |
| CTA "Báo giá" | — | Primary button — add to quote cart |
| CTA "Gọi ngay" | Phone static | Secondary button |

#### 📝 Wireframe Notes

- **Desktop:** 2 cột 50/50, sticky right column khi scroll
- **Mobile:** Stack dọc — Gallery trên, Info dưới
- **Gallery:** Main image lớn + thumbnail strip bên dưới (4 ảnh visible)
- **Badge vị trí:** Top-left của main image
- **Brand section:** Row ngang — logo + tên + "Xem thêm brand" link

---

### [Section 3] Product Detail Tabs

**Mô tả:** 3 tabs — Mô tả, Thông số kỹ thuật, Đặc điểm nổi bật.

#### 📦 DB Contract

**Tab 1 — Mô tả (`products.description`):**
| Field | Type | Ghi chú |
|-------|------|---------|
| `description` | `String?` | HTML content — sanitize trước khi render |

**Tab 2 — Thông số (`products.specs`):**
| Field | Type | Ghi chú |
|-------|------|---------|
| `specs` | `Json` | Object key-value: `{"Kích thước": "60x60cm", "Độ dày": "8mm"}` |

**Tab 3 — Đặc điểm (`product_feature_values`):**
| Field | Type | Ghi chú |
|-------|------|---------|
| `product_features.name` | `String` | Tên đặc điểm |
| `product_features.icon_name` | `String?` | Lucide icon — nullable |
| `value` | `String?` | Giá trị — nullable |

#### 🎨 UI → Data Mapping

| UI Element | Data field | Ghi chú |
|-----------|------------|---------|
| Tab "Mô tả" | `description` | dangerouslySetInnerHTML (sanitized) |
| Tab "Thông số" | `specs` JSON | Render thành bảng key-value |
| Tab "Đặc điểm" | `product_feature_values` | Grid icons + label + value |

#### 📝 Wireframe Notes

- **Tab Mô tả empty:** `description === null` → tab ẩn hoặc show "Đang cập nhật"
- **Tab Thông số empty:** `specs === {}` → ẩn tab
- **Tab Đặc điểm empty:** `product_feature_values.length === 0` → ẩn tab
- **Mobile:** Accordion thay vì tabs

---

### [Section 4] Related Products

**Mô tả:** Sản phẩm tương tự cùng category.

#### 📦 DB Contract

Dùng `getFeaturedProductsByCategorySlug(categorySlug, limit=8)`.
Filter: `is_active=true`, `is_featured=true`, cùng `category`, loại trừ product hiện tại (`id != current`).

#### 🎨 UI → Data Mapping

Giống ProductCard trong Category Page — xem Section 4B của category.md.

#### 📝 Wireframe Notes

- **Desktop:** Horizontal scroll hoặc Grid 4 cột
- **Empty state:** Không có related product → ẩn toàn bộ section

---

## 4. Page-level Technical Notes

### SEO
```typescript
export async function generateMetadata({ params }) {
  const product = await getPublicProductBySlug(params.categorySlug, params.productSlug)
  return {
    title: product.seo_title || `${product.name} — Đông Phú Gia`,
    description: product.seo_description,
    openGraph: {
      images: [product.product_images[0]?.image_url || product.image_main_url],
    },
  }
}
```

### Caching
- Product detail: `revalidate: 1800` (30 phút) — tag `products`
- Related products: `revalidate: 3600` — tag `featured-products`

### Error handling
- Product không tồn tại hoặc `is_active = false` → `notFound()` (404)

---

## 5. States cần Design

| State | Khi nào | Xử lý |
|-------|---------|-------|
| No gallery images | `product_images.length === 0` | Dùng `image_main_url` fallback |
| description null | Chưa nhập mô tả | Tab "Mô tả" ẩn / "Đang cập nhật" |
| specs empty `{}` | Chưa nhập thông số | Tab "Thông số" ẩn |
| No brand | `brands === null` | Ẩn brand section |
| No color/material | null | Ẩn tag tương ứng |
| Out of stock | `stock_status === "out_of_stock"` | Badge đỏ + dim CTA |
| 404 | slug không tồn tại | Next.js notFound() page |

---

## 6. Open Questions (cho PM)

| # | Câu hỏi | Deadline |
|---|---------|---------|
| 1 | CTA "Gọi ngay" → gọi thẳng hay mở form liên hệ? | 14/04 |
| 2 | Tab layout: muốn tabs ngang hay accordion (mobile-first)? | 14/04 |
| 3 | Related products: dùng `is_featured` hay cùng `subcategory`? | 14/04 |
| 4 | `specs` JSON: ai nhập? Admin tự điền hay từ data crawl? | 14/04 |

---
*PRD này là Design Contract — mọi field trong UI đều có data source rõ ràng từ DB.*
