# ROADMAP — Đông Phú Gia

> **Cập nhật:** 01/06/2026 — Tech Lead (Claude Cowork)
> **Chiến lược:** Rebuild frontend hoàn toàn trên staging repo mới, giữ nguyên backend + DB. Production chỉ nhận backend/DB upgrades trong thời gian này.

---

## Kiến trúc 2-Track

```
PRODUCTION repo (dongphugia — repo này)       STAGING repo (mới — tạo ở Phase 1)
────────────────────────────────────          ────────────────────────────────────
✅ Đang live: dongphugia.com.vn               🚧 Vercel Preview URL
Backend upgrades + DB completion              Frontend rebuild hoàn toàn
Không đổi frontend                            Connect production DB (read + controlled)
User vẫn truy cập bình thường                 Mobile-first, new design system
```

---

## Milestones

| # | Milestone | Target | Criteria |
|---|-----------|--------|----------|
| M0 | Backend & DB frozen | **07/06** | API contracts stable, schema final, security fixed |
| M1 | Staging ready + Design handoff | **14/06** | Repo mới setup, design tokens, Figma handoff xong |
| M2 | Core pages complete | **21/06** | Homepage, categories ×4, product detail pass QA |
| M3 | All pages complete | **28/06** | Full frontend trên staging — mọi trang, mọi flow |
| M4 | QA & Integration pass | **05/07** | CWV ≥90, zero critical bugs, E2E test pass |
| M5 | Production launch | **12/07** | Hard switch deployed, 48h monitoring clean |
| M6 | Admin redesign + Payment | **Tháng 8** | Phase 2 complete |

---

## Phase 0 — Backend & DB Lock-down

**Target:** 01/06 → 07/06 | **Repo:** production (repo này)

**Goal:** Chốt hoàn toàn backend trước khi staging bắt đầu build. Staging không có moving target.

### Backend / Security
- [ ] Upload API authentication (`/api/upload-image` — hiện tại ai cũng upload được)
- [ ] Rate limit cho `/api/orders` và `/api/search`
- [ ] Fix dual order number format (REST API vs Server Action dùng 2 format khác nhau)
- [ ] `images.unoptimized: true` — điều tra lý do, enable nếu safe

### Database
- [ ] Variant system upgrade — apply cho INAX, Caesar, Kohler (hiện chỉ TOTO)
- [ ] Data expansion: INAX, Caesar crawl/import đầy đủ
- [ ] Data expansion: Gạch + Nước categories hoàn thiện
- [ ] Final `npx prisma db pull` → commit schema chốt

### Features
- [ ] VietQR tích hợp vào `/dat-hang-thanh-cong`
- [ ] Admin sidebar: thêm Banners, Đối tác, Dự án entries
- [ ] Admin sidebar: xóa dead links (Settings, Feedback, Support)

---

## Phase 1 — Staging Setup + Design Handoff

**Target:** 08/06 → 14/06 | **Repo:** staging (mới)

**Goal:** Môi trường staging sẵn sàng, design handoff complete, Antigravity có thể bắt đầu build.

### Infrastructure
- [ ] Tạo repo mới: copy prisma/, src/app/api/, src/lib/, src/middleware.ts, config files
- [ ] Strip toàn bộ `src/app/(public)/` và `src/components/` (sẽ rebuild từ đầu)
- [ ] Setup Vercel project mới → Preview URL
- [ ] Copy env vars (DATABASE_URL, BUNNY_CDN, etc.) → Vercel environment
- [ ] Confirm staging có read/write DB — setup `STAGING_MODE=true` để disable real mutations khi test

### Design System
- [ ] Nhận design handoff từ Claude Design (Figma)
- [ ] Setup Tailwind v4 `@theme` với brand tokens mới (màu, typography, spacing)
- [ ] Define component primitives: Button, Card, Badge, Input, Typography scale
- [ ] Mobile-first breakpoints confirmed

### Agent setup
- [ ] Tạo CLAUDE.md + AGENTS.md cho staging repo
- [ ] Antigravity nhận Linear issues đầu tiên

---

## Phase 2 — Frontend Build: Core Pages

**Target:** 08/06 → 21/06 | **Repo:** staging

**Goal:** Các trang core hoàn thiện với design mới, connect API production.

### Layout Shell
- [ ] Header mới (navigation, search, cart icon)
- [ ] Footer mới
- [ ] Mobile navigation drawer
- [ ] FloatingContact component

### Homepage
- [ ] Hero Banner section (mới)
- [ ] Brand slider / Featured brands
- [ ] Featured products ×4 categories
- [ ] Blog preview section
- [ ] Contact section

### Category Pages (×4)
- [ ] `/thiet-bi-ve-sinh` — listing + smart filter + mobile drawer
- [ ] `/thiet-bi-bep` — listing + filter (bep_* schema)
- [ ] `/gach-op-lat` — listing + filter
- [ ] `/vat-lieu-nuoc` — listing + filter
- [ ] ProductCard component (mobile-first)
- [ ] Pagination

### Product Detail
- [ ] Gallery (main + thumbnails)
- [ ] Variant selector (TOTO system)
- [ ] Price display + CTA
- [ ] Specs tabs
- [ ] Related products

---

## Phase 3 — Frontend Build: Flow & Content

**Target:** 15/06 → 28/06 | **Repo:** staging

**Goal:** Tất cả user flows và content pages hoàn thiện.

### Cart & Checkout
- [ ] Cart drawer (new design)
- [ ] Cart page `/gio-hang`
- [ ] Checkout form
- [ ] Order success `/dat-hang-thanh-cong` + VietQR
- [ ] Quote request flow

### Blog
- [ ] Blog listing `/blog`
- [ ] Blog detail `/blog/[slug]`

### Search
- [ ] `/tim-kiem` — full-text search UI mới

### Static Pages
- [ ] Về chúng tôi
- [ ] Liên hệ
- [ ] Đối tác
- [ ] Dự án
- [ ] Dịch vụ lắp đặt
- [ ] 6 trang Chính sách pháp lý

### SEO Infrastructure (staging)
- [ ] JSON-LD: LocalBusiness, Product, BreadcrumbList, Article
- [ ] OpenGraph + meta tags
- [ ] Sitemap dynamic
- [ ] Redirect mapping cho các URL thay đổi (update bảng `redirects`)

---

## Phase 4 — Integration & QA

**Target:** 22/06 → 05/07 | **Repo:** staging

**Goal:** Staging hoàn toàn connected với production data, mọi flow pass test.

### Integration
- [ ] Verify tất cả API calls production → staging hoạt động
- [ ] Cart → Order submission E2E test
- [ ] Quote request E2E test
- [ ] Search E2E test
- [ ] Image CDN load đúng (cdn.dongphugia.com.vn)

### Performance
- [ ] Core Web Vitals: LCP < 2.5s, CLS < 0.1, FID < 100ms
- [ ] Lighthouse Mobile ≥ 90
- [ ] `next/image` optimization enabled

### QA
- [ ] Mobile: iOS Safari + Android Chrome
- [ ] Desktop: Chrome, Firefox, Safari
- [ ] Cross-page navigation flows
- [ ] 404 / error states

### Cutover Prep
- [ ] Document URL changes → update `redirects` table
- [ ] Rollback plan: document Vercel rollback steps
- [ ] PM sign-off checklist ready

---

## Phase 5 — Production Cutover

**Target:** 06/07 → 12/07

**Goal:** Hard switch toàn bộ frontend mới lên dongphugia.com.vn.

### Pre-launch
- [ ] Final PM review + sign-off
- [ ] Announce maintenance window (nếu cần)
- [ ] Backup current Vercel deployment ID

### Deploy
- [ ] Copy staging code → production repo (giữ nguyên prisma/, api/, lib/)
- [ ] Deploy lên Vercel production
- [ ] Smoke test ngay sau deploy (homepage, search, order)

### Post-launch (48h monitoring)
- [ ] Monitor error logs Vercel
- [ ] Check Supabase query load
- [ ] Confirm CDN images load đúng
- [ ] GTM events firing
- [ ] Nếu critical bug → Vercel instant rollback

---

## Phase 6 — Post-Launch

**Target:** Tháng 8+

**Goal:** Hoàn thiện hệ thống sau khi frontend mới ổn định.

- [ ] **Admin panel redesign** — mobile-friendly, new design system
- [ ] **Payment gateway** — VNPAY hoặc MoMo tích hợp
- [ ] **SEO deep optimization** — Lighthouse, internal linking, structured data
- [ ] **Data expansion** — brands còn thiếu
- [ ] **Performance tuning** — ISR strategy, cache optimization

---

## Quyết định kiến trúc đã chốt

| Quyết định | Lựa chọn | Lý do |
|-----------|---------|-------|
| Repo strategy | Repo mới hoàn toàn | Isolate frontend, không conflict với production |
| DB strategy | Share production DB | Data thật ngay, không sync overhead |
| Staging write | `STAGING_MODE=true` disable mutations | Bảo vệ production data khi test |
| Admin redesign | Phase 6 — sau launch | Không block deadline frontend |
| Payment gateway | Post-launch | Không bundle vào redesign deadline |
| Cutover | Hard switch 1 lần | Đơn giản, Vercel instant rollback là safety net |
| URL changes | Partial — update `redirects` table | Giữ SEO, cho phép UX improvements |
| Antigravity workload | Song song với production tasks | Phân chia rõ theo phase |

---

> **Tech Lead:** Cập nhật checkboxes sau mỗi task complete.
> **PM:** Review milestone đạt/trượt vào cuối mỗi tuần.
