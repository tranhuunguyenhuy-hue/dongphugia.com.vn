# Đông Phú Gia - Codex technical reference

> **Canonical instruction entry point:** repository root [`AGENTS.md`](../AGENTS.md).
> Trước mọi task, đọc thêm
> [`operations/MIGRATION-CHARTER.md`](operations/MIGRATION-CHARTER.md),
> [`operations/CODEX-CONTEXT.md`](operations/CODEX-CONTEXT.md) và hand-off hiện
> hành. File này chỉ giữ technical conventions của application.

## Current migration objective

- Current public production: `www.dongphugia.com.vn` trên Vercel; old apex
  redirect tới `www`.
- Target canonical: `https://www.dongphugia.vn`.
- Target platform: AWS EC2 Singapore → Coolify → immutable Linux/ARM64 GHCR
  image → Next.js.
- Target database: self-hosted PostgreSQL với TLS `verify-full`.
- Target media: Bunny Storage/CDN với compatibility được nghiệm thu.
- Vercel và `.com.vn` phải được giữ nguyên làm rollback qua observation window.

## Codex start checklist for migration/release

1. Đọc root `AGENTS.md`, migration charter, living context và latest hand-off.
2. Chạy `scripts/repository/audit-git-state.sh` read-only.
3. Xác minh absolute worktree, branch, dirty files, PR head và exact digest.
4. Xác minh thread cũ đã release mutation owner cho đúng resource.
5. Công bố owner mới; chỉ một writer cho mỗi resource.
6. Không lặp workflow/probe nếu input hoặc evidence chưa thay đổi.
7. Không đọc/in secret; chỉ xác minh metadata và dùng secret-safe injection.

## Current hard stops

- Không production write-freeze/final copy/database write nếu chưa qua
  `PRODUCTION-DATA-WRITE-FREEZE-APPROVAL-GATE` mới.
- Không DNS/nameserver/canonical traffic/old-domain redirect nếu chưa qua
  `DNS-SWITCH-APPROVAL-GATE`.
- Không tắt, xóa hoặc thay đổi Vercel rollback baseline trong observation.
- Maintenance window ngày 31/07/2026 đã hết hiệu lực; không tự dời window.

Nếu phần còn lại của file mâu thuẫn với các quy tắc trên, root `AGENTS.md`,
current migration charter, newly verified evidence và exact latest hand-off luôn
ưu tiên.

**Updated:** 01/08/2026 | Current public production: `www.dongphugia.com.vn`
on Vercel | Target: `www.dongphugia.vn` on AWS/Coolify

---

## Project

E-commerce B2C, VLXD cao cấp Đà Lạt. Thanh toán offline. 4 categories:
`/thiet-bi-ve-sinh` · `/thiet-bi-bep` · `/vat-lieu-nuoc` · `/gach-op-lat`

Contact: 094 9349 949 · vlxd.dongphu@gmail.com

---

## Tech Stack

```
Next.js 16.2.10 App Router · React 19.2.3 · TypeScript 5.9.3
Tailwind CSS v4 — @theme directive in globals.css (NO tailwind.config.js)
shadcn/ui (Radix) · Prisma 5.22.0 · PostgreSQL · Zustand (cart)
Current rollback: Supabase + Vercel · Target: self-hosted PostgreSQL + Coolify
Media: Bunny Storage/CDN with approved legacy compatibility
```

---

## Ownership and workflow

| Role | Who | Scope |
|------|-----|-------|
| PM/user | Nguyen Huy | Scope, GO/NO-GO, production-data, DNS/traffic, credentials and cost approvals |
| Technical executor | Codex | Inspect, plan, implement, review, verify and maintain cross-thread context within approved scope |

**Per-task flow:**

1. PM/user describes the desired outcome and constraints.
2. Codex reads canonical context and verifies the exact current state.
3. Codex identifies facts, decisions, assumptions, unknowns and mutation owner.
4. Codex performs the authorized work on an isolated `codex/*` branch/worktree.
5. Codex runs appropriate checks and records exact evidence.
6. Codex updates the living context and emits the mandatory session closeout.
7. PM/user approves every production-data, DNS/traffic, credential or budget gate.

No other assistant, legacy tool or historical role has current mutation or
coordination authority.

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

**Tailwind v4:** Config ONLY in `src/app/globals.css @theme`. Brand primary `#16a34a`. NO `tailwind.config.js`. NO edit `@source` lines.

**shadcn/ui:** Admin pages ONLY. NEVER import `@/components/ui/` trong `(public)/` pages.

**Next.js App Router:**
- `params` và `searchParams` là Promise → phải `await`
- Server Components fetch data · Client Components handle interactivity
- `unstable_cache()` + `revalidateTag()` cho ISR

**Server Actions:** NO `redirect()` trong programmatic call → return `{ success: true }`. `redirect()` chỉ OK trong login/logout. Always `revalidateTag()` sau mutation.

**Database:** Không mutation production schema/data nếu chưa có approval riêng.
Mọi migration phải được review, rehearsal trên target cô lập, backup/restore và
reconciliation trước cutover. `prisma generate` phải khớp reviewed schema.

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
DATABASE_URL=     # Runtime PostgreSQL; production target uses verify-full
DIRECT_URL=       # Direct PostgreSQL access for approved operations only

# Site
NEXT_PUBLIC_SITE_URL=  # Per environment; target is https://www.dongphugia.vn
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
| PM duyệt production-data cutover và DNS/traffic release | Block ngay |
| Chỉ deploy exact green source/immutable digest trong scope được duyệt | Block ngay |
| `npx tsc --noEmit` phải pass trước commit | Block ngay |
| Không xóa bảng/column DB khi chưa có review và PM approval phù hợp | Block ngay |
| Không thay đổi auth flow khi chưa có security review và scope rõ | Block ngay |
| Không thêm major npm dependency khi chưa đánh giá risk và được PM duyệt nếu ảnh hưởng phạm vi/chi phí | Block ngay |
| Không có hai mutation writer trên cùng resource | Block ngay |
| Không kết thúc thread mà thiếu closeout/context hand-off | Block ngay |

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
| Build WASM error trên Vercel | Thêm đủ back-relations vào schema |
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

> **Codex:** Cập nhật technical reference khi convention/gotcha mới được xác
> minh. Cập nhật cross-thread state trong `operations/CODEX-CONTEXT.md` và kết
> thúc mỗi thread bằng `operations/CODEX-SESSION-CLOSEOUT.md`.
