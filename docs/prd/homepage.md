# PRD — Trang Chủ (Homepage)
**Dự án:** Đông Phú Gia V2  
**Route:** `/`  
**Phiên bản:** 1.0 — 09/04/2026  
**Dành cho:** Designer + Frontend Dev  

---

## 1. Mục tiêu trang

Trang chủ là điểm chạm đầu tiên của khách hàng. Mục tiêu:
1. **Giới thiệu thương hiệu** — tin tưởng, chuyên nghiệp, đa dạng sản phẩm
2. **Điều hướng nhanh** → Category để khám phá sản phẩm
3. **Kích hoạt hành động** → "Yêu cầu báo giá" (Quote Request)
4. **Xây dựng trust** → Đối tác thương hiệu + Bài viết kiến thức

---

## 2. Cấu trúc page (Section Order)

```
[1] Hero Banner (carousel)
[2] Category Navigation (icon grid)
[3] Featured Products (horizontal scroll / grid)
[4] Partners / Brands Showcase (logo strip)
[5] Latest Blog Posts (3 cards)
[6] Quote CTA (full-width banner)
```

---

## 3. Sections Chi Tiết

---

### [Section 1] Hero Banner

**Mô tả:** Carousel ảnh lớn, full-width. Mỗi slide có tiêu đề + nút CTA.

#### 📦 DB Contract

**Model:** `banners`

| Field | Type | Dùng để làm gì |
|-------|------|----------------|
| `id` | `Int` | key |
| `title` | `String?` (max 200) | Tiêu đề slide — có thể null |
| `image_url` | `String` (max 500) | Ảnh nền slide — **BẮT BUỘC** |
| `link_url` | `String?` (max 500) | Link khi click slide — có thể null |
| `is_active` | `Boolean` | Chỉ hiển thị `is_active = true` |
| `sort_order` | `Int` | Thứ tự slide (ASC) |

**Query:**
```sql
WHERE is_active = true ORDER BY sort_order ASC
```

#### 🔌 API Contract

```
GET /api/banners (hoặc server-side fetch)
Response: Banner[]
```

```typescript
type Banner = {
  id: number
  title: string | null    // nullable — designer cần handle empty state
  image_url: string       // always present
  link_url: string | null // nullable — slide có thể không có link
}
```

#### 🎨 UI → Data Mapping

| UI Element | Data field | Ghi chú |
|-----------|------------|---------|
| Slide background | `image_url` | Aspect ratio: 16:6 desktop / 4:3 mobile |
| Overlay text | `title` | Nếu null → không render text overlay |
| Toàn bộ slide click | `link_url` | Nếu null → slide không clickable |
| Số chấm pagination | `banners.length` | Auto |

#### 📝 Wireframe Notes (cho Designer)

- **Desktop:** Full-width, height ~520px, text overlay bottom-left
- **Mobile:** Height ~220px, text overlay bottom-center
- **Auto-play:** 4 giây/slide, có nút prev/next
- **Empty state:** Nếu `title = null` → slide chỉ hiển thị ảnh, không có text box

---

### [Section 2] Category Navigation

**Mô tả:** Grid các danh mục sản phẩm chính. Click → vào trang Category.

#### 📦 DB Contract

**Model:** `categories`

| Field | Type | Dùng để làm gì |
|-------|------|----------------|
| `id` | `Int` | key |
| `name` | `String` (max 100) | Tên danh mục — hiển thị dưới icon |
| `slug` | `String` | URL: `/san-pham/{slug}` |
| `thumbnail_url` | `String?` | Ảnh đại diện — có thể null → dùng icon |
| `icon_name` | `String?` | Tên icon Lucide — fallback nếu không có ảnh |
| `is_active` | `Boolean` | Chỉ hiển thị `is_active = true` |
| `sort_order` | `Int` | Thứ tự (ASC) |

**Query:**
```sql
WHERE is_active = true ORDER BY sort_order ASC
```

**Số lượng hiện tại:** ~6-8 categories

#### 🔌 API Contract

```
GET (server-side) → getPublicCategories()
Response: Category[]
```

```typescript
type CategoryNav = {
  id: number
  name: string
  slug: string
  thumbnail_url: string | null
  icon_name: string | null
}
```

#### 🎨 UI → Data Mapping

| UI Element | Data field | Ghi chú |
|-----------|------------|---------|
| Category card ảnh | `thumbnail_url` | Nếu null → placeholder icon |
| Icon fallback | `icon_name` | Tên Lucide icon (vd: "Package", "Layers") |
| Category label | `name` | Truncate 2 dòng |
| Card link | `/san-pham/${slug}` | Internal route |

#### 📝 Wireframe Notes (cho Designer)

- **Desktop:** Grid 3×2 hoặc 4×2 tùy số lượng category
- **Mobile:** Scroll ngang (carousel) — 2.5 cards visible
- **Card size:** ~160×180px desktop / ~120×140px mobile
- **Hover state:** Slight scale-up + border highlight
- **Empty state:** Không có — categories luôn có data

---

### [Section 3] Featured Products

**Mô tả:** Hiển thị sản phẩm nổi bật (`is_featured = true`). Scroll ngang trên mobile.

#### 📦 DB Contract

**Model:** `products` + `categories` + `brands`

| Field | Type | Dùng để làm gì |
|-------|------|----------------|
| `id` | `Int` | key |
| `name` | `String` (max 500) | Tên sản phẩm |
| `slug` | `String` | URL: `/san-pham/{category.slug}/{product.slug}` |
| `image_main_url` | `String?` | Ảnh mặt trước |
| `image_hover_url` | `String?` | Ảnh hover — optional |
| `price_display` | `String?` | Hiển thị giá — default `"Liên hệ báo giá"` |
| `is_new` | `Boolean` | Badge "Mới" |
| `is_bestseller` | `Boolean` | Badge "Bán chạy" |
| `is_featured` | `Boolean` | Filter chính cho section này |
| `stock_status` | `String` | `"in_stock"` \| `"out_of_stock"` \| `"pre_order"` |
| `categories.name` | `String` | Category label trên card |
| `categories.slug` | `String` | Dùng tạo link |
| `brands.name` | `String?` | Brand label — nullable |

**Query:**
```sql
WHERE is_active = true AND is_featured = true
ORDER BY sort_order ASC
LIMIT 8
```

#### 🔌 API Contract

```typescript
// Dùng type đã có trong public-api-products.ts
type ProductListItem = {
  id: number
  name: string
  slug: string
  category_id: number
  price_display: string | null     // "Liên hệ báo giá" nếu null
  image_main_url: string | null
  image_hover_url: string | null
  is_new: boolean
  is_bestseller: boolean
  stock_status: string
  categories: { name: string; slug: string }
  brands: { name: string; slug: string } | null
}
```

#### 🎨 UI → Data Mapping

| UI Element | Data field | Ghi chú |
|-----------|------------|---------|
| Card ảnh (default) | `image_main_url` | Fallback: placeholder ảnh gạch |
| Card ảnh (hover) | `image_hover_url` | Nếu null → không có hover effect |
| Tên sản phẩm | `name` | Max 2 dòng, truncate |
| Brand label | `brands.name` | Nếu null → ẩn |
| Category label | `categories.name` | Hiển thị nhỏ, muted |
| Giá | `price_display` | Luôn có giá trị (default "Liên hệ báo giá") |
| Badge "Mới" | `is_new === true` | Màu xanh lá |
| Badge "Bán chạy" | `is_bestseller === true` | Màu cam |
| Badge "Hết hàng" | `stock_status === "out_of_stock"` | Overlay mờ trên ảnh |
| Button "Báo giá" | — | Trigger thêm vào Quote Cart |
| Card link | `/san-pham/{categories.slug}/{slug}` | Toàn bộ card clickable |

#### 📝 Wireframe Notes (cho Designer)

- **Desktop:** Grid 4 cột × 2 hàng (max 8 sản phẩm)
- **Mobile:** Scroll ngang, hiển thị 1.5 cards
- **Card size:** ~260×340px desktop
- **Badge vị trí:** Top-left corner của ảnh
- **CTA button:** Fixed ở bottom card, xuất hiện khi hover (desktop) / luôn hiện (mobile)
- **Empty state:** Nếu `is_featured = false` cho tất cả sản phẩm → ẩn toàn bộ section

---

### [Section 4] Partners / Brands Showcase

**Mô tả:** Dải logo đối tác/thương hiệu. Auto-scroll hoặc grid tĩnh.

#### 📦 DB Contract

**Model:** `partners`

| Field | Type | Dùng để làm gì |
|-------|------|----------------|
| `id` | `Int` | key |
| `name` | `String` (max 200) | Tên đối tác — alt text cho logo |
| `logo_url` | `String?` | Ảnh logo — có thể null |
| `link_url` | `String?` | Website đối tác — nullable |
| `tier` | `String?` | `"Vàng"` / `"Bạc"` / `"Đồng"` — thứ tự ưu tiên |
| `is_active` | `Boolean?` | Chỉ hiển thị active |
| `sort_order` | `Int?` | Thứ tự (ASC) |

**Query:**
```sql
WHERE is_active = true ORDER BY sort_order ASC LIMIT 12
```

#### 🎨 UI → Data Mapping

| UI Element | Data field | Ghi chú |
|-----------|------------|---------|
| Logo image | `logo_url` | Grayscale → màu khi hover |
| Alt text | `name` | |
| Logo click | `link_url` | Nếu null → không clickable, `target="_blank"` |
| Tier grouping | `tier` | Optional: nhóm "Vàng" trước |

#### 📝 Wireframe Notes (cho Designer)

- **Desktop:** 1 hàng, 6-8 logo, justify-center
- **Mobile:** Scroll ngang tự động (marquee effect) hoặc 2 hàng grid
- **Logo height:** ~48px fixed, width auto
- **Style:** Grayscale 60%, hover → full color
- **Empty state:** Nếu 0 partners active → ẩn section

---

### [Section 5] Latest Blog Posts

**Mô tả:** 3 bài viết mới nhất đã publish. Link → trang blog.

#### 📦 DB Contract

**Model:** `blog_posts` + `blog_categories`

| Field | Type | Dùng để làm gì |
|-------|------|----------------|
| `id` | `Int` | key |
| `title` | `String` (max 300) | Tiêu đề bài viết |
| `slug` | `String` | URL: `/tin-tuc/{category.slug}/{post.slug}` |
| `excerpt` | `String?` | Mô tả ngắn — nullable |
| `thumbnail_url` | `String?` | Ảnh thumbnail — nullable |
| `reading_time` | `Int?` | Phút đọc — nullable |
| `published_at` | `DateTime?` | Ngày đăng — nullable |
| `author_name` | `String` | Mặc định: `"Đông Phú Gia"` |
| `status` | `String` | Chỉ lấy `status = "published"` |
| `blog_categories.name` | `String` | Category label |
| `blog_categories.slug` | `String` | Dùng tạo link |

**Query:**
```sql
WHERE status = 'published'
ORDER BY published_at DESC
LIMIT 3
```

#### 🎨 UI → Data Mapping

| UI Element | Data field | Ghi chú |
|-----------|------------|---------|
| Ảnh thu nhỏ | `thumbnail_url` | Fallback: placeholder ảnh blog |
| Category tag | `blog_categories.name` | Badge màu |
| Tiêu đề | `title` | Max 2 dòng |
| Mô tả | `excerpt` | Max 3 dòng, nếu null → ẩn |
| Ngày đăng | `published_at` | Format: `"08 tháng 04, 2026"` — nếu null → ẩn |
| Thời gian đọc | `reading_time` | `"5 phút đọc"` — nếu null → ẩn |
| Tác giả | `author_name` | |
| Card link | `/tin-tuc/{category.slug}/{slug}` | |

#### 📝 Wireframe Notes (cho Designer)

- **Desktop:** 3 cards ngang (grid-cols-3)
- **Mobile:** Stack dọc (1 card/hàng)
- **Card:** Ảnh trên, content dưới
- **Ảnh ratio:** 16:9
- **Button "Xem tất cả":** Ở cuối section → `/tin-tuc`
- **Empty state:** Nếu 0 bài published → ẩn toàn bộ section

---

### [Section 6] Quote CTA (Gọi hành động Báo Giá)

**Mô tả:** Banner kêu gọi gửi yêu cầu báo giá. Static content — không có DB.

#### 📦 DB Contract

> Không có DB — nội dung static / hardcoded trong code.

#### 🎨 UI Elements

| UI Element | Nội dung | Ghi chú |
|-----------|----------|---------|
| Headline | `"Cần tư vấn vật liệu xây dựng?"` | Static |
| Sub-text | `"Đội ngũ chuyên gia sẵn sàng hỗ trợ bạn 24/7"` | Static |
| CTA Button | `"Yêu cầu báo giá ngay"` | → mở Quote Request form / scroll to form |
| Phone | Số điện thoại từ `.env` hoặc hardcode | Static |

#### 📝 Wireframe Notes (cho Designer)

- **Layout:** Full-width, background gradient (brand color)
- **Desktop:** Text left + Button right, padding ~80px
- **Mobile:** Stack dọc, text center, button full-width
- **Không có empty state** — luôn hiển thị

---

## 4. Page-level Technical Notes

### SEO (cho Dev)
```typescript
// Metadata cho Homepage
export const metadata: Metadata = {
  title: 'Đông Phú Gia — Vật liệu xây dựng & Nội thất cao cấp',
  description: 'Phân phối gạch ốp lát, thiết bị vệ sinh, vòi sen cao cấp...',
  openGraph: {
    images: [{ url: banners[0]?.image_url }] // first banner as OG image
  }
}
```

### Data fetching strategy
- **Server Components** (SSR) cho tất cả sections → tốt cho SEO
- **Revalidate:** `60` giây cho banners/products, `300` giây cho blog
- **No client-side fetch** trên Homepage

### Performance
- Banner images → `priority={true}` (LCP optimization)
- Product images → lazy load (below fold)
- Partners logos → lazy load

---

## 5. States cần Design

| State | Khi nào | Xử lý |
|-------|---------|-------|
| Loading | Server-side → không cần spinner | Skeleton hoặc Suspense |
| Empty — No banners | DB không có banner active | Ẩn section, không break layout |
| Empty — No featured | Không có `is_featured = true` | Ẩn section |
| Empty — No blog | Chưa publish bài nào | Ẩn section |
| Image broken | `image_url` lỗi | Fallback placeholder image |

---

## 6. Open Questions (cho PM)

| # | Câu hỏi | Deadline |
|---|---------|---------|
| 1 | Màu sắc brand chính (primary/accent) cho CTA button? | 14/04 |
| 2 | Category Navigation: muốn dùng **ảnh thumbnail** hay **icon**? | 14/04 |
| 3 | Partners section: logo grid tĩnh hay **marquee auto-scroll**? | 14/04 |
| 4 | Mobile homepage: có Featured Products scroll ngang không? | 14/04 |

---

*PRD này là **Design Contract** — mọi field trong UI đều có data source rõ ràng từ DB.*  
*Designer: có thể vào Figma ngay sau khi PM trả lời Open Questions.*  
*Dev: implement theo contract, không cần hỏi thêm về data model.*
