# PROJECT STATUS — Đông Phú Gia V2

> **Cập nhật:** 09/04/2026 — Tái cấu trúc Linear sang Feature/Domain
> Linear: [ĐPG V2 Initiative](https://linear.app/leonguyen/initiative/dpg-v2-e-commerce-showcase-launch-f9198055)
> **Deadline cứng: 31/05/2026 — Final Deploy V2**

---

## 🗂️ Cấu trúc Linear (Feature/Domain — 09/04/2026)

### Initiative: ĐPG V2 — E-Commerce Showcase Launch

| Project | Timeline | Status | Key Issues |
|---------|----------|--------|------------|
| **Design System & Foundation** | 09/04 → 26/04 | 🔵 Active | LEO-371→373, 392, 393, 388→391 |
| **Page Redesign — 3 Core Pages** | 27/04 → 10/05 | ⏳ Upcoming | LEO-374→376, 394→396, 348, 352 |
| **Quote Cart & Checkout** | 01/05 → 15/05 | ⏳ Upcoming | LEO-397, 398, 399 |
| **SEO, Testing & Launch** | 11/05 → 31/05 | ⏳ Upcoming | LEO-353→359 |

### Workflow bất biến: Designer → Dev (Contract-Driven)
```
[Designer] Figma DONE  →  [Dev] Implementation starts
KHÔNG bắt đầu Dev khi Design chưa Done
```

---

## 🔒 Project 1: Design System & Foundation (09/04 → 26/04)

### 🎨 Designer Track
| Issue | Title | Due | BlockedBy | Status |
|-------|-------|-----|-----------|--------|
| LEO-371 | [Designer] Color Palette & Typography | 14/04 | — | 📋 Todo |
| LEO-372 | [Designer] Design Tokens — globals.css spec | 18/04 | LEO-371 | 📋 Todo |
| LEO-373 | [Designer] Base Components Figma Kit | 23/04 | LEO-372 | 📋 Todo |

### ⚙️ Dev Track
| Issue | Title | Due | BlockedBy | Status |
|-------|-------|-----|-----------|--------|
| LEO-392 | [Dev] Implement Design Tokens in globals.css | 25/04 | LEO-372 | 📋 Todo |
| LEO-393 | [Dev] Build Base Components (Button, Card, Nav...) | 26/04 | LEO-373, LEO-392 | 📋 Todo |

### 🔒 Security & Platform (URGENT — trước 20/04)
| Issue | Title | Due | Status |
|-------|-------|-----|--------|
| LEO-388 | [Security] API Rate Limiting | **20/04** | 📋 Todo |
| LEO-389 | [Security] Admin Session Expiry | **20/04** | 📋 Todo |
| LEO-390 | [Reliability] Centralized Error Handler | 05/05 | 📋 Todo |
| LEO-391 | [Observability] Structured Production Logging | 05/05 | 📋 Todo |

---

## 🖥️ Project 2: Page Redesign — 3 Core Pages (27/04 → 10/05)

| Issue | Role | Title | Due | BlockedBy |
|-------|------|-------|-----|-----------|
| LEO-374 | Designer | Homepage — Hero + Category + Featured | 30/04 | LEO-373 |
| LEO-394 | Dev | Homepage Frontend Implementation | 03/05 | LEO-374 |
| LEO-375 | Designer | Category Page — Filter + Grid + Sort | 02/05 | LEO-373 |
| LEO-395 | Dev | Category Page — Filter URL State + Grid | 07/05 | LEO-375, LEO-393 |
| LEO-376 | Designer | Product Detail — Gallery + Specs + CTA | 05/05 | LEO-373 |
| LEO-396 | Dev | Product Detail — Gallery + Specs + Quote | 09/05 | LEO-376 |
| LEO-348 | Dev | Mega Dropdown Menu (Desktop + Mobile) | 08/05 | LEO-393 |
| LEO-352 | Dev | About + Partners + Projects Pages | 10/05 | LEO-393 |

---

## 🛒 Project 3: Quote Cart & Checkout (01/05 → 15/05)

| Issue | Role | Title | Due | BlockedBy |
|-------|------|-------|-----|-----------|
| LEO-397 | Designer | Cart Drawer + Checkout + VietQR + Lookup | 07/05 | LEO-373 |
| LEO-398 | Dev | Quote Cart Frontend (Context, Drawer, Form) | 12/05 | LEO-397, LEO-396 |
| LEO-399 | Dev | Admin Order Management Dashboard | 15/05 | — |

> ⚠️ **Blocker:** Bank info ĐPG (tên/STK/ngân hàng) cần trước 26/04 để build VietQR

---

## 🚀 Project 4: SEO, Testing & Launch (11/05 → 31/05)

| Issue | Title | Due | Status |
|-------|-------|-----|--------|
| LEO-353 | JSON-LD Schema (Product, Breadcrumb, LocalBusiness) | 15/05 | 📋 Todo |
| LEO-354 | Open Graph + Meta Tags toàn trang | 15/05 | 📋 Todo |
| LEO-355 | Sitemap.xml + robots.txt (5,288 SP) | 17/05 | 📋 Todo |
| LEO-356 | Blog Content — 10 bài VLXD | 22/05 | 📋 Todo |
| LEO-357 | E2E Testing — Playwright critical flows | 25/05 | 📋 Todo |
| LEO-358 | Lighthouse Score >90 | 27/05 | 📋 Todo |
| LEO-359 | **Final Deploy V2** | **31/05** | 📋 Todo |

---

## ⚠️ PM Decisions Cần Chốt

| Câu hỏi | Deadline | Blocks |
|---------|----------|--------|
| **Color palette reference sites** (2-3 website VLXD) | **14/04** | LEO-371 → toàn bộ Design System |
| **Bank info ĐPG** (tên, STK, ngân hàng) | **26/04** | LEO-397 VietQR |
| **10 SP GACH-36GP*** — giữ ẩn hay xóa? | 15/04 | DB cleanliness |

---

## ⚠️ Critical Blockers Kỹ Thuật

### 1. Git Branch chưa merge
```
leo-366-db-restructure → main  (PENDING MERGE)
Risk: Conflict khi develop Page Redesign song song
Action: Merge trước 27/04 (trước khi bắt đầu Project 2)
```

### 2. Security Issues URGENT
```
LEO-388 Rate Limiter + LEO-389 Session Expiry → Deadline 20/04
Cần thực hiện TRƯỚC bất kỳ page redesign nào
```

---

## ✅ PM Decisions Đã Chốt

| Issue | Quyết định | Ngày |
|-------|-----------|------|
| **Scope V2** | DB tái cấu trúc + Cart/Checkout + Design | 06/04 |
| **Search** | Không nằm trong scope V2 | 09/04 |
| **Sàn Gỗ** | Bỏ qua — Vietceramics không có data | 08/04 |
| **Gạch Ốp Lát** | Crawl vietceramics.com, SKU prefix GACH- | 08/04 |
| **Quote Flow** | Multi-product — `quote_items` table | 07/04 |
| **Cart** | localStorage only — không cần DB | 07/04 |
| **CDN** | Bunny CDN (`cdn.dongphugia.com.vn`) | 07/04 |
| **Deploy** | Maintenance Mode bật chờ V2 xong | 07/04 |

---

## 📊 Data Status (09/04/2026)

| Category | SP Active | Ảnh CDN | Status |
|----------|-----------|---------|--------|
| TB Vệ Sinh | 4,312 | ✅ Bunny CDN | 🟢 Done |
| TB Bếp | 470 | ✅ Bunny CDN | 🟢 Done |
| Vật Liệu Nước | 85 | ✅ Bunny CDN | 🟢 Done |
| Gạch Ốp Lát | 111 (10 inactive) | ✅ 92% | 🟢 Done |
| Sàn Gỗ | 0 | — | ⚫ Bỏ qua |

**Tổng: 4,978 sản phẩm active**

### Ghi chú Gạch (LEO-387)
- 10 SP `GACH-36GP*` đã `is_active = false` — nguồn đã xóa trang
- PM confirm trước 15/04: **giữ ẩn hay xóa hẳn?**

---

## 🔧 Codebase Health (09/04/2026)

| Metric | Value |
|--------|-------|
| TypeScript errors | 0 |
| Prisma schema | 23 models, valid |
| Next.js | Build pass |
| Backend API | `public-api-products.ts` + `actions.ts` V2 |
| Admin CMS | `/admin/*` fully functional |
| Public pages | V1 design — chờ Design System |
| Maintenance | Active trên production |
| Backend Audit Score | 25/55 (45%) — 08/04/2026 |

---

## 📁 Scripts & Tools

| Script | Mục đích |
|--------|---------|
| `scripts/seed/seed-gach-categories.mjs` | Seed categories Gạch |
| `scripts/product-import/crawl-vietceramics-listing.mjs` | Crawl listing |
| `scripts/product-import/crawl-vietceramics-detail.mjs` | Crawl chi tiết |
| `scripts/product-import/import-vietceramics.mjs` | Import vào DB |
| `scripts/product-import/patch-gach-specs.mjs` | Re-patch specs |
| `scripts/product-import/fix-cdn-images.mjs` | Mirror ảnh CDN |
| `scripts/product-import/verify-gach-import.mjs` | Verification |

---

## 🗑️ Issues Cancelled (09/04 Restructure)

> Sprint-based epics + duplicate issues — thay thế bởi Feature/Domain structure:
> `LEO-328` `LEO-329` `LEO-330` `LEO-331` (4 Epics cũ)
> `LEO-343` `LEO-344` `LEO-345` `LEO-349` `LEO-350` `LEO-351` (6 Duplicates)

## Scope Loại Bỏ Khỏi V2

- `dien_*` `khoa_*` — xóa khỏi DB + Prisma (LEO-291)
- Sàn gỗ data pipeline — không có data (08/04)
- Search backend (LEO-346, 347) — cancelled 09/04
- Data pipeline cũ (mirror gallery/hover, dead URL detector) — cancelled
