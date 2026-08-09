# Đông Phú Gia — Application reference

**Updated:** 04/08/2026 | Live: www.dongphugia.vn | Deploy: AWS EC2/Coolify

> `AGENTS.md` ở root chứa operating rules bắt buộc. File này giữ conventions
> ứng dụng và gotchas chi tiết.

> AI agent đọc `AGENTS.md` ở root trước, sau đó đọc file này khi làm application work.

---

## Project

E-commerce B2C, VLXD cao cấp Đà Lạt. Thanh toán offline. 4 categories:
`/thiet-bi-ve-sinh` · `/thiet-bi-bep` · `/vat-lieu-nuoc` · `/gach-op-lat`

Contact: 094 9349 949 · vlxd.dongphu@gmail.com

---

## Tech Stack

```
Next.js App Router · React 19 · TypeScript
Tailwind CSS v4 — @theme directive in globals.css (NO tailwind.config.js)
shadcn/ui (Radix) · Prisma · AWS PostgreSQL · Zustand (cart)
Bunny CDN compatibility · AWS EC2/Coolify immutable ARM64 deploy
```

---

## Team & Workflow

| Role | Who | Scope |
|------|-----|-------|
| PM | Nguyen Huy | Goal, scope, acceptance và production approval |
| Engineering | OpenAI Codex | Plan, implement, test, PR, closeout |

Quy trình đầy đủ: [`docs/WORKFLOW-WITH-CODEX.md`](WORKFLOW-WITH-CODEX.md).
Mỗi task dùng branch `codex/*`, PR và protected `main`. Merge Git không đồng
nghĩa deploy production.

---

## Session Start Checklist

```
□ 1. pwd phải là /Users/m-ac/Projects/dongphugia
□ 2. Đọc AGENTS.md ở root và docs/WORKFLOW-WITH-CODEX.md
□ 3. git status --short --branch
□ 4. git switch main && git pull --ff-only origin main
□ 5. Tạo branch codex/<task-name>; không commit trực tiếp main
□ 6. npm ci khi dependencies chưa sẵn sàng
□ 7. npm run lint && npm run typecheck && npm test trước PR
```

---

## Directory Structure

```
src/
├── app/
│   ├── (public)/           # Frontend pages
│   │   ├── thiet-bi-ve-sinh/
│   │   ├── thiet-bi-bep/
│   │   ├── gach-op-lat/
│   │   ├── vat-lieu-nuoc/
│   │   ├── gio-hang/       # Cart
│   │   ├── tim-kiem/       # Search
│   │   └── blog/
│   ├── admin/(dashboard)/  # CMS — auth protected, RBAC 3 roles
│   └── api/                # search, orders, quote-requests, upload-image
├── components/
│   ├── ui/                 # shadcn/ui — ADMIN ONLY
│   ├── layout/             # Header, Footer, FloatingContact
│   ├── category/           # Listing, SmartFilter
│   └── product/            # Gallery, DetailTabs, VariantSelector
├── lib/                    # Server actions + utils
└── config/site.ts          # Nav links, footer links
```

**Admin CRUD pattern (dùng `products/` làm reference):**
```
admin/{entity}/
├── page.tsx                    # Server component — list + filter
├── {entity}-form.tsx           # Client component — create + edit
├── {entity}-delete-button.tsx  # Two-click delete
├── new/page.tsx
└── [id]/page.tsx
```

---

## Critical Conventions

**Tailwind v4:** Config ONLY in `src/app/globals.css @theme`. Brand primary
`brand-500` is `#2D90AF`. NO `tailwind.config.js`. NO edit `@source` lines.

**shadcn/ui:** Admin pages ONLY. NEVER import `@/components/ui/` trong `(public)/` pages.

**Next.js App Router:**
- `params` và `searchParams` là Promise → phải `await`
- Server Components fetch data · Client Components handle interactivity
- `unstable_cache()` + `revalidateTag()` cho ISR

**Server Actions:** NO `redirect()` trong programmatic call → return `{ success: true }`. `redirect()` chỉ OK trong login/logout. Always `revalidateTag()` sau mutation.

**Database:** AWS PostgreSQL là production source duy nhất. Không chạy migration
hoặc schema/data write trên production nếu chưa có PM window, backup, rollback
và migration plan được duyệt. Sau schema sync phải chạy `npx prisma generate`.

**Images:** Bunny CDN qua `/api/upload-image`. NEVER `public/uploads/`.

**Metadata titles:** Plain string WITHOUT `| Đông Phú Gia` suffix — root layout template `"%s | Đông Phú Gia"` tự xử lý. Homepage dùng `{ absolute: "..." }`.

---

## Database — 29 Models

### Product
| Model | Mô tả |
|-------|--------|
| `products` | 40+ fields, specs JSONB, search_vector FTS |
| `categories` | 4 danh mục chính |
| `subcategories` | Bồn cầu, sen tắm... |
| `brands` | TOTO, INAX, Caesar... |
| `product_images` | Gallery (main/gallery type) |
| `product_relationships` | Combo/component/accessory |
| `filter_definitions` | Bộ lọc động theo category (JSONB options) |
| `colors`, `materials`, `origins` | Lookup tables |

### Orders
| Model | Mô tả |
|-------|--------|
| `orders` + `order_items` | Status: pending→received→confirmed→inventory_check→completed/cancelled |
| `quote_requests` + `quote_items` | Status: pending→processing→quoted→accepted/rejected |
| `customers` | CRM (unique by phone) |

### Content
`blog_posts`, `blog_categories`, `blog_tags`, `blog_post_tags`, `banners`, `partners`, `projects`, `redirects`

### Admin
`admin_users` (RBAC: admin/sale_manager/sale), `admin_sessions`, `audit_logs`

### Key fields trong `products`
```
sku (unique), slug, category_id, subcategory_id, brand_id
price, original_price, online_discount_amount, price_display
is_master, variant_group    # Variant system
is_featured, is_home_featured, is_promotion, is_combo
specs (JSONB), search_vector (tsvector)
image_main_url, product_images (relation)
```

---

## Development Commands

```bash
npm run dev           # localhost:3000
npx tsc --noEmit      # TypeScript check — PHẢI pass trước commit
npm run build         # Full build (cần DB connection)
npm run lint          # ESLint

# DB workflow
npx prisma db pull    # Sync schema từ production
npx prisma generate   # Regenerate Prisma Client (bắt buộc sau db pull)
npx prisma studio     # Visual DB browser

# Clean cache
rm -rf .next && npm run dev
```

---

## Environment Variables

```bash
# Database
DATABASE_URL=     # PostgreSQL runtime URL; never print or commit
DIRECT_URL=       # Direct administrative URL; runtime secret only

# Site
NEXT_PUBLIC_SITE_URL=https://www.dongphugia.vn
NEXT_PUBLIC_GTM_ID=

# Bunny CDN
BUNNY_STORAGE_ZONE_NAME=
BUNNY_STORAGE_API_KEY=
BUNNY_STORAGE_HOSTNAME=
BUNNY_CDN_HOSTNAME=cdn.dongphugia.com.vn

# Cache
REVALIDATION_SECRET=
REVALIDATE_SECRET=

# Admin
SESSION_HOURS=8
MAINTENANCE_MODE=false
```

---

## Auth — Admin Panel

- bcrypt (12 rounds) + SHA-256 session token → bảng `admin_sessions`
- Cookie: `dpg-admin-session` (httpOnly, secure, sameSite=lax)
- Guard: `src/app/admin/(dashboard)/layout.tsx`
- RBAC: `admin` > `sale_manager` > `sale`

---

## Hard Rules

| Rule | Nếu vi phạm |
|------|-------------|
| Production mutation cần PM window và explicit approval | Block ngay |
| Không commit trực tiếp hoặc force-push `main` | Block ngay |
| `npx tsc --noEmit` phải pass trước commit | Block ngay |
| Không xóa bảng/column DB khi chưa hỏi Tech Lead | Block ngay |
| Không thay đổi auth flow khi chưa hỏi Tech Lead | Block ngay |
| Không thêm major npm dependency khi chưa hỏi Tech Lead | Block ngay |
| Required CI và protected `main` không được bypass | Block ngay |

---

## Linear Issue Template

```markdown
## Context
[Tại sao — business reason]

## Scope
[Làm gì. Không làm gì.]

## Files cần sửa / tạo
- src/...

## Approach
[Hướng implement cụ thể]

## Acceptance criteria
- [ ] ...

## Gotchas
[Pattern cần tránh, edge cases]
```

---

## Known Gotchas

| Vấn đề | Fix |
|--------|-----|
| `NEXT_REDIRECT` trong server action | Return `{ success: true }`, client `router.push()` |
| Prisma stale types sau schema change | `npx prisma generate` + restart dev |
| `params` async error | `const { slug } = await params` |
| Build WASM/Prisma error | Thêm đủ back-relations vào schema và regenerate client |
| Ảnh không hiển thị | Thêm Bunny CDN vào `images.remotePatterns` |
| Title trùng brand name | Xóa `\| Đông Phú Gia` khỏi page title string |
| Branch diverge nhiều file | Cherry-pick thủ công từng file cần thiết, không merge nguyên branch |
| `specs` null trong crawl import | `products.specs` là `JSONB NOT NULL` — dùng `product.specs \|\| {}`, không dùng `\|\| null` |
| Crawl URL discovery include non-product pages | hita.com.vn product URLs có numeric ID ≥ 1000; category/service pages có ID < 1000 — filter trước khi crawl |
| `thiet-bi-bep` dùng schema riêng | Bảng `bep_brands`, `bep_product_types`, `bep_subtypes` — không dùng `products`/`subcategories` |
| MOEN/GROHE/ATMOR ảnh trên Bunny CDN | URL dạng `cdn.hita.com.vn/storage/` — `isProductImage()` phải support cả CDN domain này |
| Image fallback quét nhầm upsell section | Template 3 fallback phải scope vào `.product-column-left` và filter `.section-buy-more` |
| `4-import-db.js` NO IMAGE trên listing | `ProductCard` dùng `products.image_main_url` — script phải set field này trong upsert payload |

---

> Cập nhật file này sau mỗi convention hoặc gotcha mới. Operating workflow nằm
> trong `AGENTS.md` ở root và `docs/WORKFLOW-WITH-CODEX.md`.
