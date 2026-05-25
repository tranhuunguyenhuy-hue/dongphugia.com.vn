# Task Plan: Admin Subdomain Separation
# `dongphugia.com.vn/admin` → `admin.dongphugia.com.vn`

> Tạo: 2026-04-29 | Cập nhật: 2026-04-29 | Người phụ trách: Antigravity

---

## 🎯 Mục tiêu

Tách hoàn toàn CMS Admin ra khỏi main website thành một dự án Next.js độc lập tại
`admin.dongphugia.com.vn`, đồng thời xây dựng lại giao diện CMS mới với shadcn/ui full kit,
kiến trúc scale-ready và trải nghiệm người dùng tốt hơn.

## 📊 Trạng thái Tổng quan

```
[ ] PHASE 0 — Chuẩn bị Main Site (Pre-separation)
[ ] PHASE 1 — Khởi tạo Admin Project Mới
[ ] PHASE 2 — Migrate Data Layer & Auth
[ ] PHASE 3 — Build CMS UI (shadcn/ui)
[ ] PHASE 4 — Cache Invalidation Bridge
[ ] PHASE 5 — Testing & Cutover
[ ] PHASE 6 — Cleanup Main Site
```

---

## PHASE 0 — Chuẩn bị Main Site (Ưu tiên: NGAY BÂY GIỜ)
> Làm trước khi tách để tránh downtime và cache stale

### Task 0.1 — Xây `/api/revalidate` endpoint trên main site
**File**: `src/app/api/revalidate/route.ts`

```typescript
// POST /api/revalidate
// Body: { secret: string, paths: string[], tags: string[] }
// Auth: REVALIDATE_SECRET env var
```

**Paths cần revalidate khi admin thay đổi:**
- `/` (homepage — featured products)
- `/thiet-bi-ve-sinh`, `/thiet-bi-ve-sinh/[sub]`
- `/thiet-bi-bep`, `/thiet-bi-bep/[sub]`
- `/vat-lieu-nuoc`, `/vat-lieu-nuoc/[sub]`
- `/gach-op-lat`, `/gach-op-lat/[sub]`
- `/san-pham/[slug]` (individual product)
- `/blog`, `/blog/[slug]`
- `/du-an`, `/doi-tac`

**Tags cần revalidate:**
- `products`, `categories`, `subcategories`, `brands`
- `blog-posts`, `partners`, `projects`, `banners`

**Status**: [ ] Chưa làm

### Task 0.2 — Add `REVALIDATE_SECRET` env var
- `REVALIDATE_SECRET=<random-256-bit-hex>` vào main site `.env`
- Thêm vào Vercel Environment Variables

**Status**: [ ] Chưa làm

### Task 0.3 — Test revalidate endpoint
```bash
curl -X POST https://dongphugia.com.vn/api/revalidate \
  -H "Content-Type: application/json" \
  -d '{"secret":"...","paths":["/"],"tags":["products"]}'
```

**Status**: [ ] Chưa làm

### Task 0.4 — Bật `ADMIN_MAINTENANCE = true` trên main site layout
Giữ admin cũ ở maintenance mode trong suốt quá trình build admin mới.

**Status**: [ ] Đã bật (từ conversation trước)

---

## PHASE 1 — Khởi tạo Admin Project Mới
> Tạo project Next.js standalone tại `/Users/m-ac/Projects/dongphugia-admin`

### Task 1.1 — Init Next.js project
```bash
npx create-next-app@latest dongphugia-admin \
  --typescript --tailwind --eslint --app --src-dir \
  --no-git
```

**Stack admin mới:**
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- shadcn/ui (New York style, neutral base)
- Prisma (copy schema từ main)
- React Hook Form + Zod
- TanStack Table
- Sonner (toast)
- Lucide React

**Status**: [ ] Chưa làm

### Task 1.2 — Cấu hình shadcn/ui
```bash
npx shadcn@latest init
# Style: New York
# Base color: Neutral
# CSS variables: Yes
```

**Components cần add ngay:**
```bash
npx shadcn@latest add \
  button card input label textarea select badge \
  dialog sheet alert-dialog dropdown-menu \
  table tabs separator tooltip popover \
  command switch checkbox form \
  scroll-area skeleton avatar breadcrumb \
  sonner progress
```

**Status**: [ ] Chưa làm

### Task 1.3 — Copy và cấu hình Prisma
```bash
cp ../dongphugia/prisma/schema.prisma ./prisma/
```

**.env.local:**
```
DATABASE_URL=<same as main site>
DIRECT_URL=<same as main site>
REVALIDATE_SECRET=<same secret>
MAIN_SITE_URL=https://dongphugia.com.vn
ADMIN_PASSWORD=<from main site>
BUNNY_CDN_STORAGE_KEY=<from main site>
BUNNY_CDN_ZONE=<from main site>
```

**Status**: [ ] Chưa làm

---

## PHASE 2 — Migrate Data Layer & Auth

### Task 2.1 — Copy và adapt Server Actions (1,342 lines → Prisma direct)
Các file cần port từ main site:

| File gốc | File đích | Thay đổi |
|----------|-----------|---------|
| `src/lib/product-actions.ts` | `src/lib/product-actions.ts` | Bỏ `revalidatePath`, thêm `callRevalidate()` |
| `src/lib/blog-actions.ts` | `src/lib/blog-actions.ts` | Tương tự |
| `src/lib/order-actions.ts` | `src/lib/order-actions.ts` | Tương tự |
| `src/lib/partner-actions.ts` | `src/lib/partner-actions.ts` | Tương tự |
| `src/lib/project-actions.ts` | `src/lib/project-actions.ts` | Tương tự |
| `src/lib/actions.ts` | `src/lib/actions.ts` | Banners, categories, quotes |

**Pattern thay thế `revalidatePath`:**
```typescript
// BEFORE (main site — Next.js Server Action):
revalidatePath('/thiet-bi-ve-sinh')

// AFTER (admin subdomain):
await callMainSiteRevalidate({
  paths: ['/thiet-bi-ve-sinh', '/'],
  tags: ['products']
})
```

**Status**: [ ] Chưa làm

### Task 2.2 — Tạo `callMainSiteRevalidate` utility
**File**: `src/lib/revalidate.ts`

```typescript
export async function callMainSiteRevalidate(opts: {
  paths?: string[]
  tags?: string[]
}) {
  const secret = process.env.REVALIDATE_SECRET
  const mainUrl = process.env.MAIN_SITE_URL
  await fetch(`${mainUrl}/api/revalidate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, ...opts }),
  })
}
```

**Status**: [ ] Chưa làm

### Task 2.3 — Port Admin Auth
Copy `src/lib/admin-auth.ts` — điều chỉnh cookie domain:
```typescript
// Cookie domain: `.dongphugia.com.vn` (với dấu chấm để share subdomain)
```

**Status**: [ ] Chưa làm

### Task 2.4 — Copy read-only APIs
- `src/lib/public-api-products.ts` (getAdminProducts, getAdminProductById, getProductStats)
- `src/lib/cache.ts` (getCategories, getSubcategories, getBrands, getOrigins, getColors, getMaterials)

**Status**: [ ] Chưa làm

---

## PHASE 3 — Build CMS UI với shadcn/ui Full Kit

### Task 3.1 — Layout Shell
**Kiến trúc layout:**
```
AdminLayout
├── Sidebar (custom, không dùng shadcn Sidebar primitive)
│   ├── Logo + collapse toggle
│   ├── Nav sections:
│   │   ├── "Sản phẩm" → Products
│   │   ├── "Nội dung" → Blog, Projects, Partners, Banners
│   │   └── "Thương mại" → Orders, Quotes, Categories
│   └── Footer: User info + logout
├── TopBar
│   ├── Breadcrumb (auto từ route)
│   ├── Command Palette trigger (Cmd+K)
│   └── Notification bell (pending quotes count)
└── PageContent
```

**Design tokens:**
- Base: `neutral` (zinc/slate)
- Không dùng brand color trong CMS
- Font: Inter (Google Fonts)

**Status**: [ ] Chưa làm

### Task 3.2 — Command Palette
```typescript
// Cmd+K → Command dialog
// Items: điều hướng trang + tìm sản phẩm theo SKU/tên
```

**Status**: [ ] Chưa làm

### Task 3.3 — DataTable Component (Reusable)
**File**: `src/components/admin/data-table.tsx`

Dùng TanStack Table với:
- Column sorting
- Column visibility toggle
- Bulk row selection
- Pagination với page size
- Export CSV

**Status**: [ ] Chưa làm

### Task 3.4 — Products Module
**Pages:**
- `/products` → DataTable với bulk actions, filter drawer
- `/products/new` → Product Form
- `/products/[id]` → Product Form (edit mode)

**Product Form layout (2-column):**
- Left (2/3): Basic info, Description, SEO
- Right (1/3, sticky): Status, Classification, Price, Image, Settings

**Components dùng:**
- `Form` + `Input` + `Select` + `Switch` + `Textarea` (shadcn)
- `AlertDialog` cho unsaved changes guard
- `ImageUploader` (copy từ main site)

**Status**: [ ] Chưa làm

### Task 3.5 — Orders Module
- Orders DataTable với filter theo status/date
- Order detail page
- Quick payment/status update

**Status**: [ ] Chưa làm

### Task 3.6 — Quote Requests Module
- Quotes DataTable
- Quick status update (1 click, không cần modal)
- Export CSV

**Status**: [ ] Chưa làm

### Task 3.7 — Blog Module
- Posts DataTable với filter theo tag
- Post Form với RichTextEditor
- Tags management (inline CRUD)

**Status**: [ ] Chưa làm

### Task 3.8 — Dashboard (Home)
**Stats:**
```
Row 1: Tổng SP | Đang hiển thị | Hết hàng | Nổi bật
Row 2: Báo giá chờ | Hôm nay | Đơn hàng tuần | Blog
```
- Recent pending quotes table
- Recent orders
- Quick action shortcuts

**Status**: [ ] Chưa làm

### Task 3.9 — Login Page
- Layout 2 cột: branding left + form right
- shadcn Form + Input + Button
- Error states đẹp

**Status**: [ ] Chưa làm

### Task 3.10 — Remaining Modules
- Partners (Đối tác)
- Projects (Dự án)
- Banners
- Categories (banner manager)

**Status**: [ ] Chưa làm

---

## PHASE 4 — Cache Invalidation Bridge (CRITICAL)

### Task 4.1 — Map đầy đủ paths cần revalidate theo từng action
```
createProduct/updateProduct/deleteProduct:
  → paths: ['/','category_url','sub_url','product_url']
  → tags: ['products', 'featured-products']

createBlogPost/updateBlogPost:
  → paths: ['/blog', '/blog/[slug]', '/tin-tuc']
  → tags: ['blog-posts']

createBanner/updateBanner:
  → paths: ['/']
  → tags: ['banners']
```

### Task 4.2 — Integration test cache invalidation
- Sửa sản phẩm trong admin → verify main site cập nhật (trong vòng 1-2s)
- Tạo blog post → verify `/blog` cập nhật
- Update banner → verify homepage cập nhật

**Status**: [ ] Chưa làm

---

## PHASE 5 — Testing & Staging Cutover

### Task 5.1 — Deploy lên staging
- `admin-staging.dongphugia.com.vn` → Vercel preview

### Task 5.2 — Smoke tests
- [ ] Login/Logout hoạt động
- [ ] CRUD Products (create, read, update, delete)
- [ ] Cache invalidation verified (thay đổi → main site cập nhật)
- [ ] Image upload (Bunny CDN)
- [ ] Quote status update
- [ ] Order status update
- [ ] Blog CRUD

### Task 5.3 — Production cutover
- Deploy `admin.dongphugia.com.vn` → Vercel production
- DNS: `admin.dongphugia.com.vn` → Vercel CNAME
- Verify tất cả features

**Status**: [ ] Chưa làm

---

## PHASE 6 — Cleanup Main Site

### Task 6.1 — Xóa toàn bộ `/admin` khỏi main site
```bash
rm -rf src/app/admin/
```

### Task 6.2 — Xóa admin-specific libs
- `src/lib/admin-auth.ts` → XÓA (đã move sang admin project)
- `src/lib/product-actions.ts` → REVIEW: giữ nếu có public logic, xóa admin-only parts
- Tương tự các action files khác

### Task 6.3 — Update middleware.ts
```typescript
// Xóa "/admin" khỏi BYPASS_PATHS
const BYPASS_PATHS = [
  "/maintenance",
  "/api",
  "/_next",
  // ... không còn /admin
]
```

### Task 6.4 — Final build check
- `npx tsc --noEmit`
- `npm run build`
- Kiểm tra bundle size (phải nhẹ hơn)

**Status**: [ ] Chưa làm

---

## 🚧 Blockers & Rủi ro

| # | Rủi ro | Mức độ | Mitigation |
|---|--------|--------|-----------|
| 1 | Cache stale nếu revalidate endpoint fail | 🔴 Cao | Retry logic + alert trong `callMainSiteRevalidate` |
| 2 | Cookie domain khác nhau → phải login lại | ⚠️ Trung bình | Config `domain=.dongphugia.com.vn` |
| 3 | Bunny CDN upload từ subdomain | ⚠️ Trung bình | Copy ImageUploader + config CORS |
| 4 | Schema drift (2 projects, 1 DB) | ⚠️ Trung bình | Git submodule hoặc shared prisma package |
| 5 | Double Vercel project = double cost | ℹ️ Thấp | Vercel Pro cho phép unlimited projects |

---

## 📅 Timeline Ước tính

| Phase | Nội dung | Thời gian |
|-------|----------|-----------|
| Phase 0 | Chuẩn bị main site | 2-3 giờ |
| Phase 1 | Khởi tạo admin project | 2 giờ |
| Phase 2 | Migrate data layer & auth | 1 ngày |
| Phase 3 | Build CMS UI | 4-5 ngày |
| Phase 4 | Cache invalidation | 4-6 giờ |
| Phase 5 | Testing & staging | 1 ngày |
| Phase 6 | Cleanup main site | 2-3 giờ |
| **Tổng** | | **~7-8 ngày** |

---

## 🔑 Quyết định Đã Xác nhận (từ brainstorm)

1. ✅ **Không dùng shadcn Sidebar primitive** — custom sidebar dùng `Sheet`, `ScrollArea`, `Button`
2. ✅ **Dùng TanStack DataTable** (pattern shadcn recommendation)
3. ✅ **Dùng React Hook Form + Zod** bridge với direct Prisma mutations
4. ✅ **Neutral color only** — zinc/slate, không dùng brand green
5. ✅ **Cache bridge qua `/api/revalidate`** endpoint trên main site
6. ✅ **2 Vercel projects** — main + admin (shared DB)
