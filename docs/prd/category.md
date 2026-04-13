# PRD — Trang Danh Mục Sản Phẩm (Category Page)
**Dự án:** Đông Phú Gia V2
**Route:** `/san-pham/[categorySlug]` và `/san-pham/[categorySlug]/[subcategorySlug]`
**Phiên bản:** 1.0 — 09/04/2026
**Dành cho:** Designer + Frontend Dev

---

## 1. Mục tiêu trang

1. **Hiển thị toàn bộ sản phẩm** trong một danh mục/danh mục con
2. **Filter & Sort** — giúp khách thu hẹp lựa chọn theo brand, màu, vật liệu, xuất xứ
3. **Phân trang** — không load toàn bộ (default 24/trang)
4. **Điều hướng** vào trang chi tiết sản phẩm

---

## 2. Cấu trúc page (Section Order)

```
[1] Category Hero (ảnh + tên danh mục)
[2] Breadcrumb
[3] Subcategory Tabs (nếu có)
[4] Filter Sidebar (left) + Product Grid (right)
[5] Pagination
```

---

## 3. Sections Chi Tiết

---

### [Section 1] Category Hero

**Mô tả:** Banner đầu trang với ảnh và tiêu đề danh mục.

#### 📦 DB Contract

**Model:** `categories` | `subcategories`

| Field | Type | Dùng để làm gì |
|-------|------|----------------|
| `name` | `String` (max 100) | Tiêu đề H1 trang |
| `slug` | `String` | Xác định đang ở category nào |
| `description` | `String?` | Mô tả ngắn bên dưới tiêu đề — nullable |
| `thumbnail_url` | `String?` | Ảnh hero background — nullable |
| `seo_title` | `String?` | Dùng cho `<title>` tag |
| `seo_description` | `String?` | Dùng cho `<meta description>` |

#### 🎨 UI → Data Mapping

| UI Element | Data field | Ghi chú |
|-----------|------------|---------|
| Ảnh nền hero | `thumbnail_url` | Nếu null → gradient placeholder |
| H1 tiêu đề | `name` | |
| Mô tả | `description` | Nếu null → ẩn |

#### 📝 Wireframe Notes

- **Desktop:** Full-width, height ~240px, text overlay bottom-left
- **Mobile:** Height ~140px
- **Empty state:** thumbnail_url null → solid brand color background

---

### [Section 2] Breadcrumb

**Mô tả:** Navigation trail — Trang chủ > Danh mục > Danh mục con (nếu có).

#### 📦 DB Contract

Không query thêm — dùng data từ category/subcategory đã load ở Section 1.

| Breadcrumb item | Nguồn | Link |
|----------------|-------|------|
| "Trang chủ" | Static | `/` |
| `categories.name` | DB | `/san-pham/{categories.slug}` |
| `subcategories.name` | DB (nếu có) | `/san-pham/{cat.slug}/{sub.slug}` |

#### 📝 Wireframe Notes

- Single line, separator `/` hoặc `>`
- Last item: không có link, bold hoặc muted

---

### [Section 3] Subcategory Tabs

**Mô tả:** Tabs ngang để lọc theo danh mục con. Chỉ hiển thị nếu category có subcategories.

#### 📦 DB Contract

**Model:** `subcategories`

| Field | Type | Dùng để làm gì |
|-------|------|----------------|
| `id` | `Int` | key |
| `name` | `String` | Tên tab |
| `slug` | `String` | URL: `/san-pham/{catSlug}/{subSlug}` |
| `thumbnail_url` | `String?` | Optional icon/ảnh nhỏ trong tab |
| `is_active` | `Boolean` | Chỉ show active |
| `sort_order` | `Int` | Thứ tự (ASC) |
| `category_id` | `Int` | Lọc theo category hiện tại |

**Query:**
```sql
WHERE category_id = {current_category_id} AND is_active = true
ORDER BY sort_order ASC
```

#### 🎨 UI → Data Mapping

| UI Element | Data field | Ghi chú |
|-----------|------------|---------|
| Tab label | `name` | |
| Tab "Tất cả" | Static | Link về `/san-pham/{catSlug}` |
| Active tab | URL match `slug` | Highlight |
| Tab link | `/san-pham/{catSlug}/{subSlug}` | |

#### 📝 Wireframe Notes

- **Desktop:** Tabs ngang bên dưới hero
- **Mobile:** Scroll ngang (horizontal scroll)
- **Empty state:** Không có subcategory → ẩn toàn bộ section
- **"Tất cả"** luôn là tab đầu tiên

---

### [Section 4A] Filter Sidebar

**Mô tả:** Bộ lọc bên trái. Filters được định nghĩa trong DB theo từng category.

#### 📦 DB Contract

**Model:** `filter_definitions`

| Field | Type | Dùng để làm gì |
|-------|------|----------------|
| `id` | `Int` | key |
| `category_id` | `Int?` | Filter thuộc về category nào |
| `subcategory_id` | `Int?` | Filter thuộc về subcategory nào |
| `filter_key` | `String` | Key để query: `brand_id`, `color_id`, `origin_id`... |
| `filter_label` | `String` | Label hiển thị: "Thương hiệu", "Màu sắc"... |
| `filter_type` | `String` | `"select"`, `"multiselect"`, `"range"` |
| `options` | `Json?` | Array options nếu không phải relation |
| `sort_order` | `Int` | Thứ tự filter (ASC) |
| `is_active` | `Boolean` | Chỉ show active |

**Filter keys được hỗ trợ bởi API:**
- `brand_id` → query brands từ products
- `color_id` → query colors
- `material_id` → query materials
- `origin_id` → query origins
- `price_min` / `price_max` → range slider

**Query:**
```sql
WHERE (category_id = {id} OR subcategory_id = {id}) AND is_active = true
ORDER BY sort_order ASC
```

#### 🎨 UI → Data Mapping

| UI Element | Data field | Ghi chú |
|-----------|------------|---------|
| Filter group title | `filter_label` | |
| Filter input type | `filter_type` | select/multiselect/range |
| Dropdown options | `options` JSON hoặc relation data | |
| Active filter count | URL params | Badge số lượng filter đang bật |

#### 📝 Wireframe Notes

- **Desktop:** Sidebar cố định bên trái, width 240px
- **Mobile:** Drawer từ bottom (slide-up), toggle bằng nút "Lọc"
- **Sort by:** Dropdown riêng (không phải filter) — "Mặc định / Mới nhất / Giá tăng dần"
- **Clear all:** Nút xóa toàn bộ filter
- **Empty state:** Không có filter_definitions → ẩn sidebar, grid full-width

---

### [Section 4B] Product Grid

**Mô tả:** Danh sách sản phẩm dạng grid. 24 sản phẩm/trang.

#### 📦 DB Contract

**Model:** `products` + relations

| Field | Type | Dùng để làm gì |
|-------|------|----------------|
| `id` | `Int` | key |
| `name` | `String` | Tên sản phẩm |
| `slug` | `String` | URL sản phẩm |
| `image_main_url` | `String?` | Ảnh mặt trước — nullable |
| `image_hover_url` | `String?` | Ảnh hover — nullable |
| `price_display` | `String?` | Giá — default "Liên hệ báo giá" |
| `is_new` | `Boolean` | Badge "Mới" |
| `is_bestseller` | `Boolean` | Badge "Bán chạy" |
| `stock_status` | `String` | `in_stock` / `out_of_stock` / `pre_order` |
| `categories.slug` | `String` | Build product URL |
| `brands.name` | `String?` | Brand label — nullable |

**Query:** `getPublicProducts(filters)` — xem `src/lib/public-api-products.ts`
**Default:** `pageSize=24`, `sortBy=sort_order`, `sortDir=asc`

#### 🔌 API Contract

```typescript
// Endpoint: GET /api/products?category_slug=&brand_id=&page=
type ProductListItem = {
  id: number
  name: string
  slug: string
  price_display: string | null      // default "Liên hệ báo giá"
  image_main_url: string | null
  image_hover_url: string | null
  is_new: boolean
  is_bestseller: boolean
  stock_status: string              // "in_stock" | "out_of_stock" | "pre_order"
  categories: { name: string; slug: string }
  brands: { name: string; slug: string } | null
}

type PaginatedResponse = {
  products: ProductListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
```

#### 🎨 UI → Data Mapping

| UI Element | Data field | Ghi chú |
|-----------|------------|---------|
| Ảnh (default) | `image_main_url` | Fallback placeholder |
| Ảnh (hover) | `image_hover_url` | Nếu null → không có hover |
| Tên SP | `name` | Max 2 dòng |
| Brand | `brands.name` | Nếu null → ẩn |
| Giá | `price_display` | Luôn có giá trị |
| Badge "Mới" | `is_new === true` | Xanh lá |
| Badge "Bán chạy" | `is_bestseller === true` | Cam |
| Mờ "Hết hàng" | `stock_status === "out_of_stock"` | Overlay |
| Số kết quả | `total` | "Tìm thấy 48 sản phẩm" |
| Button "Báo giá" | — | Add to quote cart |
| Link SP | `/san-pham/{categories.slug}/{slug}` | |

#### 📝 Wireframe Notes

- **Desktop:** Grid 4 cột, card ~260×340px
- **Mobile:** Grid 2 cột, card 160×220px
- **Empty state (no products):** Illustration + "Không có sản phẩm phù hợp. Thử xóa bộ lọc?"
- **Loading state:** Skeleton cards (same grid layout)

---

### [Section 5] Pagination

**Mô tả:** Phân trang cuối trang.

#### 📦 DB Contract

Không query thêm — dùng `total`, `page`, `totalPages` từ API response.

| UI Element | Data | Ghi chú |
|-----------|------|---------|
| Số trang | `totalPages` | |
| Trang hiện tại | `page` | Highlight |
| "Trang trước/sau" | URL param `?page=N` | |

#### 📝 Wireframe Notes

- **Desktop:** Centered, style numbered: `< 1 2 3 ... 10 >`
- **Mobile:** Chỉ "Trang trước / Trang sau"
- **Empty state:** `totalPages <= 1` → ẩn pagination

---

## 4. Page-level Technical Notes

### SEO
```typescript
export async function generateMetadata({ params }) {
  const category = await getCategoryBySlug(params.categorySlug)
  return {
    title: category.seo_title || `${category.name} — Đông Phú Gia`,
    description: category.seo_description || category.description,
  }
}
```

### Data fetching
- Category info: Server Component (SSR, revalidate 3600s)
- Products: Client-side hoặc SSR với URL search params
- Filter definitions: Server Component (revalidate 86400s — ít thay đổi)

### URL params
```
/san-pham/gach-op-lat?brand_id=1&color_id=2&page=2&sort=created_at_desc
```

---

## 5. States cần Design

| State | Khi nào | Xử lý |
|-------|---------|-------|
| Loading products | Đang fetch | Skeleton grid |
| No products | Filter quá hẹp | Empty state + "Xóa bộ lọc" |
| No subcategories | Category không có sub | Ẩn Tabs section |
| No filters | filter_definitions trống | Ẩn Sidebar |
| thumbnail_url null | DB chưa có ảnh | Gradient background |
| image_main_url null | SP chưa có ảnh | Placeholder icon |

---

## 6. Open Questions (cho PM)

| # | Câu hỏi | Deadline |
|---|---------|---------|
| 1 | Filter sidebar: default collapsed hay expanded trên desktop? | 14/04 |
| 2 | Sort options: muốn thêm "Phổ biến nhất" không? (cần thêm view_count vào products) | 14/04 |
| 3 | Mobile: Filter là bottom drawer hay full-screen overlay? | 14/04 |

---
*PRD này là Design Contract — mọi field trong UI đều có data source rõ ràng từ DB.*
