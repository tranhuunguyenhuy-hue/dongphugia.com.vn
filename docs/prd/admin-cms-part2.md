# PRD: Hệ thống Quản trị Website Đông Phú Gia (Phần 2)
# Blog, Banner, Đối tác, Taxonomy, Media, CRM, SEO, Settings

---

## 7. QUẢN LÝ BLOG & NỘI DUNG

### 7.1 DB Contract — Blog Posts

```prisma
model blog_posts {
  id              Int      @id
  title           String   @db.VarChar(300)
  slug            String   @unique @db.VarChar(300)
  excerpt         String?
  content         String   @default("")           // HTML rich text
  category_id     Int                              // FK → blog_categories
  thumbnail_url   String?
  cover_image_url String?
  seo_title       String?  @db.VarChar(200)
  seo_description String?  @db.VarChar(500)
  seo_keywords    String?  @db.VarChar(500)
  reading_time    Int?
  view_count      Int      @default(0)
  status          String   @default("draft")      // draft, published, scheduled
  published_at    DateTime?
  author_name     String   @default("Đông Phú Gia") @db.VarChar(100)
  author_avatar   String?
  is_featured     Boolean  @default(false)
  is_pinned       Boolean  @default(false)
  created_at      DateTime @default(now())
  updated_at      DateTime @default(now())
}

model blog_categories {
  id              Int      @id
  name            String   @db.VarChar(100)
  slug            String   @unique @db.VarChar(100)
  description     String?
  thumbnail_url   String?
  is_active       Boolean  @default(true)
  sort_order      Int      @default(0)
  seo_title       String?  @db.VarChar(200)
  seo_description String?  @db.VarChar(500)
}

model blog_tags {
  id          Int    @id
  name        String @db.VarChar(50)
  slug        String @unique @db.VarChar(50)
  description String?
  post_count  Int    @default(0)    // Auto-updated via raw SQL
}

model blog_post_tags {
  post_id Int   // Composite PK (post_id, tag_id)
  tag_id  Int
}
```

### 7.2 API Contract

```typescript
createBlogPost(data): Promise<{ success, id } | { errors }>
updateBlogPost(id, data): Promise<Result>
deleteBlogPost(id): Promise<Result>
createBlogTag(data): Promise<{ success, id }>
deleteBlogTag(id): Promise<Result>
incrementViewCount(postId): void
```

### 7.3 Trường thông tin Blog Post

| Trường | DB Field | Bắt buộc | Component |
|--------|----------|:--------:|-----------|
| Tiêu đề | `title` | ✓ | `Input` |
| Slug | `slug` | ✓ | `Input` (auto-gen) |
| Tóm tắt | `excerpt` | — | `Textarea` |
| Nội dung | `content` | — | `RichTextEditor` ✅ |
| Chuyên mục | `category_id` | ✓ | `Select` |
| Ảnh thumbnail | `thumbnail_url` | — | `ImageUploader` |
| Ảnh bìa | `cover_image_url` | — | `ImageUploader` |
| Tags | `tag_ids[]` | — | `Combobox` multi-select |
| Trạng thái | `status` | ✓ | `Select` (draft/published/scheduled) |
| Ngày xuất bản | `published_at` | — | `DatePicker` |
| Tác giả | `author_name` | ✓ | `Input` (default: "Đông Phú Gia") |
| Avatar tác giả | `author_avatar` | — | `ImageUploader` |
| Nổi bật | `is_featured` | — | `Switch` |
| Ghim | `is_pinned` | — | `Switch` |
| Thời gian đọc | `reading_time` | — | `Input` (number, phút) |
| SEO Title | `seo_title` | — | `Input` + char counter |
| SEO Description | `seo_description` | — | `Textarea` + char counter |
| SEO Keywords | `seo_keywords` | — | `Input` (comma-separated) |

### 7.4 Tính năng Blog chưa phát triển 🔲

| Tính năng | Mô tả |
|-----------|--------|
| Scheduled publish | Đặt lịch xuất bản tự động |
| Revision history | Lưu lịch sử chỉnh sửa |
| Draft preview | Xem preview bài nháp trên frontend |
| Related posts | Liên kết bài viết liên quan |
| Comment system | Hệ thống bình luận |
| Image gallery trong bài | Multi-image embed trong content |

---

## 8. QUẢN LÝ TRANG CHỦ & BANNER

### 8.1 DB Contract — Model `banners`

```prisma
model banners {
  id         Int      @id
  title      String?  @db.VarChar(200)
  image_url  String   @db.VarChar(500)
  link_url   String?  @db.VarChar(500)
  is_active  Boolean  @default(true)
  sort_order Int      @default(0)
  created_at DateTime? @default(now())
  updated_at DateTime? @default(now())
}
```

### 8.2 API Contract

```typescript
createBanner(data): Promise<Result>
updateBanner(id, data): Promise<Result>
deleteBanner(id): Promise<Result>
updateCategoryBanner(id, banner_url): Promise<Result>
```

### 8.3 UI Mapping

| UI Element | Data Field | Component |
|-----------|-----------|-----------|
| Preview | `image_url` | Image preview (responsive) |
| Tiêu đề | `title` | `Input` (optional) |
| Link đích | `link_url` | `Input` URL |
| Hiển thị | `is_active` | `Switch` |
| Thứ tự | `sort_order` | `Input` number |
| Actions | — | Edit, Delete buttons |

### 8.4 Tính năng banner chưa phát triển 🔲

| Tính năng | Mô tả |
|-----------|--------|
| Drag & drop reorder | Kéo thả sắp xếp thứ tự |
| Banner scheduling | Lịch hiển thị (start_date, end_date) |
| Banner analytics | Click count, impression count |
| Mobile banner riêng | Ảnh riêng cho mobile vs desktop |
| Popup banner | Banner dạng popup/modal |

---

## 9. QUẢN LÝ ĐỐI TÁC & DỰ ÁN

### 9.1 DB Contract — `partners`

```prisma
model partners {
  id             Int      @id
  name           String   @db.VarChar(200)
  slug           String   @unique @db.VarChar(200)
  logo_url       String?  @db.VarChar(500)
  description    String?
  tier           String?  @default("Vàng") @db.VarChar(50)  // Vàng, Bạc, Đồng
  gradient_class String?  @db.VarChar(100)
  link_url       String?  @db.VarChar(500)
  is_active      Boolean? @default(true)
  sort_order     Int?     @default(0)
}
```

### 9.2 DB Contract — `projects`

```prisma
model projects {
  id            Int      @id
  title         String   @db.VarChar(200)
  slug          String   @unique @db.VarChar(200)
  location      String?  @db.VarChar(200)
  thumbnail_url String?  @db.VarChar(500)
  description   String?
  category      String?  @db.VarChar(100)    // "Biệt thự", "Khách sạn", etc.
  tags          String[] @default([])
  is_featured   Boolean? @default(false)
  is_active     Boolean? @default(true)
  sort_order    Int?     @default(0)
}
```

### 9.3 API Contract

```typescript
// Partners
createPartner(data): Promise<Result>
updatePartner(id, data): Promise<Result>
deletePartner(id): Promise<Result>

// Projects
createProject(data): Promise<Result>
updateProject(id, data): Promise<Result>
deleteProject(id): Promise<Result>
```

### 9.4 Tính năng chưa phát triển 🔲

| Tính năng | Module | Mô tả |
|-----------|--------|--------|
| Project gallery | Dự án | Multi-image gallery cho từng dự án |
| Product tagging | Dự án | Gắn sản phẩm đã dùng vào dự án |
| Partner products | Đối tác | Xem danh sách SP theo thương hiệu đối tác |

---

## 10. DANH MỤC & TAXONOMY

### 10.1 DB Contract — `categories` + `subcategories`

```prisma
model categories {
  id              Int    @id
  name            String @db.VarChar(100)
  slug            String @unique @db.VarChar(100)
  description     String?
  thumbnail_url   String? @db.VarChar(1000)
  banner_url      String? @db.VarChar(1000)
  icon_name       String? @db.VarChar(50)
  is_active       Boolean @default(true)
  sort_order      Int     @default(0)
  seo_title       String? @db.VarChar(200)
  seo_description String? @db.VarChar(500)
}

model subcategories {
  id              Int    @id
  category_id     Int                     // FK → categories (CASCADE)
  name            String @db.VarChar(200)
  slug            String @db.VarChar(200)
  description     String?
  thumbnail_url   String? @db.VarChar(1000)
  hero_image_url  String? @db.VarChar(1000)
  icon_name       String? @db.VarChar(50)
  is_active       Boolean @default(true)
  sort_order      Int     @default(0)
  seo_title       String? @db.VarChar(200)
  seo_description String? @db.VarChar(500)
}
```

### 10.2 Lookup Tables

| Model | Fields | Quản lý |
|-------|--------|---------|
| `brands` | name, slug, logo_url, description, origin_country, website_url, is_featured | ✅ Indirect (qua product form) |
| `colors` | name, slug, hex_code | ✅ DB direct |
| `origins` | name, slug | ✅ DB direct |
| `materials` | name, slug, description, sort_order | ✅ DB direct |
| `product_features` | name, slug, icon_name, description | ✅ DB direct |

### 10.3 Filter Definitions ✅

```prisma
model filter_definitions {
  id             Int     @id
  category_id    Int?                   // Áp dụng cho category
  subcategory_id Int?                   // Hoặc subcategory
  filter_key     String  @db.VarChar(100)   // VD: "Kiểu xả", "Chế độ nước"
  filter_label   String  @db.VarChar(200)
  filter_type    String  @default("select") // select, multi-select, range
  options        Json?                      // ["Xoáy", "Ngang", "Đứng"]
  sort_order     Int     @default(0)
  is_active      Boolean @default(true)
}
```

### 10.4 Tính năng Taxonomy chưa phát triển 🔲

| Tính năng | Mô tả |
|-----------|--------|
| CRUD Categories trong UI | Hiện chỉ quản lý banner category |
| CRUD Subcategories | Thêm/sửa/xóa subcategory |
| CRUD Brands | Full brand management page |
| CRUD Colors/Origins/Materials | Lookup table management UI |
| Filter builder | UI để tạo/sửa filter_definitions |
| Drag & drop reorder | Sắp xếp categories/subcategories |

---

## 11. MEDIA LIBRARY 🔲 Chưa phát triển

### 11.1 Hiện tại
- Upload ảnh trực tiếp trong product form → Bunny CDN
- Component: `src/components/ui/image-uploader.tsx`
- Không có thư viện ảnh tập trung

### 11.2 Tính năng cần xây dựng

| Tính năng | Mô tả | DB cần |
|-----------|--------|--------|
| Thư viện ảnh tập trung | Browse, search, filter ảnh đã upload | `media_files` model mới |
| Bulk upload | Upload nhiều ảnh cùng lúc | — |
| Folder / Album | Tổ chức ảnh theo nhóm | `media_folders` model mới |
| Image metadata | Alt text, caption, dimensions | Fields trong `media_files` |
| Reuse ảnh | Chọn ảnh từ thư viện cho SP/Blog | Picker component |
| Auto-optimize | Resize, compress khi upload | CDN transform URL |

**DB đề xuất**:
```prisma
model media_files {
  id          Int      @id @default(autoincrement())
  filename    String   @db.VarChar(300)
  url         String   @db.VarChar(1000)
  mime_type   String   @db.VarChar(100)
  file_size   Int                          // bytes
  width       Int?
  height      Int?
  alt_text    String?  @db.VarChar(300)
  folder_id   Int?                         // FK → media_folders
  uploaded_by Int?                         // FK → admin_users
  created_at  DateTime @default(now())
}
```

---

## 12. CRM KHÁCH HÀNG 🔲 Chưa phát triển

### 12.1 Hiện tại
- Thông tin KH nằm rải rác trong `quote_requests` và `orders`
- Không có view tổng hợp theo khách

### 12.2 Tính năng cần xây dựng

| Tính năng | Mô tả | DB cần |
|-----------|--------|--------|
| Danh sách KH | Tổng hợp từ quotes + orders theo phone | `customers` model mới |
| Profile KH | Tên, SĐT, email, địa chỉ, ghi chú | — |
| Lịch sử tương tác | Báo giá + đơn hàng + ghi chú | Aggregate queries |
| Ghi chú nội bộ | Admin note cho KH | `customer_notes` model |
| Phân nhóm KH | B2B (nhà thầu) vs B2C (cá nhân) | `customer_type` field |

**DB đề xuất**:
```prisma
model customers {
  id           Int      @id @default(autoincrement())
  name         String   @db.VarChar(200)
  phone        String   @unique @db.VarChar(20)
  email        String?  @db.VarChar(200)
  address      String?
  customer_type String  @default("individual") // individual, contractor, company
  company_name String?  @db.VarChar(200)
  tax_id       String?  @db.VarChar(20)
  total_orders Int      @default(0)
  total_spent  Decimal  @default(0) @db.Decimal(15, 2)
  notes        String?
  created_at   DateTime @default(now())
  updated_at   DateTime @default(now())
}
```

---

## 13. SEO & REDIRECT

### 13.1 DB Contract — `redirects` ✅

```prisma
model redirects {
  id          Int      @id
  old_url     String   @unique @db.VarChar(500)
  new_url     String   @db.VarChar(500)
  status_code Int?     @default(301)
  is_active   Boolean? @default(true)
}
```

### 13.2 Hiện tại
- 3,323 redirect mappings trong `src/data/product-redirect-map.json`
- Xử lý trong `middleware.ts` (301 redirect)
- SEO fields trên products: `seo_title`, `seo_description`
- SEO fields trên blog: `seo_title`, `seo_description`, `seo_keywords`
- SEO fields trên categories/subcategories: `seo_title`, `seo_description`

### 13.3 Tính năng SEO chưa phát triển 🔲

| Tính năng | Mô tả |
|-----------|--------|
| Redirect manager UI | CRUD redirects trong CMS |
| Sitemap generator | Auto-generate sitemap.xml |
| SEO audit dashboard | Check missing titles, descriptions |
| OG image preview | Preview social sharing image |
| Canonical URL management | Quản lý canonical cho duplicate content |
| JSON-LD / Schema markup editor | Structured data management |

---

## 14. CÀI ĐẶT HỆ THỐNG 🔲 Chưa phát triển

### 14.1 Thông tin công ty

| Cài đặt | Giá trị hiện tại (hardcoded) | DB cần |
|---------|------------------------------|--------|
| Tên công ty | "Đông Phú Gia" | `site_settings` model |
| Địa chỉ | Hardcoded trong footer | — |
| Hotline | Hardcoded | — |
| Email | Hardcoded | — |
| Zalo | Hardcoded | — |
| Facebook | Hardcoded | — |
| Logo | Static file | — |

**DB đề xuất**:
```prisma
model site_settings {
  id    Int    @id @default(autoincrement())
  key   String @unique @db.VarChar(100)
  value String
  type  String @default("text") // text, url, image, json
}
```

### 14.2 Tính năng Settings chưa phát triển 🔲

| Tính năng | Mô tả |
|-----------|--------|
| Company info editor | Sửa thông tin công ty |
| Social links | Quản lý link mạng xã hội |
| Footer content | Quản lý nội dung footer |
| Maintenance mode toggle | Bật/tắt maintenance trong CMS |
| Cache clear button | Xóa cache thủ công |

---

## 15. THÔNG BÁO & AUDIT LOG 🔲 Chưa phát triển

### 15.1 Notifications

| Tính năng | Mô tả | DB cần |
|-----------|--------|--------|
| In-app bell | Badge count cho quotes/orders mới | `notifications` model |
| Real-time | WebSocket hoặc polling | — |
| Email notification | Gửi email khi có báo giá mới | External service |
| Zalo notification | Gửi tin nhắn Zalo OA | Zalo API |

**DB đề xuất**:
```prisma
model notifications {
  id         Int      @id @default(autoincrement())
  type       String   @db.VarChar(50)    // quote_new, order_new, etc.
  title      String   @db.VarChar(200)
  message    String?
  link       String?  @db.VarChar(500)
  is_read    Boolean  @default(false)
  user_id    Int?                         // FK → admin_users
  created_at DateTime @default(now())
}
```

### 15.2 Audit Log

| Tính năng | Mô tả | DB cần |
|-----------|--------|--------|
| Activity log | Ai làm gì, lúc mấy giờ | `audit_logs` model |
| Change tracking | Giá trị cũ → giá trị mới | JSON diff |
| Login history | Lịch sử đăng nhập | `login_history` model |

**DB đề xuất**:
```prisma
model audit_logs {
  id          Int      @id @default(autoincrement())
  user_id     Int?                         // FK → admin_users
  action      String   @db.VarChar(50)     // create, update, delete, login
  entity_type String   @db.VarChar(50)     // product, order, quote, blog
  entity_id   Int?
  old_values  Json?
  new_values  Json?
  ip_address  String?  @db.VarChar(45)
  created_at  DateTime @default(now())
}
```

---

## PHỤ LỤC A: Tổng hợp trạng thái tính năng

### ✅ Đã có và hoạt động
| Module | Tính năng |
|--------|-----------|
| Auth | Single-user HMAC-SHA256 login |
| Products | CRUD, bulk delete/toggle, image upload, gallery |
| Orders | CRUD, status/payment update, detail page |
| Quotes | Submit (public), status update (admin) |
| Blog | Posts CRUD, tags CRUD, rich text editor |
| Banners | CRUD homepage banners |
| Partners | CRUD |
| Projects | CRUD |
| Categories | Banner manager |
| Dashboard | Basic stat cards + pending quotes table |

### 🔲 Chưa phát triển — Ưu tiên cao
| Module | Tính năng |
|--------|-----------|
| Products | Bulk import Excel, duplicate, price history |
| Quotes | Pipeline kanban, admin notes, PDF export, quote→order |
| Orders | PDF invoice, email notification, export |
| Dashboard | Charts, top products, conversion rate |
| Search | Command Palette (Cmd+K) |
| DataTable | Sort, filter, column visibility, bulk actions |

### 🔲 Chưa phát triển — Ưu tiên trung bình
| Module | Tính năng |
|--------|-----------|
| Media | Centralized media library |
| CRM | Customer profiles, interaction history |
| Taxonomy | Full CRUD for categories, brands, colors |
| Notifications | In-app bell, real-time |
| SEO | Redirect manager, sitemap, audit |
| Settings | Company info, social links, maintenance toggle |

### 🔲 Chưa phát triển — Ưu tiên thấp
| Module | Tính năng |
|--------|-----------|
| Auth | Multi-user, roles & permissions |
| Audit | Activity log, change tracking |
| Blog | Scheduled publish, revision history, comments |
| Analytics | Product views, quote conversion funnel |
| Integration | Zalo OA, Email marketing, Shipping APIs |
