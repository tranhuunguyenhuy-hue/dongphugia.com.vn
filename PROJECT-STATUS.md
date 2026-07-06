# PROJECT-STATUS — Đông Phú Gia

> **Cập nhật:** 14/06/2026 — Tech Lead (Claude Cowork).
> **Đọc file này đầu mỗi session** để nắm trạng thái hiện tại trước khi làm việc.
> **Roadmap & task:** [Linear Initiative "Đông Phú Gia — Website VLXD"](https://linear.app/leonguyen/initiative/djong-phu-gia-website-vlxd-1c5cd0379e7a) (P0–P5) — xem `ROADMAP.md` để đọc nhanh.
> **Team:** PM — Nguyen Huy · Tech Lead — Claude (Cowork) · **Dev chính — Codex (OpenAI)**, nhận task qua Linear, báo cáo qua Linear comments.
> Xem `docs/HANDOVER.md` để hiểu chi tiết kiến trúc hệ thống.

---

## Tình trạng tổng thể

| | |
|--|--|
| **Production** | ✅ Live tại `dongphugia.com.vn` — đang chạy tốt |
| **Build** | ✅ Ổn định |
| **Database** | ✅ PostgreSQL Supabase — 29 models, unified schema |
| **Admin** | ✅ RBAC 3 roles hoạt động đầy đủ |
| **Cart/Checkout** | ✅ Hoạt động — Zustand + localStorage + POST /api/orders |

---

## ✅ Đã hoàn thành (tính đến 27/05/2026)

### Core Platform
- [x] Next.js 16 App Router + TypeScript + Tailwind v4
- [x] PostgreSQL schema — 29 models (unified, đã tái cấu trúc từ schema cũ 53 models)
- [x] Prisma ORM + Supabase
- [x] Bunny CDN tích hợp cho ảnh sản phẩm

### Frontend Public
- [x] Homepage — HeroBanner, BrandSlider, Featured Products ×4, Blog preview, Contact form
- [x] Category pages — 4 danh mục với filter sidebar + mobile drawer
- [x] Product detail — gallery, variant selector (TOTO), price, CTA
- [x] Cart drawer + Cart page (`/gio-hang`)
- [x] Checkout form + Order success (`/dat-hang-thanh-cong`)
- [x] Tìm kiếm full-text (`/tim-kiem`) — PostgreSQL tsvector + ILIKE fallback
- [x] Blog listing + detail (`/tin-tuc` rewrite → `/blog`)
- [x] Liên hệ, Về chúng tôi, Đối tác, Dự án, Dịch vụ lắp đặt
- [x] 6 trang Chính sách pháp lý & Footer links (LEO-446)

### Admin CMS
- [x] Auth — bcrypt + session DB, rate limit 5 attempts/IP
- [x] RBAC — 3 roles: admin / sale_manager / sale
- [x] Product CRUD — 40+ fields, TipTap editor, dnd-kit image gallery
- [x] Orders — status workflow, A4 print, staff assignment
- [x] Quote requests — Quote Builder, A4 print, VAT config
- [x] Customer CRM
- [x] Blog CMS — TipTap editor, tags, SEO fields, draft/published
- [x] Users management — create/edit/deactivate

### SEO & Infrastructure
- [x] JSON-LD — LocalBusiness, Product, BreadcrumbList, Article
- [x] Sitemap (dynamic, 2000 products/file)
- [x] 3,323 old slug redirects (Edge Middleware + JSON map)
- [x] OpenGraph + meta tags
- [x] GTM integration
- [x] Maintenance mode (env flag)
- [x] Health endpoint `/api/health`

### Data
- [x] TOTO — sản phẩm đầy đủ nhất, variant system đang chạy
- [x] INAX, Caesar, Kohler và các brand khác — cơ bản

### Hita normalized pipeline — trạng thái hiện tại
- Pipeline chuẩn duy nhất: `scripts/crawl-hita/run-normalized-brand-pipeline.mts`
- Các brand đã imported sạch theo lane mới: `viglacera`, `caesar`, `atmor`, `cotto`, `duravit`, `thien-thanh`, `toto`, `grohe`, `esslinger`, `hansgrohe`, `moen`
- Đang chốt dở trước khi mở phase tiếp:
  - `american-standard` — restage sạch, ready for import lane
  - `kanly` — restage sạch, ready for import lane
  - `inax` — cần full rerun từ prepare mới đã validate
- Xem handoff ngắn:
  `docs/handoffs/2026-07-07-crawl-import-status.md`

---

## 🔄 Đang phát triển (theo Linear P0–P5)

### Variant System — Nâng cấp ✅ DONE
- Spec (LEO-423) + implement (LEO-435) đã hoàn thành. Variant system đã sẵn sàng scale multi-brand.

### QR VietQR — Checkout → P4 / M2 (LEO-431)
- **Trạng thái:** Thông tin tài khoản ngân hàng ĐPG đã có, chưa build.
- **Cần làm:** Tích hợp QR vào `/dat-hang-thanh-cong`. Target 31/10.

### Design System → P1 / M2 (LEO-433)
- **Trạng thái:** Implement một phần.
- **Cần làm:** Đồng bộ color token + typography toàn site. Target 31/08.

### Frontend redesign 4 trang lõi → P1 (LEO-441→445)
- Homepage, Category, PDP, Cart/Checkout, Search — redesign theo design system mới. Target 31/07–31/08.

---

## ✅ Đã xử lý (Sprint 1 — Foundation)

### Security — DONE
| # | Issue | Linear | Trạng thái |
|---|-------|--------|-----------|
| 1 | Upload API không có auth | LEO-418 | ✅ Đã thêm admin auth |
| 2 | Orders API không rate limit | LEO-419 | ✅ Đã rate limit |
| 3 | Search API không rate limit | LEO-419 | ✅ Đã rate limit |

### Technical Debt — DONE
| # | Issue | Linear | Trạng thái |
|---|-------|--------|-----------|
| 4 | `images.unoptimized: true` | LEO-420 | ✅ Đã điều tra & xử lý |
| 6 | Admin sidebar thiếu entries | LEO-422 | ✅ Đã thêm Banners/Đối tác/Dự án |
| 8 | Dual order number format | LEO-421 | ✅ Đã chuẩn hóa `DPG-YYYYMMDD-XXXXXX` |

## 🔴 Known Issues còn mở (đã đưa vào Linear)

| # | Issue | Linear / Project |
|---|-------|------------------|
| 5 | Revenue chart chưa dùng | LEO-432 · P3 (Admin) |
| 7 | Dead links sidebar + CRUD Banners/Partners/Projects | LEO-434 · P3 (Admin) |
| — | Lighthouse mobile chưa ≥90 | LEO-428 · P5 (Performance) |
| — | JSON-LD / sitemap audit | LEO-429, LEO-430 · P2 (SEO) |
| — | Catalog thiếu (Caesar/Kohler, Gạch, Nước) | LEO-426, LEO-427 · P4 |

---

## 📋 Backlog → đã cấu trúc thành Linear P0–P5

Toàn bộ backlog cũ đã được sắp xếp vào Initiative/Project/Milestone trong Linear (xem `ROADMAP.md`):

| Ưu tiên cũ | Nay nằm ở |
|-----------|-----------|
| Security assessment + fix | ✅ Done (Sprint 1) |
| Variant system upgrade | ✅ Done (Sprint 1) |
| Frontend redesign 4 trang | **P1** (LEO-441→445, 433) |
| SEO optimization | **P2** (LEO-429, 430) + **P5** Lighthouse (LEO-428) |
| Admin UX fixes | **P3** (LEO-434, 432) |
| Data expansion (Caesar/Kohler/Gạch/Nước) | **P4 / M1** (LEO-426, 427) |
| QR VietQR | **P4 / M2** (LEO-431) |
| Thanh toán online (VNPay/MoMo) | Chưa lên lịch (post P4) |

---

## 📁 Cấu trúc tài liệu

| File | Nội dung |
|------|---------|
| `CLAUDE.md` | Tech conventions, workflow, rules — đọc mỗi session |
| `PROJECT-STATUS.md` | File này — snapshot hiện tại |
| `GEMINI.md` | ⚠️ Deprecated (config Antigravity cũ) — dev hiện tại là Codex, đọc `docs/AGENTS.md` |
| `docs/HANDOVER.md` | Bàn giao chi tiết 27/05/2026 — kiến trúc, APIs, tất cả |
| `docs/plans/` | Scope plans lịch sử |
| `docs/prd/` | PRD documents |

---

> **Tech Lead:** Cập nhật section "Đang phát triển" và "Known Issues" khi có thay đổi.
> **Codex (Dev):** Đọc file này đầu mỗi session. Không tự sửa — báo Tech Lead nếu có gì sai.
