# PRD: Hệ thống Quản trị Website Đông Phú Gia
# admin.dongphugia.com.vn

> **Phiên bản**: 1.0 | **Ngày**: 02/05/2026 | **Trạng thái**: DRAFT
> **Database**: Supabase PostgreSQL | **Prisma Schema**: 20 models hiện tại
> **Ghi chú**: Mỗi mục ghi rõ trạng thái `✅ Đã có` / `🔲 Chưa phát triển`

---

## MỤC LỤC

1. [Tổng quan hệ thống](#1-tổng-quan)
2. [Xác thực & Phân quyền](#2-xác-thực--phân-quyền)
3. [Dashboard & Báo cáo](#3-dashboard--báo-cáo)
4. [Quản lý Sản phẩm (PIM)](#4-quản-lý-sản-phẩm)
5. [Quản lý Đơn hàng](#5-quản-lý-đơn-hàng)
6. [Quản lý Báo giá](#6-quản-lý-báo-giá)
7. [Quản lý Blog & Nội dung](#7-quản-lý-blog)
8. [Quản lý Trang chủ & Banner](#8-quản-lý-banner)
9. [Quản lý Đối tác & Dự án](#9-đối-tác--dự-án)
10. [Danh mục & Taxonomy](#10-danh-mục--taxonomy)
11. [Media Library](#11-media-library)
12. [CRM Khách hàng](#12-crm)
13. [SEO & Redirect](#13-seo)
14. [Cài đặt hệ thống](#14-cài-đặt)
15. [Thông báo & Audit Log](#15-thông-báo)

---

## 1. TỔNG QUAN

### 1.1 Đối tượng sử dụng
| Vai trò | Mô tả | Trạng thái |
|---------|--------|-----------|
| Super Admin | Toàn quyền | ✅ Đã có (single-user) |
| Sales Staff | Báo giá, đơn hàng | 🔲 Chưa phát triển |
| Content Editor | Blog, sản phẩm | 🔲 Chưa phát triển |
| Viewer | Chỉ xem báo cáo | 🔲 Chưa phát triển |

### 1.2 Tech Stack
- **Framework**: Next.js 15 (App Router, RSC)
- **UI**: shadcn/ui (New York, neutral base)
- **Database**: Supabase PostgreSQL + Prisma 5
- **Auth**: HMAC-SHA256 cookie (hiện tại)
- **Storage**: Bunny CDN
- **Deploy**: Vercel (region: sin1)

---

## 2. XÁC THỰC & PHÂN QUYỀN

### 2.1 Auth hiện tại ✅

**DB Contract**: Không có bảng users — dùng env var `ADMIN_PASSWORD`

**Flow**:
```
Login → HMAC-SHA256(AUTH_SECRET, password + ":" + issuedAt) → Cookie
Cookie name: dpg-admin-session
Session: 8 giờ (configurable via SESSION_HOURS env)
```

**API Contract** (`src/lib/admin-auth.ts`):
```typescript
createSessionToken(issuedAt: number): string
verifyAdminSession(): Promise<boolean>
ADMIN_SESSION_COOKIE = 'dpg-admin-session'
SESSION_MS = SESSION_HOURS * 3600 * 1000
```

### 2.2 Multi-user Auth 🔲 Chưa phát triển

**DB mới cần tạo**:
```prisma
model admin_users {
  id            Int       @id @default(autoincrement())
  email         String    @unique @db.VarChar(200)
  password_hash String    @db.VarChar(255)
  display_name  String    @db.VarChar(100)
  avatar_url    String?   @db.VarChar(500)
  role          String    @default("editor") @db.VarChar(20) // super_admin, sales, editor, viewer
  is_active     Boolean   @default(true)
  last_login_at DateTime?
  created_at    DateTime  @default(now())
  updated_at    DateTime  @default(now())
}
```

**Roles & Permissions**:
| Quyền | Super Admin | Sales | Editor | Viewer |
|-------|:-----------:|:-----:|:------:|:------:|
| Sản phẩm CRUD | ✓ | — | ✓ | Xem |
| Đơn hàng | ✓ | ✓ | — | Xem |
| Báo giá | ✓ | ✓ | — | Xem |
| Blog CRUD | ✓ | — | ✓ | Xem |
| Cài đặt | ✓ | — | — | — |
| Xóa dữ liệu | ✓ | — | — | — |

---

## 3. DASHBOARD & BÁO CÁO

### 3.1 Dashboard chính ✅ (cơ bản)

**DB Contract**: Aggregate queries trên `products`, `orders`, `quote_requests`

**API Contract** (`src/lib/public-api-products.ts`, `src/lib/order-actions.ts`):
```typescript
getProductStats(): { total, active, outOfStock, featured }
getOrderStats(): { total, pending, processing, delivered, revenue }
```

**Stat Cards hiện tại**:
| Card | Query | Trạng thái |
|------|-------|-----------|
| Tổng sản phẩm | `products.count()` | ✅ |
| Đang hiển thị | `products.count({ is_active: true })` | ✅ |
| Hết hàng | `products.count({ stock_status: 'out_of_stock' })` | ✅ |
| Nổi bật | `products.count({ is_featured: true })` | ✅ |
| Báo giá chờ | `quote_requests.count({ status: 'pending' })` | ✅ |
| Đơn hàng | `orders.count()` | ✅ |
| Doanh thu | `orders.aggregate({ _sum: total, status: 'delivered', payment: 'paid' })` | ✅ |

### 3.2 Báo cáo nâng cao 🔲 Chưa phát triển
| Báo cáo | Mô tả |
|---------|--------|
| Biểu đồ đơn hàng theo tuần/tháng | Chart.js hoặc Recharts |
| Top sản phẩm được hỏi giá | Aggregate `quote_items` by `product_id` |
| Tỷ lệ chuyển đổi báo giá → đơn hàng | pending → confirmed rate |
| Doanh thu theo danh mục | Join `orders` → `order_items` → `products` → `categories` |

---

## 4. QUẢN LÝ SẢN PHẨM (PIM - Product Information Management)

### 4.1 DB Contract — Model `products`

```prisma
model products {
  id                Int      @id @default(autoincrement())
  sku               String   @unique @db.VarChar(100)
  name              String   @db.VarChar(500)
  display_name      String?  @db.VarChar(500)
  slug              String   @db.VarChar(500)
  category_id       Int                          // FK → categories
  subcategory_id    Int?                         // FK → subcategories
  brand_id          Int?                         // FK → brands
  origin_id         Int?                         // FK → origins
  color_id          Int?                         // FK → colors
  material_id       Int?                         // FK → materials
  price             Decimal? @db.Decimal(15, 2)
  original_price    Decimal? @db.Decimal(15, 2)
  price_display     String?  @default("Liên hệ báo giá") @db.VarChar(50)
  description       String?
  features          String?
  specs             Json     @default("{}")
  warranty_months   Int?
  image_main_url    String?  @db.VarChar(1000)
  image_hover_url   String?  @db.VarChar(1000)
  stock_status      String   @default("in_stock")   // in_stock, out_of_stock, preorder
  is_active         Boolean  @default(true)
  is_featured       Boolean  @default(false)
  is_new            Boolean  @default(false)
  is_bestseller     Boolean  @default(false)
  is_combo          Boolean  @default(false)
  variant_group     String?  @db.VarChar(50)
  product_type      String?  @db.VarChar(50)
  product_sub_type  String?  @db.VarChar(50)
  component_skus    String[] @default([])
  seo_title         String?  @db.VarChar(200)
  seo_description   String?  @db.VarChar(500)
  sort_order        Int      @default(0)
  source_url        String?  @db.VarChar(1000)
  hita_product_id   String?  @db.VarChar(100)
  created_at        DateTime @default(now())
  updated_at        DateTime @default(now())
}
```

### 4.2 API Contract — Product Actions

```typescript
// src/lib/product-actions.ts
createProduct(data: unknown): Promise<{ success, id } | { errors } | { message }>
updateProduct(id: number, data: unknown): Promise<{ success } | { errors } | { message }>
deleteProduct(id: number): Promise<{ success } | { message }>
toggleProductFeatured(id: number, value: boolean): Promise<Result>
toggleProductActive(id: number, value: boolean): Promise<Result>
bulkDeleteProducts(ids: number[]): Promise<{ success, count }>
bulkToggleActive(ids: number[], value: boolean): Promise<{ success, count }>

// Product Images
addProductImage(productId, imageUrl, altText?, imageType?): Promise<Result>
addProductImages(productId, imageUrls[]): Promise<Result>
deleteProductImage(imageId, productId): Promise<Result>
setProductThumbnail(productId, imageUrl): Promise<Result>

// src/lib/public-api-products.ts
getAdminProducts(params: { search?, category?, subcategory?, brand?, 
  is_active?, is_featured?, stock_status?, page?, pageSize? })
getAdminProductById(id: number)
getProductStats()
```

### 4.3 Trường thông tin sản phẩm theo Danh mục

#### 4.3.1 Thiết bị Vệ sinh (category_id = 1)
**Subcategories**: Bồn cầu, Lavabo, Bồn tắm, Sen vòi, Phụ kiện

| Trường | DB Field | Bắt buộc | Ghi chú |
|--------|----------|:--------:|---------|
| SKU | `sku` | ✓ | Unique, format: `BC-XXX`, `LV-XXX` |
| Tên sản phẩm | `name` | ✓ | Tên đầy đủ (VD: "Bồn cầu 1 khối Caesar CD1395") |
| Tên hiển thị | `display_name` | — | Tên ngắn cho card |
| Slug | `slug` | ✓ | Auto-gen từ name |
| Danh mục | `category_id` | ✓ | = 1 (Thiết bị Vệ sinh) |
| Phân loại con | `subcategory_id` | ✓ | Bồn cầu, Lavabo, v.v. |
| Thương hiệu | `brand_id` | ✓ | Caesar, TOTO, Inax, v.v. |
| Xuất xứ | `origin_id` | — | Việt Nam, Nhật Bản, v.v. |
| Màu sắc | `color_id` | — | Trắng, Đen, v.v. |
| Chất liệu | `material_id` | — | Sứ, Thép không gỉ, v.v. |
| Giá bán | `price` | — | Decimal(15,2) |
| Giá gốc | `original_price` | — | Để tính discount |
| Hiển thị giá | `price_display` | — | "Liên hệ báo giá" nếu không có giá |
| Mô tả | `description` | — | Rich text (HTML) |
| Đặc điểm | `features` | — | Rich text |
| Thông số kỹ thuật | `specs` | — | JSON: `{"Kích thước":"700x380x760mm", "Xả":"Xoáy"}` |
| Bảo hành | `warranty_months` | — | Số tháng |
| Ảnh chính | `image_main_url` | ✓ | Bunny CDN URL |
| Ảnh hover | `image_hover_url` | — | Hiệu ứng hover trên card |
| Tồn kho | `stock_status` | ✓ | `in_stock` / `out_of_stock` / `preorder` |
| Hiển thị | `is_active` | ✓ | Toggle |
| Nổi bật | `is_featured` | — | Hiện trên homepage |
| Hàng mới | `is_new` | — | Badge "Mới" |
| Bán chạy | `is_bestseller` | — | Badge "Bán chạy" |
| Combo | `is_combo` | — | Sản phẩm combo (bồn cầu + nắp) |
| Loại sản phẩm | `product_type` | — | VD: "1 khối", "2 khối", "Âm tường" |
| Loại phụ | `product_sub_type` | — | Phân loại chi tiết hơn |
| Nhóm biến thể | `variant_group` | — | Group SP cùng model khác màu |
| SKU thành phần | `component_skus` | — | Array SKUs cho combo |
| SEO Title | `seo_title` | — | Max 200 chars |
| SEO Description | `seo_description` | — | Max 500 chars |
| Thứ tự | `sort_order` | — | Default 0 |

#### 4.3.2 Thiết bị Bếp (category_id = 2)
**Subcategories**: Chậu rửa, Vòi chậu, Máy hút mùi, Bếp từ, Phụ kiện bếp

| Trường đặc thù | DB Field | Ghi chú |
|----------------|----------|---------|
| (Dùng chung fields với TBVS) | — | — |
| Thông số đặc thù | `specs` | JSON: `{"Kích thước chậu":"800x500mm", "Vật liệu":"Inox 304"}` |
| Loại SP | `product_type` | VD: "Chậu đơn", "Chậu đôi", "Âm bàn" |

#### 4.3.3 Gạch ốp lát (category_id = 3)
**Subcategories**: Gạch ốp tường, Gạch lát nền, Gạch Mosaic, Gạch Granite

| Trường đặc thù | DB Field | Ghi chú |
|----------------|----------|---------|
| Thông số | `specs` | JSON: `{"Kích thước":"600x600mm", "Bề mặt":"Mờ", "Vân":"Đá marble"}` |
| Loại SP | `product_type` | VD: "Ốp tường", "Lát nền" |

#### 4.3.4 Vật liệu Nước (category_id = 4)
**Subcategories**: Ống PPR, Van khóa, Phụ kiện ống, Máy bơm

| Trường đặc thù | DB Field | Ghi chú |
|----------------|----------|---------|
| Thông số | `specs` | JSON: `{"Đường kính":"Ø25", "Áp suất":"PN20", "Chịu nhiệt":"95°C"}` |
| Loại SP | `product_type` | VD: "Ống thẳng", "Co", "Tê", "Van" |

### 4.4 Quan hệ Sản phẩm ✅

**DB Contract** — `product_relationships`:
```prisma
model product_relationships {
  id                Int    @id
  parent_id         Int                    // FK → products
  child_sku         String @db.VarChar(200)
  child_id          Int?                   // FK → products (nullable)
  relationship_type String @default("component")  // component, accessory, variant
  component_type    String @default("component")
  sort_order        Int    @default(0)
}
```

**Loại quan hệ**:
| relationship_type | Ý nghĩa | Ví dụ |
|-------------------|---------|-------|
| `component` | Thành phần combo | Bồn cầu combo → Bồn + Nắp |
| `accessory` | Phụ kiện tương thích | Bồn cầu → Nắp đậy riêng |
| `variant` | Biến thể (khác màu) | Lavabo trắng → Lavabo đen |

### 4.5 Ảnh Sản phẩm ✅

**DB Contract** — `product_images`:
```prisma
model product_images {
  id         Int    @id
  product_id Int                         // FK → products (CASCADE delete)
  image_url  String @db.VarChar(1000)
  alt_text   String? @db.VarChar(300)
  image_type String @default("gallery")  // gallery, spec, lifestyle
  sort_order Int    @default(0)
}
```

### 4.6 Danh sách sản phẩm — UI Mapping

| UI Element | Data Field | Component |
|-----------|-----------|-----------|
| Checkbox | row selection | `Checkbox` (shadcn) |
| Ảnh thumbnail | `image_main_url` | `Avatar` (40x40) |
| Tên + SKU | `name` + `sku` | Text + `Badge` |
| Danh mục / Thương hiệu | `categories.name` + `brands.name` | Text |
| Giá | `price` / `price_display` | Formatted number |
| Tồn kho | `stock_status` | `Badge` (green/red/yellow) |
| Trạng thái | `is_active` | `Switch` |
| Nhãn | `is_featured`, `is_new`, `is_bestseller` | `Badge` group |
| Actions | — | `DropdownMenu` (Edit, Delete, Duplicate) |

### 4.7 Tính năng sản phẩm chưa phát triển 🔲

| Tính năng | Mô tả | DB cần |
|-----------|--------|--------|
| Bulk import Excel | Upload bảng giá NCC → tạo/cập nhật SP | Không (dùng existing schema) |
| Duplicate product | Copy SP → tạo mới với SKU khác | Không |
| Lịch sử giá | Ghi log khi price thay đổi | `product_price_history` model mới |
| Giá khuyến mãi có thời hạn | Giá sale từ ngày X đến ngày Y | `sale_price`, `sale_start`, `sale_end` fields mới |
| Multi-variant management | Quản lý biến thể (màu, size) như 1 entity | `product_variants` model mới |
| Inventory tracking | Số lượng tồn kho thực tế | `stock_quantity` field mới |

---

## 5. QUẢN LÝ ĐƠN HÀNG

### 5.1 DB Contract — Model `orders` + `order_items`

```prisma
model orders {
  id               Int      @id
  order_number     String   @unique @db.VarChar(20)  // Format: DPG20260501XXXXXX
  customer_name    String   @db.VarChar(200)
  customer_phone   String   @db.VarChar(20)
  customer_email   String?  @db.VarChar(200)
  customer_address String?
  note             String?
  subtotal         Decimal  @default(0) @db.Decimal(15, 2)
  shipping_fee     Decimal  @default(0) @db.Decimal(15, 2)
  total            Decimal  @default(0) @db.Decimal(15, 2)
  status           String   @default("pending")  // pending→confirmed→processing→shipping→delivered→cancelled
  payment_method   String?  @db.VarChar(50)
  payment_status   String   @default("unpaid")   // unpaid→paid→refunded
  created_at       DateTime @default(now())
  updated_at       DateTime @default(now())
}

model order_items {
  id           Int     @id
  order_id     Int                          // FK → orders (CASCADE)
  product_id   Int                          // FK → products
  product_name String  @db.VarChar(500)     // Snapshot tại thời điểm đặt
  product_sku  String  @db.VarChar(100)     // Snapshot
  quantity     Int     @default(1)
  unit_price   Decimal @db.Decimal(15, 2)
  total_price  Decimal @db.Decimal(15, 2)
}
```

### 5.2 API Contract

```typescript
createOrder(data): Promise<{ success, id, orderNumber }>
updateOrderStatus(id, status): Promise<Result>
  // Valid: pending → confirmed → processing → shipping → delivered | cancelled
updatePaymentStatus(id, paymentStatus): Promise<Result>
  // Valid: unpaid → paid → refunded
getAdminOrders({ status?, payment_status?, search?, page?, pageSize? })
getAdminOrderById(id: number)
getOrderStats(): { total, pending, processing, delivered, revenue }
```

### 5.3 UI Mapping — Danh sách đơn hàng

| UI Element | Data Field | Component |
|-----------|-----------|-----------|
| Mã đơn | `order_number` | `Badge` variant outline |
| Khách hàng | `customer_name` | Text |
| SĐT | `customer_phone` | Text + copy button |
| Sản phẩm preview | `order_items[0..2]` | Truncated list |
| Tổng tiền | `total` | Formatted VND |
| Trạng thái | `status` | `Select` (inline update) |
| Thanh toán | `payment_status` | `Select` (inline update) |
| Ngày tạo | `created_at` | Relative time |
| Actions | — | `DropdownMenu` |

### 5.4 Tính năng đơn hàng chưa phát triển 🔲

| Tính năng | Mô tả |
|-----------|--------|
| In phiếu giao hàng (PDF) | Generate PDF từ order data |
| Gửi email xác nhận | Email tự động khi status thay đổi |
| Tracking vận chuyển | Tích hợp API GHTK/GHN |
| Ghi chú nội bộ | `admin_notes` field trên orders |
| Export đơn hàng Excel | CSV/XLSX theo khoảng thời gian |

---

## 6. QUẢN LÝ BÁO GIÁ

### 6.1 DB Contract — Model `quote_requests` + `quote_items`

```prisma
model quote_requests {
  id           Int      @id
  quote_number String?  @unique @db.VarChar(30)  // Format: DPG-20260501-XXXX
  name         String   @db.VarChar(100)
  phone        String   @db.VarChar(20)
  email        String?  @db.VarChar(200)
  message      String?
  status       String   @default("pending")      // pending→processing→quoted→confirmed→rejected
  created_at   DateTime @default(now())
  updated_at   DateTime @default(now())
}

model quote_items {
  id         Int    @id
  quote_id   Int                    // FK → quote_requests (CASCADE)
  product_id Int                    // FK → products
  quantity   Int    @default(1)
  note       String? @db.VarChar(500)
}
```

### 6.2 API Contract

```typescript
submitQuoteRequest(payload: QuoteCartPayload): Promise<{ success, quote_number }>
  // QuoteCartPayload = { name, phone, email?, message?, products: [{product_id, quantity, note?}] }
updateQuoteRequestStatus(id, status): Promise<Result>
```

### 6.3 Pipeline báo giá — UI Mapping

| Trạng thái | Ý nghĩa | Màu Badge |
|-----------|---------|-----------|
| `pending` | Mới nhận | 🔴 Red |
| `processing` | Đang xử lý | 🟡 Yellow |
| `quoted` | Đã gửi báo giá | 🔵 Blue |
| `confirmed` | Khách chốt | 🟢 Green |
| `rejected` | Không chốt | ⚫ Gray |

### 6.4 Tính năng báo giá chưa phát triển 🔲

| Tính năng | Mô tả | DB cần |
|-----------|--------|--------|
| Ghi chú nội bộ | Admin note cho từng quote | `admin_notes` field mới |
| Giá báo | Giá admin điền sau khi tính | `quoted_price` trên `quote_items` |
| Xuất PDF báo giá | Generate bảng báo giá gửi khách | Không |
| Gửi Zalo/Email | Gửi link báo giá cho khách | External API |
| Chuyển đổi → Đơn hàng | 1 click convert quote → order | Logic mới |
| Lịch sử liên hệ | Ghi log gọi điện/nhắn tin | `quote_activities` model mới |
| Export CSV | Xuất danh sách báo giá | Không |
