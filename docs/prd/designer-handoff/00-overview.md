# PRD Designer Handoff — Đông Phú Gia Admin CMS (V2)
# admin.dongphugia.com.vn

> **Phiên bản**: 2.0 | **Ngày**: 02/05/2026
> **Design System**: shadcn/ui — New York style, Neutral palette (zinc/slate)
> **Target**: Desktop-first (1280px+), responsive down to 768px

---

## 🎨 Design Constraints

| Thuộc tính | Giá trị |
|-----------|---------|
| **Color Palette** | Neutral only (zinc/slate). KHÔNG dùng brand color (xanh lá) |
| **UI Kit** | shadcn/ui components — New York variant |
| **Typography** | Inter (body) + JetBrains Mono (code/numbers) |
| **Border Radius** | `radius: 0.5rem` (shadcn default) |
| **Dark Mode** | Hỗ trợ (toggle trong Settings) |
| **Min Width** | 768px (tablet landscape) |
| **Primary Actions** | Neutral-900 buttons (không dùng blue/green primary) |

---

## 🗂️ Sitemap V2

```
admin.dongphugia.com.vn/
├── /login                              ← Đăng nhập
├── / (Dashboard)                       ← Tổng quan
│
├── /products                           ← Tất cả sản phẩm
│   ├── /products?category=1            ← Thiết bị Vệ sinh (pre-filtered)
│   ├── /products?category=2            ← Thiết bị Bếp
│   ├── /products?category=3            ← Gạch ốp lát
│   ├── /products?category=4            ← Vật liệu Nước
│   ├── /products/new                   ← Thêm SP mới
│   └── /products/[id]                  ← Sửa SP
│
├── /quotes                             ← Báo giá
│   └── /quotes/[id]                    ← Chi tiết báo giá
├── /orders                             ← Đơn hàng
│   └── /orders/[id]                    ← Chi tiết đơn hàng
│
├── /media                              ← Banner + Thư viện ảnh
├── /promotions                         ← Chương trình KM (🔲 tương lai)
├── /blog                               ← Bài viết (tab: Posts | Tags)
│   ├── /blog/new                       ← Viết bài mới
│   └── /blog/[id]                      ← Sửa bài viết
├── /seo                                ← Redirects + Meta (tab-based)
│
└── /settings                           ← Cài đặt hệ thống
    └── /settings/integrations          ← Tích hợp MISA (🔲 tương lai)
```

---

## 📐 Layout Master

### Desktop (≥1280px)
- **Sidebar**: 240px, collapsible groups
- **Header**: Breadcrumb + Global Search (Cmd+K) + Notifications bell
- **Main Content**: max-width 1400px, padding 24px

### Tablet (768–1279px)
- Sidebar collapsed → icon-only (64px)
- Click hamburger → Sheet overlay

### Sidebar Navigation (V2 — 4 Groups)

```
📊 Tổng quan

📦 Sản phẩm ▾
   ├── Tất cả sản phẩm
   ├── Thiết bị Vệ sinh    (badge: 1847)
   ├── Thiết bị Bếp         (badge: 892)
   ├── Gạch ốp lát          (badge: 456)
   └── Vật liệu Nước        (badge: 198)

🛒 Bán hàng ▾
   ├── Báo giá              (badge: 🔴 12 pending)
   └── Đơn hàng             (badge: 🔴 8 pending)

📢 Marketing ▾
   ├── Media
   ├── Chương trình          (🔲 mờ, tooltip "Đang phát triển")
   ├── Blog
   └── SEO

────────────────
⚙️ Cài đặt

────────────────
👤 Admin    [Đăng xuất]
```

**So sánh V1 vs V2**:
- V1: 15 items flat → khó navigate
- V2: 4 groups + 13 items → gọn hơn 60%, logic rõ ràng

---

## 📑 File Index — Chi tiết từng trang

| File | Nội dung |
|------|----------|
| `01-login.md` | Trang đăng nhập |
| `02-dashboard.md` | Dashboard tổng quan (charts + action items) |
| `03-products.md` | Sản phẩm: Brand section + DataTable + Form |
| `04-sales.md` | Bán hàng: Báo giá + Đơn hàng |
| `05-marketing.md` | Marketing: Media, Blog, SEO |
| `06-settings.md` | Cài đặt + Tích hợp MISA |

---

## 🔄 Shared Components

| Component | shadcn/ui | Ghi chú |
|-----------|-----------|---------|
| DataTable | `Table` + TanStack Table | Sort, filter, pagination, row selection, bulk actions |
| PageHeader | Custom | Title + description + action buttons |
| StatusBadge | `Badge` | Color-coded theo status |
| ConfirmDialog | `AlertDialog` | Xác nhận xóa/thao tác nguy hiểm |
| ImageUploader | Custom | Drag & drop, preview, Bunny CDN |
| EmptyState | Custom | Icon + message + CTA khi không có data |
| SearchInput | `Input` + debounce | 300ms debounce, clear button, search by name + SKU |
| FormSection | `Card` | Group form fields có header |
| UnsavedGuard | Custom | Cảnh báo khi rời trang chưa save |
| CommandPalette | `Command` (cmdk) | Cmd+K global search toàn app |
| BulkActionBar | Custom | Floating bar khi có row selected |
| BrandChips | Custom | Chip/badge row với add/remove/filter |
| DrawerPreview | `Sheet` | Quick-view panel từ phải |

---

## Loại bỏ khỏi V2 (so với V1)

| Module | Lý do |
|--------|-------|
| Đối tác (`/partners`) | Tạm không cần quản lý |
| Dự án (`/projects`) | Tạm không cần quản lý |
| Khách hàng (`/customers`) | Defer — chưa phát triển |
| Danh mục (`/categories`) | Admin không được chỉnh sửa (fixed) |
| Thương hiệu (`/brands`) | Gộp inline trong category page |
