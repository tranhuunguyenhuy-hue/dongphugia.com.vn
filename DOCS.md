# 📚 Tài Liệu Dự Án Đông Phú Gia (dongphugia.com.vn)

> Tổng hợp từ 42 file docs — Cập nhật: 27/03/2026

---

## Mục lục

1. [Tổng Quan Dự Án](#1-tổng-quan-dự-án)
2. [Tech Stack & Cấu Trúc](#2-tech-stack--cấu-trúc)
3. [Hướng Dẫn Cài Đặt & Chạy](#3-hướng-dẫn-cài-đặt--chạy)
4. [Conventions & Rules](#4-conventions--rules)
5. [Trạng Thái & Lịch Sử](#5-trạng-thái--lịch-sử)
6. [Kế Hoạch & Roadmap](#6-kế-hoạch--roadmap)
7. [Quy Trình Phối Hợp Agent](#7-quy-trình-phối-hợp-agent)
8. [Deployment](#8-deployment)
9. [Kiểm Thử E2E](#9-kiểm-thử-e2e)
10. [Troubleshooting & FAQ](#10-troubleshooting--faq)

---

## 1. Tổng Quan Dự Án

**Đông Phú Gia** (`dongphugia.com.vn`) là website showcase + quản trị sản phẩm vật liệu xây dựng.

| Key | Value |
|---|---|
| Loại | E-commerce showcase — **không có giỏ hàng**, dùng hệ thống "Báo giá" |
| Mục tiêu | Website chuyên nghiệp hiển thị sản phẩm + Admin CMS đầy đủ |
| Ngôn ngữ UI | Tiếng Việt |
| Deploy | Vercel (planned) |

**Danh mục sản phẩm (5 product_categories):**
1. `gach-op-lat` — Gạch ốp lát
2. `thiet-bi-ve-sinh` — Thiết bị vệ sinh
3. `thiet-bi-bep` — Thiết bị bếp
4. `san-go` — Sàn gỗ
5. `vat-lieu-nuoc` — Vật liệu nước

---

## 2. Tech Stack & Cấu Trúc

### Tech Stack

```
Frontend:   Next.js 16.1.6 + React 19.2.3 + TypeScript 5
Styling:    Tailwind CSS v4 (dùng @theme directive — KHÔNG có tailwind.config.js)
UI:         shadcn/ui (Radix UI) + Lucide React icons
Auth:       Simple env password (ADMIN_PASSWORD + HMAC cookie) — KHÔNG dùng NextAuth
Database:   Supabase PostgreSQL (production)
ORM:        Prisma 5.22.0
Forms:      React Hook Form + Zod validation
Toasts:     Sonner
Images:     next/image — remotePatterns trỏ đến Supabase Storage
```

### Cấu trúc thư mục

```
dongphugia/
├── src/
│   ├── app/
│   │   ├── (public)/              # Frontend công khai (5 danh mục + blog)
│   │   │   ├── page.tsx           # Homepage (revalidate 3600)
│   │   │   ├── layout.tsx         # Public layout (Header + Footer + FloatingContact)
│   │   │   ├── gach-op-lat/       # Danh mục Gạch ốp lát
│   │   │   ├── thiet-bi-ve-sinh/  # Danh mục TB Vệ sinh
│   │   │   ├── thiet-bi-bep/      # Danh mục TB Bếp
│   │   │   ├── vat-lieu-nuoc/     # Danh mục Vật liệu nước
│   │   │   ├── san-go/            # Danh mục Sàn gỗ
│   │   │   ├── blog/              # Blog / Tin tức
│   │   │   ├── ve-chung-toi/      # About Us
│   │   │   ├── doi-tac/           # Partners
│   │   │   └── du-an/             # Projects
│   │   ├── admin/
│   │   │   ├── login/             # Login page + server actions
│   │   │   └── (dashboard)/       # Authenticated admin area
│   │   │       ├── products/, tbvs/, bep/, nuoc/, sango/  # CRUD sản phẩm
│   │   │       ├── blog/, doi-tac/, du-an/               # Blog, Partners, Projects
│   │   │       ├── collections/, pattern-types/, banners/ # Taxonomy + banners
│   │   │       ├── crawler/                              # Tool cào dữ liệu
│   │   │       └── quote-requests/                       # Quản lý báo giá
│   │   ├── globals.css            # Design tokens + animations (Tailwind v4)
│   │   ├── layout.tsx             # Root layout
│   │   └── sitemap.ts             # Dynamic sitemap
│   ├── components/
│   │   ├── ui/                    # shadcn/ui + ImageUploader + RichTextEditor
│   │   ├── layout/                # Header, Footer, FloatingContact
│   │   ├── home/                  # Hero banner, sections homepage
│   │   ├── category/              # SmartFilter, CollectionCarousel
│   │   ├── product/               # ProductImageGallery, ProductDetailTabs
│   │   └── blog/                  # Blog components
│   └── lib/
│       ├── prisma.ts, utils.ts, admin-auth.ts, supabase.ts
│       ├── actions.ts / public-api.ts          # Gạch ốp lát
│       ├── tbvs-actions.ts / public-api-tbvs.ts
│       ├── bep-actions.ts / public-api-bep.ts
│       ├── nuoc-actions.ts / public-api-nuoc.ts
│       ├── sango-actions.ts / public-api-sango.ts
│       ├── blog-actions.ts / public-api-blog.ts
│       ├── partner-actions.ts / public-api-partners.ts
│       └── project-actions.ts / public-api-projects.ts
├── prisma/
│   ├── schema.prisma              # 53 models (source of truth)
│   ├── seed.ts / seed-data.ts     # Seed scripts
│   └── migrations/                # SQL migrations
├── scripts/                       # Utility scripts (xem scripts/README.md)
├── CLAUDE.md                      # Context cho AI Agent
├── DOCS.md                        # Tài liệu này
├── README.md                      # README dự án
├── PROJECT-STATUS.md              # Trạng thái dự án
└── CHANGELOG.md                   # Lịch sử thay đổi
```

---

## 3. Hướng Dẫn Cài Đặt & Chạy

### Cài đặt

```bash
cd ~/Projects/dongphugia
npm install
cp .env.example .env   # Cấu hình biến môi trường
npx prisma generate     # Generate Prisma Client
```

### Chạy dev

```bash
npm run dev           # http://localhost:3000
```

### Database

```bash
npx prisma db pull    # Sync schema từ production DB
npx prisma generate   # Regenerate Prisma Client (PHẢI chạy sau db pull + restart dev server)
npx prisma studio     # Visual DB browser
# KHÔNG dùng prisma migrate — DB quản lý thủ công qua SQL
```

### Build & Deploy

```bash
npm run build
vercel --prod
```

### Environment Variables

```bash
DATABASE_URL=                      # Supabase pooler — PHẢI có ?pgbouncer=true
DIRECT_URL=                        # Supabase direct — dùng cho prisma db pull/push
AUTH_SECRET=                       # Random secret
ADMIN_PASSWORD=                    # Mật khẩu vào /admin
NEXT_PUBLIC_SITE_URL=              # https://dongphugia.vn
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase anon key (cho ImageUploader)
```

---

## 4. Conventions & Rules

### Ngôn ngữ
- **Giao tiếp**: Tiếng Việt
- **Biến/hàm/file**: Tiếng Anh (camelCase)
- **Comments trong code**: Tiếng Anh
- **UI text**: Tiếng Việt

### Tailwind CSS v4 — QUAN TRỌNG
- **KHÔNG tạo `tailwind.config.js`** — dự án dùng Tailwind v4
- Config nằm trong `src/app/globals.css` → block `@theme { }`
- Dòng `@source ".."` trong globals.css là critical — **đừng sửa**
- `postcss.config.mjs` chỉ có `@tailwindcss/postcss`

### Design Tokens (globals.css)
```
Primary:    #16a34a  (Green 600)
Foreground: #0f172a  (Slate 900)
Border:     #e2e8f0  (Slate 200)
Muted:      #f8fafc  (Slate 50)
Secondary:  #f0fdf4  (Green 50)
Destructive:#ef4444  (Red 500)
```

### Image Upload
- Tất cả admin forms dùng `<ImageUploader>` từ `src/components/ui/image-uploader.tsx`
- Upload thẳng lên Supabase Storage bucket `images`
- **KHÔNG** lưu vào `public/uploads/` — sẽ broken trên Vercel
- `next.config.ts` cho phép domain: `tygjmrhandbffjllxveu.supabase.co`

### Server Actions
- Đặt trong `src/lib/` — tên file: `{entity}-actions.ts`
- Zod schemas đặt cùng file với actions
- **KHÔNG dùng `redirect()` trong programmatic call** — return `{ success: true }`
- `redirect()` chỉ OK trong native form action (loginAction, logoutAction)

### Pattern Admin CRUD
```
admin/{entity}/products/
├── page.tsx                             # Server component — fetch data + filter tabs
├── {entity}-product-form.tsx            # Client component — create + edit form
├── {entity}-product-delete-button.tsx   # Two-click confirmation
├── new/page.tsx                         # Create page
└── [id]/page.tsx                        # Edit page
```

### Auth (Admin)
- **Phương án**: Simple env password — KHÔNG dùng NextAuth
- **Cơ chế**: HMAC-SHA256(ADMIN_PASSWORD, AUTH_SECRET) → cookie `dpg-admin-session`
- **Files**: `src/lib/admin-auth.ts` + `src/app/admin/login/actions.ts`
- **Bảo vệ**: `src/app/admin/(dashboard)/layout.tsx` gọi `verifyAdminSession()`

### Lessons Learned

**Server Actions:**
```typescript
// ✅ ĐÚNG
export async function createProduct(data: any) {
  await prisma.products.create({ data })
  revalidatePath('/admin/products')
  return { success: true }
}
// ❌ SAI — redirect() trong programmatic call gây NEXT_REDIRECT error
```

**Prisma Client sau schema thay đổi:**
```bash
npx prisma generate
# Sau đó PHẢI restart dev server — Turbopack cache module cũ
```

**PostgreSQL sequence out of sync:**
Sau khi seed với explicit IDs → P2002 error khi tạo record mới.
Fix: `SELECT setval('table_id_seq', (SELECT MAX(id) FROM table))` trong seed file.

**Public API — Caching:**
```typescript
import { cache } from 'react'
export const getProducts = cache(async () => { ... })
// cache() + revalidate = 3600 → ISR: cache 1 giờ
```

**slugify() cho tiếng Việt:**
```typescript
slugify("Đá Marble") → "da-marble"  // đ → d trước khi normalize
```

---

## 5. Trạng Thái & Lịch Sử

> Nội dung đầy đủ xem tại [PROJECT-STATUS.md](./PROJECT-STATUS.md)

### Tổng kết (Cập nhật: 27/03/2026)

#### ✅ ĐÃ HOÀN THÀNH (100%)

| Module | Chi tiết |
|---|---|
| **5 Danh mục SP** | Gạch ốp lát, TB Vệ sinh, TB Bếp, Vật liệu nước, Sàn gỗ — Full backend + frontend |
| **Admin CMS** | 14 modules: products, bep, tbvs, nuoc, sango, doi-tac, du-an, blog, collections, pattern-types, banners, crawler, quote-requests |
| **Blog** | Backend (4 bảng `blog_*`), Admin CMS, Frontend (`/blog`) |
| **Partners + Projects** | DB + Admin CMS + Frontend real data |
| **Quote Reply** | Admin Dashboard Modal phản hồi báo giá |
| **Homepage** | HeroBanner (3 ảnh AI), FeaturedTabs, BlogSection, ProjectSection — real API |
| **About Us** | Editorial layout + ảnh AI-generated |
| **Floating Contact** | Zalo, Messenger, Phone widget trên mọi trang public |
| **SEO + Sitemap** | `sitemap.ts` crawl full 5 danh mục + blog |
| **Auth** | HMAC-SHA256 cookie |
| **Image Upload** | Supabase Storage — toàn bộ form admin |
| **Prisma Schema** | 53 models (`dien_*` và `khoa_*` còn trong DB nhưng **đã loại khỏi scope**) |
| **Project Cleanup** | Dọn root, tổ chức scripts, tổng hợp docs, viết lại README |

#### ⚠️ CÒN TỒN ĐỌNG

| Hạng mục | Priority |
|---|---|
| Deploy Vercel — chưa verify production | High |
| Import TDM data (~3,787 SP) vào DB production | High |
| Ảnh crawler bị 400 — cần proxy/tải về Supabase | Medium |
| Tối ưu SEO: schema markup, Open Graph, Core Web Vitals | Medium |
| Nhập nội dung Blog thực | Medium |
| Mega Dropdown Menu — đang phát triển | Low |

#### ❌ ĐÃ LOẠI KHỎI SCOPE (27/03/2026)

- Danh mục Điện (`dien_*`) — PM quyết định tập trung 5 danh mục hiện tại
- Danh mục Khóa (`khoa_*`) — PM quyết định tập trung 5 danh mục hiện tại

---

## 6. Kế Hoạch & Roadmap

### Quản lý dự án trên Linear

**Project:** [Đông Phú Gia - Website VLXD](https://linear.app/leonguyen/project/djong-phu-gia-website-vlxd-179a568436a0)

| Milestone | Target | Nội dung |
|-----------|--------|----------|
| M1 — Production Deploy | 07/04/2026 | Vercel deploy, DNS/SSL, env vars |
| M3 — Polish & Content | 31/05/2026 | Import data, SEO, blog content, mega dropdown, fix ảnh |

### Task tiếp theo (theo priority)

1. **(High)** Verify Vercel deploy — kiểm tra env vars, build trên production
2. **(High)** Import sản phẩm TDM vào DB production
3. **(Medium)** Giải pháp ảnh crawler: download về Supabase Storage thay vì hotlink
4. **(Medium)** Tối ưu SEO + nhập nội dung Blog
5. **(Low)** Mega dropdown menu cho navigation

> Các PLAN cũ — **TẤT CẢ ĐÃ HOÀN THÀNH** và đã được merge vào PROJECT-STATUS.md.

---

## 7. Quy Trình Phối Hợp Agent

### Phân công

- **Claude Code**: Database, Prisma, Server Actions, Admin CMS, Build fix
- **Antigravity (Tninie)**: UI/UX, Frontend pages, Components

### Quy trình khi bắt đầu session

1. Đọc `PROJECT-STATUS.md` (root) — nắm trạng thái hiện tại
2. Đọc `DOCS.md` — xem roadmap và task tiếp theo
3. Sau mỗi task, cập nhật `PROJECT-STATUS.md`

### Skills đã cài đặt (15 skills)

Vị trí: `.agents/skills/` — symlinked cho Claude Code, Antigravity, Gemini CLI.

| Task | Skills |
|------|--------|
| React components | `frontend-design`, `vercel-react-best-practices` |
| Next.js pages | `nextjs-app-router-patterns` |
| API routes | `api-design-principles`, `nodejs-backend-patterns` |
| Database/Prisma | `postgresql-table-design`, `sql-optimization-patterns` |
| Styling | `tailwind-design-system`, `responsive-design` |
| UI components | `frontend-design`, `web-design-guidelines` |
| SEO | `seo-audit`, `schema-markup`, `programmatic-seo` |
| Blog/Content | `content-strategy`, `site-architecture` |
| Testing | `webapp-testing`, `code-review-excellence` |
| Debugging | `debugging-strategies` |

---

## 8. Deployment

### Vercel Configuration

- File `vercel.json` cấu hình deployment
- Environment variables cần set trên Vercel Dashboard (xem Section 3)
- Build command: `npm run build`
- Output: `.next/`

### Deploy Checklist

- [ ] Set env vars trên Vercel Dashboard
- [ ] Verify `DATABASE_URL` dùng pooler connection string
- [ ] Verify `DIRECT_URL` dùng direct connection string
- [ ] Verify Supabase Storage CORS cho domain production
- [ ] Test build: `npm run build` — pass trước khi deploy
- [ ] Deploy: `vercel --prod`

---

## 9. Kiểm Thử E2E

### Kịch bản Test (5 danh mục)

Mỗi danh mục cần test luồng:
1. **Admin CMS** — Tạo sản phẩm mới (upload ảnh, điền thông tin, lưu)
2. **Client UI** — Kiểm tra filter, trang danh sách, trang chi tiết, form báo giá

| Test Case | Admin Route | Client Route |
|---|---|---|
| Gạch ốp lát | `/admin/products` | `/gach-op-lat` |
| TB Vệ sinh | `/admin/tbvs/products` | `/thiet-bi-ve-sinh` |
| TB Bếp | `/admin/bep/products` | `/thiet-bi-bep` |
| Vật liệu nước | `/admin/nuoc/products` | `/vat-lieu-nuoc` |
| Sàn gỗ | `/admin/sango/products` | `/san-go` |

### Phương án thực hiện
- **A (Tự động)**: Dùng browser subagent tự động test (sinh video record)
- **B (Manual)**: Chạy `npm run dev` và test từng luồng thủ công

---

## 10. Troubleshooting & FAQ

### Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|
| `NEXT_REDIRECT` error | Dùng `redirect()` trong programmatic call | Return `{ success: true }` thay vì redirect |
| `P2002` unique constraint | PostgreSQL sequence out of sync | `SELECT setval('table_id_seq', ...)` |
| Prisma type mismatch | Schema thay đổi chưa generate | `npx prisma generate` + restart dev |
| Image 404 trên Vercel | Dùng `public/uploads/` | Đổi sang Supabase Storage |
| Build lỗi `Cannot find module` | Turbopack cache cũ | Restart dev server |

### FAQ

**Q: Tại sao không dùng NextAuth?**
A: Dự án chỉ cần 1 admin account → Simple env password + HMAC cookie đủ dùng, bảo mật và nhẹ.

**Q: Tại sao không dùng `tailwind.config.js`?**
A: Dự án dùng Tailwind CSS v4 — config nằm trong `globals.css` block `@theme {}`.

**Q: Tại sao không dùng `prisma migrate`?**
A: DB được quản lý thủ công qua SQL trên Supabase Dashboard. Dùng `prisma db pull` để sync.
