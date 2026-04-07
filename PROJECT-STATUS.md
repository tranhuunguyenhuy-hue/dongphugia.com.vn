# PROJECT STATUS — Đông Phú Gia

> Cập nhật: **07/04/2026** — V2 Data Pipeline + Backend đang hoàn thiện
> Linear: [Đông Phú Gia - Website VLXD](https://linear.app/leonguyen/project/djong-phu-gia-website-vlxd-179a568436a0)
> **Cập nhật file này sau mỗi milestone hoàn thành.**

---

## Trạng thái tổng quan

| Metric | Value |
|--------|-------|
| Build | ✅ TypeScript PASS |
| Prisma | 43 models (sẽ → ~20-25 sau LEO-366) |
| Database | Supabase PostgreSQL (production) |
| Deploy | ✅ Live tại dongphugia.com.vn |
| Git | `main` branch |
| Linear | 7 Epics + 28 Sub-issues đã setup (LEO-326 → LEO-360) |
| Initiative | [ĐPG V2 — E-Commerce Showcase Launch](https://linear.app/leonguyen/initiative/djpg-v2-e-commerce-showcase-launch-d7b4d0725005) |

---

## V1 — Hoàn thành ✅

### Backend + Frontend (5 danh mục)
- ✅ Gạch ốp lát, TB Vệ sinh, TB Bếp, Vật liệu nước, Sàn gỗ: Server Actions + Public API + Admin CMS + Public pages

### Content & Pages
- ✅ Blog, Đối tác, Dự án, Về chúng tôi, Trang chủ

### Infrastructure
- ✅ Auth HMAC-SHA256, ImageUploader → Supabase, Sitemap động, Quote Request, Admin Crawler, Floating Contact

---

## Sprint 1 — Hoàn thành ✅ (29/03 → 01/04)

| Issue | Nội dung | Ngày xong |
|-------|---------|-----------|
| LEO-307/308 | Cleanup + clone fresh codebase | 29-30/03 |
| LEO-289-291 | DB Audit + xóa dien_*/khoa_* | 30/03 |
| LEO-309-319 | Agent Framework: Rules, Commands, Profiles | 30-31/03 |
| LEO-292, LEO-278 | Vercel deploy + DNS dongphugia.com.vn | 30-31/03 |
| LEO-320, LEO-321 | Hita crawler + import 5,254 SP | 31/03-01/04 |
| LEO-322 | Mirror 5,254 ảnh chính → Supabase Storage | 01/04 |
| LEO-323 | Gallery crawl TBVS (in progress khi S1 kết thúc) | ~02/04 |

---

## V2 Roadmap — Cấu trúc mới (03/04/2026)

> Tất cả issues đã được tổ chức lại trên Linear theo "Layered Linear" model.
> Initiative → Project → Milestones → Epics → Sub-issues

### Linear Structure

```
Initiative: ĐPG V2 — E-Commerce Showcase Launch (31/05/2026)
└── Project: Đông Phú Gia - Website VLXD
    ├── Milestone: Sprint 2 — P0 Hotfix + Design System + Data (26/04)
    ├── Milestone: Sprint 3 — Search + Navigation + Page Redesign (10/05)
    └── Milestone: Sprint 4 — SEO + Content + Launch (31/05)
```

### Labels

| Label | Màu | Mục đích |
|-------|-----|----------|
| Bug | 🔴 | Lỗi runtime/UI |
| Feature | 🟣 | Tính năng mới |
| PM Decision | 🟡 | Cần PM chốt trước khi làm |
| Blocked | 🔴 | Bị chặn bởi dependency |
| Data | 🟢 | Data pipeline, crawl, import |
| Design | 🩷 | Design system, visual |
| Frontend | 🟣 | UI/UX, React |
| Backend | 🔵 | DB, Prisma, Server Actions |
| SEO | 🟢 | SEO, schema, sitemap |
| Content | 🟡 | Blog, ảnh, data entry |
| DevOps | 🟠 | Deploy, CI/CD |

---

## ⚠️ Scope V2 — Thay đổi 06/04/2026

3 hạng mục chính thay thế hoàn toàn scope V2 cũ (6 workstreams):

| Hạng mục | Priority | Status |
|----------|----------|--------|
| 🗄️ Tái cấu trúc database hoàn toàn (LEO-366) | 🔴 Urgent | Backlog → bắt đầu ngay |
| 🛒 Giỏ hàng & checkout cơ bản | 🟠 High | Blocked by LEO-366 |
| 🎨 Thay đổi giao diện (Design System) | 🟡 Medium | Song song với DB |

**Issues đã cancel (06/04):** LEO-327, 329, 332, 338, 339, 340, 341, 342, 346, 347, 348, 360, 361, 365

---

## Sprint 2 (revised) — DB Restructure + Design System (06/04 → 26/04)

### 🔴 Epic: P0 Hotfixes (LEO-326) — ✅ Hoàn thành

| Sub-issue | Nội dung | Priority | Status |
|-----------|---------|----------|--------|
| LEO-333 | Thêm cdn.hita.com.vn vào next.config.ts | 🔴 Urgent | ✅ Done |
| LEO-334 | Set is_featured = true cho TBVS/BEP/NUOC | 🔴 Urgent | ✅ Done |
| LEO-335 | Cleanup debug routes /api/db-test... | 🟠 High | ✅ Done |
| LEO-336 | Fix About stats "0+" | 🟠 High | ✅ Done |
| LEO-337 | Xử lý Sàn gỗ 0 SP | 🟠 High | ✅ Done |

### 🗄️ DB Restructure (LEO-366) — 🔴 Urgent — **MỚI**

| Phase | Nội dung | Deadline |
|-------|---------|----------|
| Phase 1 | Audit hita data structure + thiết kế schema mới | 10/04 |
| Phase 2 | SQL migration + Prisma sync | 15/04 |
| Phase 3 | Viết lại Server Actions + Public API | 19/04 |
| Phase 4 | Import data từ hita (TBVS + Bếp + Nước + Gạch + Sàn gỗ) | 26/04 |

### 🎨 Epic: Design System (LEO-328) — Song song với DB

| Sub-issue | Nội dung | Priority | Due |
|-----------|---------|----------|-----|
| LEO-343 | Định nghĩa Color Palette + Typography mới | 🟠 High | 12/04 |
| LEO-344 | Implement Design Tokens globals.css @theme | 🟠 High | 15/04 |
| LEO-345 | Redesign Base Components | 🟠 High | 22/04 |

---

## Sprint 3 (revised) — Cart/Checkout + Page Redesign (27/04 → 10/05)

### 🛒 Cart & Checkout — 🟠 High (sau khi LEO-366 xong)

| Task | Nội dung | Due |
|------|---------|-----|
| TBD | Backend: orders + order_items schema, order-actions.ts | 01/05 |
| TBD | Backend: Admin order management CMS (/admin/orders) | 03/05 |
| TBD | Frontend: Cart page + Checkout flow | 07/05 |
| TBD | Frontend: Order confirmation + QR VietQR | 10/05 |

> ⚠️ PM cần cung cấp thông tin tài khoản ngân hàng ĐPG trước 26/04 để build QR VietQR.

### 🖼️ Epic: Page Redesign (LEO-330)

| Sub-issue | Nội dung | Priority | Due |
|-----------|---------|----------|-----|
| LEO-349 | Homepage — Hero, Featured, Sections | 🟠 High | 05/05 |
| LEO-350 | Category Pages — Layout, Filter, Grid | 🟠 High | 08/05 |
| LEO-351 | Product Detail — Gallery Lightbox + Tabs | 🟠 High | 10/05 |
| LEO-352 | About + Partners + Projects pages | 🟡 Medium | 10/05 |

---

## Sprint 4 — SEO + Content + Launch (11/05 → 31/05)

### 🚀 Epic: Launch Readiness (LEO-331)

| Sub-issue | Nội dung | Priority | Due |
|-----------|---------|----------|-----|
| LEO-353 | JSON-LD Schema Markup | 🟠 High | 15/05 |
| LEO-354 | Open Graph + Meta Tags | 🟠 High | 15/05 |
| LEO-355 | Sitemap.xml + robots.txt | 🟠 High | 17/05 |
| LEO-356 | Blog Content — 10 bài VLXD | 🟡 Medium | 20/05 |
| LEO-357 | E2E Testing Playwright | 🟠 High | 22/05 |
| LEO-358 | Lighthouse Performance >90 | 🟠 High | 25/05 |
| LEO-359 | Final Deploy V2 | 🔴 Urgent | **31/05** |

---

## 📌 Data Status (07/04/2026)

> LEO-366 DB Restructure **HOÀN THÀNH** — Schema mới live trên Supabase với 22 models.
> Pipeline mới (Bunny CDN) đang chạy.

| Category | Enriched | Ảnh CDN | DB Import | Status |
|---|---|---|---|---|
| **TB Vệ Sinh** | ✅ 4,417 SP | ✅ 19,025 ảnh → `cdn.dongphugia.com.vn` | ⏳ Chờ sau BEP/NUOC | 🔄 Ready to import |
| **TB Bếp** | 🔄 Đang crawl (~400/570) | ⏳ Sau crawl | ⏳ | 🔄 In progress |
| **Vật Liệu Nước** | ⏳ Chờ BEP | ⏳ | ⏳ | 📋 Queued |
| **Gạch Ốp Lát** | ❌ Chưa | ❌ | ❌ | 📋 Sprint 3 |
| **Sàn Gỗ** | ❌ Chưa | ❌ | ❌ | 📋 Sprint 3 |

---

## 🔧 Backend Progress (07/04/2026)

### ✅ Hoàn thành hôm nay

| Task | Mô tả | Commit |
|------|-------|--------|
| **quote_items migration** | Thêm `quote_items` table + `quote_number` vào `quote_requests` | `db push` ✅ |
| **Filter params** | Thêm `color_id`, `material_id`, `origin_id`, `price_min`, `price_max`, `is_bestseller` vào `getPublicProducts()` | ✅ |
| **Prisma client** | Regenerated với schema mới (23 models) | ✅ |

### 📋 Còn lại để 100% Backend

| # | Task | Priority | ETA |
|---|------|---------|-----|
| 1 | **Import DB** — Chạy `import-v2.mjs` sau BEP/NUOC xong | 🔴 Blocker | ~16:00 hôm nay |
| 2 | **Quote Request API** — `POST /api/quote-requests` multi-product | 🔴 P0 | Sprint 2 |
| 3 | **Quote Lookup API** — `GET /api/quote-requests?phone=xxx` | 🟡 P1 | Sprint 2 |
| 4 | **Order API** — `POST /api/orders` | 🟡 P1 | Sprint 3 |
| 5 | **Search API** — Full-text `/api/products/search` | 🟡 P1 | Sprint 3 |
| 6 | **Middleware** — Edge-level `/admin/*` protection | 🟢 P2 | Sprint 2 |

---

## ✅ PM Decisions Đã Chốt

| Issue | Quyết định | Ngày |
|-------|-----------|------|
| **LEO-360** | ~~Crawl vietceramics.com~~ → **SUPERSEDED** | 03/04 |
| **Scope V2** | DB tái cấu trúc hoàn toàn + Cart/Checkout + Design | 06/04 |
| **Quote Flow** | **Multi-product** — `quote_items` table (không phải single product_id) | 07/04 |
| **Cart** | **localStorage** only — không cần DB (B2B/quote-heavy) | 07/04 |
| **CDN** | **Bunny CDN** (`cdn.dongphugia.com.vn`) thay Supabase Storage | 07/04 |
| **Filters** | Sidebar có Color, Material, Origin — supported bởi DB hiện tại | 07/04 |

## 🔴 PM Decisions Còn Đang Chờ

| Câu hỏi | Deadline | Blocks |
|---------|----------|--------|
| Design reference sites cho color palette VLXD? (LEO-343) | **12/04** | Design System |
| Thông tin tài khoản ngân hàng ĐPG (tên, STK, ngân hàng) | **26/04** | QR VietQR |
| Wireframe update (Quote modal multi-product, Category filters, Cart notice) | **10/04** | Frontend Sprint 2 |

---

## Scope loại bỏ khỏi V2

- `dien_*` (Điện), `khoa_*` (Khóa) — đã xóa khỏi DB + Prisma (LEO-291)
- Data Pipeline cũ (mirror gallery/hover, dead URL detector) — cancelled 06/04
- Search & Navigation (LEO-329, 346, 347) — xem xét lại Sprint 3
- Vietceramics crawl (LEO-361) — cancelled 06/04
