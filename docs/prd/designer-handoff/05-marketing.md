# 05 — Marketing: Media, Blog, SEO

---

## A. MEDIA `/media`

### Tổng quan
Trang quản lý tập trung tất cả hình ảnh hiển thị trên website. Gồm 2 tabs:

```
[Banner trang chủ]  [Thư viện ảnh 🔲]
```

### Tab "Banner trang chủ" ✅

#### DB Contract
- Model: `banners` (7 fields)

#### API Contract
```typescript
createBanner(data): Promise<Result>
updateBanner(id, data): Promise<Result>
deleteBanner(id): Promise<Result>
```

#### Layout
Hiển thị dạng visual list (không phải DataTable):

Mỗi banner = Card gồm:
- Image preview (ratio 16:5)
- Toggle switch ON/OFF (góc phải trên)
- Số thứ tự (#1, #2...)
- Buttons: `[Sửa]` `[🗑]`

Cuối danh sách:
- Dashed card: "Kéo thả hoặc click để thêm banner mới"

#### Banner Form (Dialog)

| Field | DB | Required | Component |
|-------|-----|:--------:|-----------|
| Tiêu đề | `title` | — | Input |
| Ảnh banner | `image_url` | ✓ | ImageUploader (ratio 16:5) |
| Link đích | `link_url` | — | Input URL |
| Hiển thị | `is_active` | — | Switch |
| Thứ tự | `sort_order` | — | Input number |

### Tab "Thư viện ảnh" 🔲 Tương lai
- Grid ảnh với upload, search, filter
- Sẽ phát triển khi có model `media_files`

---

## B. BLOG `/blog`

### Tổng quan
Trang quản lý blog với 2 tabs:

```
[Bài viết]  [Tags]
```

### Tab "Bài viết"

#### DB Contract
- Model: `blog_posts` + `blog_categories` + `blog_tags` + `blog_post_tags`

#### API Contract
```typescript
createBlogPost(data): Promise<{ success, id }>
updateBlogPost(id, data): Promise<Result>
deleteBlogPost(id): Promise<Result>
```

#### Page Header
- Title: "Blog"
- Button: `[+ Viết bài mới]` → `/blog/new`

#### Tabs filter (theo status)
`[Tất cả 24]` `[Đã đăng 18]` `[Nháp 6]`

#### Filter bar
- Search: Tìm tiêu đề
- Dropdown: Chuyên mục

#### DataTable

| Column | Data | Component |
|--------|------|-----------|
| Ảnh | `thumbnail_url` | Avatar 48x48 |
| Tiêu đề | `title` | Text max 2 lines |
| Chuyên mục | `blog_categories.name` | Badge |
| Tác giả | `author_name` | Text |
| Views | `view_count` | Number formatted |
| Tags | `blog_tags[]` | Badge group (max 2 + "+N") |
| Status | `status` | Badge colored |
| Ngày | `published_at` or `created_at` | Date |
| ••• | Actions | DropdownMenu |

---

### Form Bài viết `/blog/new` & `/blog/[id]`

**Layout 2 cột**:

**Cột trái (flex)**: Content

| Field | DB | Required | Component |
|-------|-----|:--------:|-----------|
| Tiêu đề | `title` | ✓ | Input |
| Slug | `slug` | ✓ | Input auto-gen |
| Tóm tắt | `excerpt` | — | Textarea |
| Nội dung | `content` | — | Rich text editor (TipTap, min-height 400px) |

**Cột phải (320px) — Sidebar cards**:

Card "Xuất bản":

| Field | DB | Component |
|-------|-----|-----------|
| Trạng thái | `status` | Select (draft/published) |
| Chuyên mục | `category_id` | Select |
| Tags | `tag_ids[]` | Combobox multi-select |
| Ngày xuất bản | `published_at` | DatePicker |
| Nổi bật | `is_featured` | Switch |
| Ghim | `is_pinned` | Switch |
| Tác giả | `author_name` | Input |
| Thời gian đọc | `reading_time` | Input number (phút) |

Card "Hình ảnh":

| Field | DB | Component |
|-------|-----|-----------|
| Thumbnail | `thumbnail_url` | ImageUploader |
| Ảnh bìa | `cover_image_url` | ImageUploader |

Card "SEO":

| Field | DB | Component |
|-------|-----|-----------|
| SEO Title | `seo_title` | Input + counter (0/200) |
| SEO Desc | `seo_description` | Textarea + counter (0/500) |
| Keywords | `seo_keywords` | Input comma-sep |

Card "Actions":
- `[Lưu nháp]` `[Đăng bài]`

---

### Tab "Tags"

Layout đơn giản:

**Form thêm tag** (inline phía trên):
- Input "Tên tag" + Input "Slug" + Button `[Thêm]`

**Table**:

| Column | Data | Component |
|--------|------|-----------|
| Tên | `name` | Text |
| Slug | `slug` | Text muted |
| Số bài | `post_count` | Number |
| Xóa | — | Button 🗑 + ConfirmDialog |

---

## C. SEO `/seo`

### Tổng quan
Trang quản lý SEO với 2 tabs:

```
[Redirects]  [Cấu hình SEO 🔲]
```

### Tab "Redirects" ✅

#### DB Contract
- Model: `redirects` (5 fields)
- Hiện có: 3,323 redirect mappings

#### Layout

**Form thêm redirect** (inline phía trên):
- Input "URL cũ" + Input "URL mới" + Select "301/302" + Button `[Thêm]`

**DataTable**:

| Column | Data | Component |
|--------|------|-----------|
| URL cũ | `old_url` | Text truncated |
| URL mới | `new_url` | Text truncated |
| Status code | `status_code` | Badge (301/302) |
| Active | `is_active` | Switch |
| Xóa | — | Button 🗑 |

- Search: Tìm theo URL
- Pagination: 50 per page

### Tab "Cấu hình SEO" 🔲 Tương lai
- Sitemap generator
- Global meta tags
- JSON-LD / Schema markup
- OG image preview

---

## States chung Marketing

| State | Hiển thị |
|-------|---------|
| Loading | Skeleton tương ứng |
| Empty | EmptyState với CTA phù hợp |
| Success create | Toast "Đã tạo thành công" |
| Success update | Toast "Đã cập nhật" |
| Delete confirm | AlertDialog |
