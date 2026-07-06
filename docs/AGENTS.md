# Đông Phú Gia — Agent Reference (Single Source of Truth)

**Updated:** 14/06/2026 | Live: dongphugia.com.vn | Deploy: Vercel (auto khi push `main`)

> ⚠️ **TEAM CHANGE (04/06/2026):** Antigravity đã ngừng hoạt động. **Codex (OpenAI)** thay thế làm Developer. Claude giữ vai Tech Lead.

> **Mọi AI agent đọc file này trước tiên.** CLAUDE.md và docs/AGENT.md là alias trỏ về đây.

---

## Project

E-commerce B2C, VLXD cao cấp Đà Lạt. Thanh toán offline. 4 categories:
`/thiet-bi-ve-sinh` · `/thiet-bi-bep` · `/vat-lieu-nuoc` · `/gach-op-lat`

Contact: 094 9349 949 · vlxd.dongphu@gmail.com

---

## Roadmap (nguồn chân lý = Linear)

Quản lý theo 4 tầng: **Initiative → Project (P0–P5) → Milestone → Issue**.
[Linear Initiative "Đông Phú Gia — Website VLXD"](https://linear.app/leonguyen/initiative/djong-phu-gia-website-vlxd-1c5cd0379e7a) · mirror đọc nhanh trong repo: `ROADMAP.md`.

| Project | Priority | Timeline |
|---------|----------|----------|
| P0 Stabilization | Urgent | 04/06→31/07 (bug P0 đã xong) |
| P1 Frontend Core Experience | High | 04/06→31/08 |
| P2 SEO, Content & Discovery | High | 04/06→30/09 |
| P3 Admin CMS & Operations | Medium | 01/07→30/09 |
| P4 Commercial Features (gồm Data/Catalog) | Medium | 01/08→31/10 |
| P5 Technical Debt & Performance | Low | 04/06→31/10 |

Issue mở giao Codex đã nằm sẵn đúng Project + Milestone. Sprint 1 (security, variant system, bug fix) đã archive.

---

## Tech Stack

```
Next.js 16.2.3 App Router · React 19.2.3 · TypeScript 5.9.3
Tailwind CSS v4 — @theme directive in globals.css (NO tailwind.config.js)
shadcn/ui (Radix) · Prisma 5.22.0 · Supabase PostgreSQL · Zustand (cart)
Bunny CDN: cdn.dongphugia.com.vn · Vercel deploy
```

---

## Team & Workflow

| Role | Who | Scope |
|------|-----|-------|
| PM | Nguyen Huy | Requirements, approve, deploy Vercel |
| Tech Lead | Claude (Cowork) | Spec, review code, báo deploy |
| Developer | Codex (OpenAI) | Implement từ Linear issue, push branch, comment báo cáo |

**Per-task flow (Codex as Developer):**
1. PM → mô tả yêu cầu trong Cowork chat
2. Claude → hỏi nếu thiếu thông tin (tối đa 1 câu)
3. Claude → tạo Linear issue với spec đầy đủ
4. Claude → comment GO lên Linear để Codex bắt đầu
5. Codex → implement, push branch, comment báo cáo trên Linear
6. PM → báo Claude "Codex xong"
7. Claude → vào Linear đọc comment Codex, pull code về review
8. Claude → comment LGTM hoặc CHANGES REQUESTED lên Linear
9. Nếu LGTM → Claude báo PM "Ready for deploy" với tóm tắt ngắn
10. PM → deploy lên Vercel (CHỈ PM deploy)

---

## Session Start Checklist (Codex)

```
□ 1. Đọc file này (docs/AGENTS.md)
□ 2. git status --short --branch — xem worktree có thay đổi đang chờ không
□ 3. git fetch origin main — không merge/rebase nếu task không yêu cầu
□ 4. npm install nếu dependencies thiếu
□ 5. npx tsc --noEmit → PHẢI pass trước khi commit/deploy
□ 6. Đọc Linear issue hoặc yêu cầu PM mới nhất đầy đủ
□ 7. Nếu task liên quan Hita product crawl/import, đọc scripts/crawl-hita/README.md
□ 8. Spec không rõ hoặc có rủi ro production write → hỏi PM/Tech Lead trước khi execute
```

**Git state:** `main` là canonical branch. Production deploy từ `main`, nhưng agent không tự deploy trừ khi PM yêu cầu rõ.

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

**Database:** NO `prisma migrate`. Schema changes → SQL trực tiếp trên Supabase Dashboard → `npx prisma db pull` → `npx prisma generate`.

**Images:** Bunny CDN qua `/api/upload-image`. NEVER `public/uploads/`.

**Metadata titles:** Plain string WITHOUT `| Đông Phú Gia` suffix — root layout template `"%s | Đông Phú Gia"` tự xử lý. Homepage dùng `{ absolute: "..." }`.

**Hita product crawl/import:** ONLY use `scripts/crawl-hita/run-normalized-brand-pipeline.mts`. The detailed playbook is [scripts/crawl-hita/README.md](/Users/m-ac/Projects/dongphugia/scripts/crawl-hita/README.md). Never run legacy Hita import scripts such as `4-import-db.js`, `scripts/crawl-toto/*`, `scripts/crawl-inax/*`, or `scripts/crawl-hita-inax/*`.

**Current crawl/import state handoff:** read [/Users/m-ac/Projects/dongphugia/docs/handoffs/2026-07-07-crawl-import-status.md](/Users/m-ac/Projects/dongphugia/docs/handoffs/2026-07-07-crawl-import-status.md) before touching `american-standard`, `kanly`, or `inax`.

When PM says `crawl và import <brand>`:
1. Run `npx tsc --noEmit`.
2. Run read-only prepare with `--stop-after=prepare`.
3. Review `discovery.json`, `reconciliation.json`, `field-policy-flags.json`, `pipeline-report.md`, and skipped/quarantine counts.
4. Only if gates pass, run with `--execute --confirm-brand=<brand>`.
5. Report run dir, `crawl_run_id`, approved/imported/failed counts, image verification, active-count guard, and PDP spot checks.

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
DATABASE_URL=     # Supabase pooled (pgbouncer=true)
DIRECT_URL=       # Supabase direct (cho prisma db pull)

# Site
NEXT_PUBLIC_SITE_URL=https://dongphugia.com.vn
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
| Chỉ PM trigger deploy Vercel | Block ngay |
| `npx tsc --noEmit` phải pass trước commit | Block ngay |
| Không xóa bảng/column DB khi chưa hỏi Tech Lead | Block ngay |
| Không thay đổi auth flow khi chưa hỏi Tech Lead | Block ngay |
| Không thêm major npm dependency khi chưa hỏi Tech Lead | Block ngay |
| Codex mark Done ONLY sau khi Tech Lead comment LGTM | Block ngay |
| Tech Lead review mọi change — không có bypass | Block ngay |

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
| Legacy Hita scripts nhìn có vẻ còn chạy được | Không dùng. Chạy pipeline normalized trong `scripts/crawl-hita/README.md` |

---

> **Tech Lead (Claude):** Cập nhật file này sau mỗi convention mới hoặc gotcha mới phát hiện.
> **Codex:** Đây là file duy nhất cần đọc cho context. Không cần đọc CLAUDE.md hay docs/AGENT.md (chúng trỏ về đây).
> **Hita crawl/import:** `scripts/crawl-hita/README.md` là nguồn chuẩn duy nhất cho quy trình crawl sản phẩm Hita theo brand.
> **Archive:** `docs/archive/` chỉ là lịch sử, không dùng làm nguồn hướng dẫn vận hành hiện tại.
