# Đông Phú Gia - Website VLXD

> Tài liệu này dành cho Claude Code. Đọc file này trước khi bắt đầu bất kỳ task nào.
> Tổng hợp từ: `PROJECT.md`, `GEMINI.md`, `CHANGELOG.md`, `README.md`
> Cập nhật lần cuối: **02/03/2026**

---

## Mục tiêu dự án

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

## Tech Stack

```
Frontend:   Next.js 16.1.6 + React 19.2.3 + TypeScript 5
Styling:    Tailwind CSS v4 (dùng @theme directive — KHÔNG có tailwind.config.js)
UI:         shadcn/ui (Radix UI) + Lucide React icons
Auth:       Simple env password (ADMIN_PASSWORD + HMAC cookie) — KHÔNG dùng NextAuth
Database:   Supabase PostgreSQL (production)
ORM:        Prisma 5.22.0
Forms:      React Hook Form + Zod validation
Toasts:     Sonner
Images:     next/image — remotePatterns trỏ đến Supabase Storage (tygjmrhandbffjllxveu.supabase.co)
```

---

## Cấu trúc project

```
src/
├── app/
│   ├── (public)/              # Frontend công khai
│   │   ├── page.tsx           # Homepage (revalidate 3600)
│   │   ├── layout.tsx         # Public layout (Header + Footer)
│   │   ├── gach-op-lat/       # Danh mục Gạch ốp lát
│   │   ├── thiet-bi-ve-sinh/  # Danh mục TB Vệ sinh
│   │   ├── thiet-bi-bep/      # Danh mục TB Bếp
│   │   ├── vat-lieu-nuoc/     # Danh mục Vật liệu nước
│   │   └── san-go/            # Danh mục Sàn gỗ
│   │
│   ├── admin/
│   │   ├── login/             # Login page + server actions
│   │   │   ├── page.tsx
│   │   │   ├── login-form.tsx
│   │   │   └── actions.ts     # loginAction + logoutAction
│   │   └── (dashboard)/       # Authenticated (layout kiểm tra cookie)
│   │       ├── layout.tsx     # verifyAdminSession() — redirect nếu chưa auth
│   │       ├── sidebar-nav.tsx
│   │       ├── page.tsx       # Dashboard
│   │       ├── products/      # CRUD Gạch ốp lát
│   │       ├── tbvs/          # CRUD TB Vệ sinh
│   │       ├── bep/           # CRUD TB Bếp
│   │       ├── nuoc/          # CRUD Vật liệu nước
│   │       ├── sango/         # CRUD Sàn gỗ
│   │       ├── collections/   # CRUD bộ sưu tập
│   │       ├── pattern-types/ # CRUD kiểu vân
│   │       ├── banners/       # CRUD banners homepage
│   │       └── quote-requests/# Quản lý báo giá
│   │
│   ├── globals.css            # Design tokens + animations (Tailwind v4 config)
│   ├── layout.tsx             # Root layout (fonts)
│   └── sitemap.ts             # Dynamic sitemap
│
├── components/
│   ├── ui/                    # shadcn/ui components + image-uploader.tsx
│   ├── layout/                # Header, Footer
│   ├── home/                  # Hero banner, sections homepage
│   ├── category/              # SmartFilter, CollectionCarousel, per-category filters
│   └── product/               # ProductImageGallery, ProductDetailTabs
│
├── lib/
│   ├── prisma.ts              # Prisma client singleton
│   ├── utils.ts               # cn() + slugify() (đã fix cho đ/Đ)
│   ├── admin-auth.ts          # HMAC cookie auth
│   ├── supabase.ts            # Supabase client (cho ImageUploader)
│   ├── actions.ts             # Server actions: Gạch ốp lát, Banners, QuoteRequests
│   ├── public-api.ts          # Public API: Gạch ốp lát
│   ├── tbvs-actions.ts        # Server actions: TB Vệ sinh
│   ├── public-api-tbvs.ts     # Public API: TB Vệ sinh
│   ├── bep-actions.ts         # Server actions: TB Bếp
│   ├── public-api-bep.ts      # Public API: TB Bếp
│   ├── nuoc-actions.ts        # Server actions: Vật liệu nước
│   ├── public-api-nuoc.ts     # Public API: Vật liệu nước
│   ├── sango-actions.ts       # Server actions: Sàn gỗ
│   └── public-api-sango.ts    # Public API: Sàn gỗ

prisma/
├── schema.prisma              # 37 models (source of truth từ DB)
└── migrations/                # SQL migration files
```

---

## Convention & Rules

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

### Design tokens (globals.css)
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
├── page.tsx                     # Server component — fetch data + filter tabs
├── {entity}-product-form.tsx    # Client component — create + edit form + ImageUploader
├── {entity}-product-delete-button.tsx  # Two-click confirmation
├── new/page.tsx                 # Create page
└── [id]/page.tsx                # Edit page (params: Promise<{id: string}>)
```

### Auth (Admin)
- **Phương án**: Simple env password — KHÔNG dùng NextAuth
- **Cơ chế**: HMAC-SHA256(ADMIN_PASSWORD, AUTH_SECRET) → cookie `dpg-admin-session`
- **Files**: `src/lib/admin-auth.ts` + `src/app/admin/login/actions.ts`
- **Bảo vệ**: `src/app/admin/(dashboard)/layout.tsx` gọi `verifyAdminSession()`

---

## Workflows

### Khởi động dev
```bash
cd ~/Projects/dongphugia
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
DATABASE_URL=     # Supabase pooler — PHẢI có ?pgbouncer=true
DIRECT_URL=       # Supabase direct — dùng cho prisma db pull/push
AUTH_SECRET=      # Random secret
ADMIN_PASSWORD=   # Mật khẩu vào /admin
NEXT_PUBLIC_SITE_URL=      # https://dongphugia.vn
NEXT_PUBLIC_SUPABASE_URL=  # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anon key (cho ImageUploader)
```

---

## Lessons Learned

### Server Actions
```typescript
// ✅ ĐÚNG
export async function createProduct(data: any) {
  await prisma.products.create({ data })
  revalidatePath('/admin/products')
  return { success: true }
}
// ❌ SAI — redirect() trong programmatic call gây NEXT_REDIRECT error
```

### Prisma Client sau schema thay đổi
```bash
npx prisma generate
# Sau đó PHẢI restart dev server — Turbopack cache module cũ
```

### PostgreSQL sequence out of sync
Sau khi seed với explicit IDs → P2002 error khi tạo record mới.
Fix: `SELECT setval('table_id_seq', (SELECT MAX(id) FROM table))` trong seed file.

### Public API — Caching
```typescript
import { cache } from 'react'
export const getProducts = cache(async () => { ... })
// cache() + revalidate = 3600 → ISR: cache 1 giờ
```

### slugify() cho tiếng Việt
```typescript
slugify("Đá Marble") → "da-marble"  // đ → d trước khi normalize
```

---

## Workflow phối hợp 2 Agents

- **Claude Code**: Database, Prisma, Server Actions, Admin CMS, Build fix
- **Antigravity (Tninie)**: UI/UX, Frontend pages, Components

### Quy trình khi bắt đầu session
1. Đọc `PROJECT-STATUS.md` (root) — nắm trạng thái hiện tại
2. Đọc `docs/PLAN-website-completion.md` — task tiếp theo
3. Sau mỗi task, cập nhật `PROJECT-STATUS.md`

---

## 🎯 SKILLS INTEGRATION

Dự án này đã cài đặt các skills từ skills.sh. LUÔN đọc và áp dụng skills tương ứng.

### Skills đã cài đặt (15 skills)

Vị trí: `.agents/skills/` — symlinked cho Claude Code, Antigravity, Gemini CLI.

### Mapping Task → Skills

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

### Quy trình
1. Trước khi code: Đọc skill liên quan
2. Trong khi code: Áp dụng best practices
3. Sau khi code: Self-review
