# PROJECT.md — Đông Phú Gia Web Platform

> **Tài liệu handoff cho AI Agent** — Đọc file này ĐẦU TIÊN khi vào dự án.
> Cập nhật lần cuối: **15/02/2026 02:25 ICT**

---

## 1. Tổng Quan Dự Án

**Đông Phú Gia** là website showcase + quản trị sản phẩm vật liệu xây dựng (gạch ốp lát, thiết bị vệ sinh, nhà bếp...).

| Key | Value |
|---|---|
| **Domain** | dongphugia.com.vn |
| **Loại** | E-commerce showcase (không có giỏ hàng, dùng "Báo giá") |
| **Mục tiêu** | Website chuyên nghiệp hiển thị sản phẩm + Admin CMS đầy đủ |
| **Ngôn ngữ giao tiếp** | Tiếng Việt |
| **Code conventions** | Tên biến/hàm: Tiếng Anh, Comment: Tiếng Anh |

---

## 2. Tech Stack

```
Frontend:   Next.js 16.1.6 + React 19.2.3 + TypeScript 5
Styling:    Tailwind CSS v4 (dùng @theme, @source directives)
UI:         shadcn/ui (Radix UI) + Lucide React icons
Auth:       NextAuth v5 (beta.30) — Credentials provider
Database:   Supabase PostgreSQL (production)
ORM:        Prisma 5.22.0
Forms:      React Hook Form + Zod validation
Toasts:     Sonner
Deploy:     Vercel (planned)
```

### ⚠️ Lưu ý quan trọng về Tailwind CSS v4

Dự án dùng **Tailwind v4** — KHÔNG có file `tailwind.config.js`. Cấu hình nằm trong:
- `src/app/globals.css` → `@theme { }` block (design tokens)
- `@import "tailwindcss" source(none);` + `@source "..";` (content scanning)
- `postcss.config.mjs` → chỉ có `@tailwindcss/postcss` plugin

---

## 3. Database Schema (12 Models)

```
AdminUser          — Admin login credentials
Category           — 5 danh mục chính (self-referencing hierarchy)
├── ProductType    — Sub-categories (Gạch vân đá, Gạch vân gỗ...)
│   └── Collection — Bộ sưu tập (Inside Art, Mosaic...)
│       └── Product— Sản phẩm (có specs riêng cho gạch)
Brand              — Thương hiệu
Banner             — Banner trang chủ
Post               — Bài viết / Tin tức
Partner            — Đối tác (logo + link)
Project            — Dự án tham khảo
QuoteRequest       — Yêu cầu báo giá
└── QuoteItem      — Sản phẩm trong đơn báo giá
```

**5 Categories chính:**
1. `gach-op-lat` — Gạch ốp lát *(ĐÃ HOÀN THIỆN admin)*
2. `thiet-bi-ve-sinh` — Thiết bị vệ sinh *(chưa mở admin)*
3. `thiet-bi-nha-bep` — Thiết bị nhà bếp *(chưa mở admin)*
4. `thiet-bi-nghanh-nuoc` — Thiết bị ngành nước *(chưa mở admin)*
5. `san-go-san-nhua` — Sàn gỗ / sàn nhựa *(chưa mở admin)*

---

## 4. Cấu Trúc Thư Mục

```
src/
├── app/
│   ├── (public)/              # Frontend công khai
│   │   ├── page.tsx           # Homepage
│   │   ├── layout.tsx         # Public layout (Header + Footer)
│   │   ├── danh-muc/[slug]/   # Category listing
│   │   ├── san-pham/[slug]/   # Product detail
│   │   ├── bo-suu-tap/[slug]/ # Collection page
│   │   └── tin-tuc/           # News listing + detail
│   │
│   ├── admin/
│   │   ├── login/             # Login page (split-screen premium)
│   │   └── (dashboard)/       # Authenticated admin pages
│   │       ├── layout.tsx     # Sidebar + Header wrapper
│   │       ├── admin-header.tsx # Breadcrumb + date bar
│   │       ├── sidebar-nav.tsx # Collapsible sidebar
│   │       ├── page.tsx       # Dashboard (gradient stat cards)
│   │       ├── gach-op-lat/   # ★ Tiles CRUD (most complete)
│   │       ├── banners/       # Banner CRUD
│   │       ├── bai-viet/      # Post CRUD
│   │       ├── du-an/         # Project CRUD
│   │       ├── doi-tac/       # Partner CRUD
│   │       ├── bao-gia/       # Quote management
│   │       ├── collections/   # Collection CRUD
│   │       └── products/      # Generic product CRUD
│   │
│   ├── api/
│   │   ├── auth/[...nextauth]/ # NextAuth API route
│   │   └── upload/            # Image upload API
│   │
│   ├── globals.css            # ★ Design tokens + animations
│   ├── layout.tsx             # Root layout (fonts)
│   └── sitemap.ts             # Dynamic sitemap
│
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── layout/                # Header, Footer, Sidebar
│   ├── home/                  # Homepage sections
│   ├── category/              # Category page components
│   ├── product/               # Product detail components
│   └── quote/                 # Quote dialog
│
├── lib/
│   ├── prisma.ts              # Prisma client singleton
│   ├── utils.ts               # cn() utility
│   ├── actions.ts             # ★ Main server actions (Products, Collections, Banners, ProductTypes)
│   ├── post-actions.ts        # Post CRUD actions
│   ├── partner-actions.ts     # Partner CRUD actions
│   ├── project-actions.ts     # Project CRUD actions
│   ├── quote-actions.ts       # Quote submission (public)
│   ├── quote-admin-actions.ts # Quote management (admin)
│   └── public-api.ts          # Public data fetching
│
├── auth.ts                    # NextAuth configuration
└── auth.config.ts             # Auth providers (Credentials)
```

---

## 5. Trạng Thái Hiện Tại (15/02/2026)

### ✅ Đã Hoàn Thành

| Module | Chi tiết |
|---|---|
| **Database + Seed** | 12 models, seed data đầy đủ |
| **Auth** | Login/Logout, session-based redirect |
| **Admin Dashboard** | Gradient stat cards, quick actions, recent products table |
| **Admin UI Pro Max** | 8/8 stories done — login, sidebar (collapsible), header, dashboard, table, tile products |
| **Gạch ốp lát CRUD** | Full: ProductType → Collection → Product (create/edit/delete) |
| **Banners CRUD** | Full: create/edit/delete with image upload |
| **Bài viết CRUD** | Full: create/edit/delete |
| **Dự án CRUD** | Full: create/edit/delete with multi-image |
| **Đối tác CRUD** | Full: create/edit/delete with logo upload |
| **Báo giá** | View list + update status |
| **Image Upload** | `/api/upload` — JPG/PNG/WebP/GIF, max 5MB |
| **Public Frontend** | Homepage, category, product detail, news |
| **Header** | Figma-matched design |

### ⚠️ Chưa Hoàn Thành (Pending)

| Hạng mục | Ghi chú |
|---|---|
| **4 category admin pages** | TB Vệ Sinh, TB Nhà Bếp, TB Ngành Nước, Sàn Gỗ — sidebar ghi "Sắp có" |
| **Admin pages Pro Max** | Banners, Bài viết, Dự án, Đối tác chưa được audit theo chuẩn Pro Max |
| **Báo giá reply** | Chưa có tính năng reply/email |
| **Git commit** | 14 files chưa commit (UI Pro Max changes) |
| **Deploy** | Chưa deploy bản mới nhất lên Vercel |

---

## 6. Kế Hoạch Triển Khai (Đang Chờ Duyệt)

### Lộ trình B: Hoàn Thiện Admin (ưu tiên)

| Phase | Nội dung | Estimate |
|---|---|---|
| **B1** | Mở khóa 4 category admin pages (clone logic từ gach-op-lat) | 2h |
| **B2** | Audit + Pro Max cho Banners, Bài viết, Dự án, Đối tác pages | 2h |
| **B3** | Hoàn thiện Báo giá (view + reply + status update) | 1h |
| **B4** | Commit + Deploy lên Vercel | 30m |

### Lộ trình C: Public Frontend Pro Max (sau B)

| Phase | Nội dung | Estimate |
|---|---|---|
| **C1** | Homepage polish (hero, categories, featured products) | 2h |
| **C2** | Product listing + detail pages (grid, filters, gallery) | 2h |
| **C3** | Tin tức + Dự án pages | 1h |
| **C4** | SEO: metadata, OG images, structured data | 1h |

---

## 7. Conventions & Rules

### Code Style
- **Biến/hàm**: Tiếng Anh (camelCase)
- **Comments**: Tiếng Anh
- **UI text**: Tiếng Việt
- **Server Actions**: Đặt trong `src/lib/` (tên file: `{entity}-actions.ts`)
- **Validation**: Zod schemas cùng file với actions

### Design System (globals.css)
- **Primary**: `#16a34a` (Green 600)
- **Foreground**: `#0f172a` (Slate 900)
- **Border**: `#e2e8f0` (Slate 200)
- **Muted**: `#f8fafc` (Slate 50)
- **Stat card gradients**: 7 unique colors (blue, orange, emerald, purple, rose, cyan, amber)
- **Animations**: fade-in, slide-in, scale-in, shimmer, pulse-soft
- **Utilities**: card-hover, press-effect, table-row-hover, badge-pulse, active-indicator

### Admin Pattern
```
[entity]/
├── page.tsx              # Server component (data fetching)
├── [entity]-form.tsx     # Client form component (create + edit)
├── [entity]-actions.tsx  # Client action buttons (edit, delete)
├── new/page.tsx          # Create page
└── [id]/edit/page.tsx    # Edit page
```

### Environment Variables
```bash
DATABASE_URL=           # Supabase pooled connection string
DIRECT_URL=             # Supabase direct connection (for migrations)
AUTH_SECRET=             # NextAuth secret key
```

---

## 8. Lệnh Thường Dùng

```bash
# Dev server
npm run dev

# Database
npx prisma db push          # Push schema changes
npx prisma db seed           # Seed data
npx prisma studio            # Visual DB browser
npx prisma generate          # Regenerate client

# Build
npm run build                # Production build
npm run lint                 # ESLint check

# Deploy
vercel --prod                # Deploy to Vercel
```

---

## 9. Lưu Ý Cho AI Agent Mới

> [!IMPORTANT]
> 1. **Đọc `globals.css`** trước khi sửa bất kỳ UI nào — design tokens nằm ở đây
> 2. **KHÔNG tạo `tailwind.config.js`** — dự án dùng Tailwind v4, config ở `globals.css`
> 3. **`@source ".."` trong globals.css** là critical — đừng sửa dòng này
> 4. **Prisma schema** ở `prisma/schema.prisma` — dùng Supabase PostgreSQL
> 5. **Server Actions** chia ra nhiều files trong `src/lib/` — check hết trước khi tạo mới
> 6. **Sidebar** (`sidebar-nav.tsx`) là collapsible — dùng CSS `sidebar-transition` class
> 7. **Public uploads** lưu ở `public/uploads/` — gitignored
> 8. **Auth** dùng NextAuth v5 beta — check `src/auth.ts` và `src/auth.config.ts`
