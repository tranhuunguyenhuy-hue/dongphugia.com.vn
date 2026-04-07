# PROJECT SCOPE V2 — Đông Phú Gia

> Phiên bản: 3.0 | Cập nhật: 06/04/2026
> Linear: [Đông Phú Gia - Website VLXD](https://linear.app/leonguyen/project/djong-phu-gia-website-vlxd-179a568436a0)
> PM: Nguyen Huy + Cowork (Claude)

---

## Executive Summary

Scope V2 đã được **thay đổi hoàn toàn** vào 06/04/2026. Từ 6 workstreams ban đầu, giờ tập trung vào **3 hạng mục chính** theo thứ tự ưu tiên:

1. 🗄️ **Tái cấu trúc Database hoàn toàn** (LEO-366) — Urgent
2. 🛒 **Giỏ hàng & Checkout cơ bản** — High (blocked by DB)
3. 🎨 **Thay đổi giao diện (Design System)** — Medium (song song với DB)

**Timeline:** 2 tháng (29/03 → 31/05/2026)
**Team:** Antigravity (backend + frontend) · Huy (PM/review)

---

## ⚠️ Lý do thay đổi Scope (06/04/2026)

Schema hiện tại (53 models, mỗi danh mục 1 bộ bảng riêng) **không tương thích** với cấu trúc data từ hita.com.vn, gây lỗi khi import. PM quyết định:

- **Bỏ schema cũ, thiết kế lại từ đầu** theo cấu trúc hita
- **Cancel** tất cả data pipeline issues (LEO-327, 332, 338-342, 360, 361, 365)
- **Cancel** Search & Navigation epic (LEO-329, 346, 347) — xem xét lại sau launch
- **Cancel** Vietceramics crawl (LEO-361)
- **Giữ nguyên** Design System epic (LEO-328) — chạy song song

---

## 1. Hiện trạng dự án (06/04/2026)

### Tech Stack
```
Frontend:   Next.js + React 19 + TypeScript 5
Styling:    Tailwind CSS v4 (@theme directive)
UI:         shadcn/ui (Radix UI) + Lucide React
Auth:       HMAC-SHA256 cookie (admin only)
Database:   Supabase PostgreSQL (53 Prisma models → sẽ thành ~20-25)
ORM:        Prisma 5.22.0
Storage:    Supabase Storage (bucket: images)
Deploy:     Vercel (LIVE tại dongphugia.com.vn)
```

### Đã hoàn thành

| Milestone | Nội dung | Khi nào |
|-----------|---------|---------|
| V1 | 5 danh mục SP, Blog, Partners, Projects, About, Admin CMS | Trước 29/03 |
| Sprint 1 | DB Audit, Cleanup, Vercel deploy, DNS, Hita import 5,254 SP | 29/03-01/04 |
| P0 Hotfixes | LEO-333→337 (cdn config, featured, debug routes, stats) | 02-05/04 |

### Data hiện có

| Category | Số SP | Ảnh chính | Status |
|----------|-------|-----------|--------|
| TB Vệ Sinh | 4,472 | ✅ Supabase | Sẽ re-import theo schema mới |
| TB Bếp | 597 | ✅ Supabase | Sẽ re-import theo schema mới |
| Vật Liệu Nước | 185 | ✅ Supabase | Sẽ re-import theo schema mới |
| Gạch Ốp Lát | 62 (cũ) | ❌ | Sẽ xóa → crawl + import mới |
| Sàn Gỗ | 0 | ❌ | Crawl + import mới sau DB xong |

---

## 2. Scope V2 (Revised) — 3 Workstreams

### WS1: Tái cấu trúc Database hoàn toàn (LEO-366)
**Priority:** 🔴 Urgent | **Status:** In Progress | **Due:** 19/04/2026

> ⚠️ **Đây là blocker chính** — Cart/Checkout và Data Import đều phụ thuộc vào WS1.

**Mục tiêu:**
- Thiết kế lại schema từ đầu, tương thích cấu trúc data hita.com.vn
- Tinh gọn từ 53 → ~20-25 models
- Unified product table thay vì 5 bảng riêng biệt
- Unified brands table (thay 3 bảng `tbvs_brands`, `bep_brands`, `nuoc_brands`)
- Nền tảng sạch cho Cart/Checkout system

**Schema mới (gợi ý từ PM):**
```
products (unified)
├── id, sku, name, slug
├── category (enum: gach | tbvs | bep | nuoc | sango)
├── brand_id, product_type_id
├── price, price_display, description
├── is_featured, is_active
├── seo_title, seo_description
├── created_at, updated_at

product_images
├── id, product_id, url, type (main | gallery | hover)
├── sort_order

product_attributes (EAV hoặc JSONB)
├── Attributes linh hoạt theo category
```

> ⚠️ Schema cuối cùng do backend quyết định dựa trên audit hita data structure.

**4 Phase:**

| Phase | Nội dung | Deadline |
|-------|---------|----------|
| Phase 1 — Audit & Design | Phân tích hita structure + thiết kế schema mới + PM review | 10/04 |
| Phase 2 — Implementation | SQL migration + Prisma sync | 15/04 |
| Phase 3 — Code Update | Viết lại Server Actions + Public API | 19/04 |
| Phase 4 — Data Import | Import TBVS + Bếp + Nước + Gạch + Sàn gỗ | 26/04 |

**Tài liệu tham khảo:**
- [`DB-AUDIT-REPORT.md`](file:///Users/m-ac/Projects/dongphugia/DB-AUDIT-REPORT.md) — Audit schema hiện tại (43 models)
- [`hita-analysis-report.md`](file:///Users/m-ac/Projects/dongphugia/backups/archives/hita-analysis-report.md) — Phân tích data hita + field mapping
- `scripts/hita-import/*.json` — Data JSON đã crawl từ hita

**Lưu ý kỹ thuật:**
- KHÔNG dùng `prisma migrate` — quản lý SQL thủ công qua Supabase Dashboard
- Backup dữ liệu hiện tại trước khi drop tables
- `npx prisma db pull` + `npx prisma generate` sau khi migration xong

---

### WS2: Cart & Checkout (sau LEO-366 xong)
**Priority:** 🟠 High | **Status:** Blocked by WS1 | **Target:** Sprint 3 (27/04 → 10/05)

**Mục tiêu:** Thêm flow mua hàng không cần đăng nhập.

**User flow:**
```
SP → Thêm vào giỏ → Xem giỏ → Checkout
    ↓
Điền thông tin (tên, SĐT, email, địa chỉ, ghi chú)
    ↓
Chọn thanh toán: Chuyển khoản | Thanh toán sau
    ↓
Trang xác nhận: Mã đơn + QR VietQR
    ↓
Admin nhận thông báo → Xác nhận thủ công
```

**Backend:**
- `orders` + `order_items` tables (schema đã có trong `DB-AUDIT-REPORT.md` mục 4)
- `order-actions.ts`: createOrder, getOrderByNumber, updateOrderStatus
- Admin: `/admin/orders/*` — list, detail, update status

**Frontend:**
- Cart state: localStorage (client-side, no login required)
- Cart icon + badge trên Header
- `/gio-hang` — Cart page
- `/dat-hang` — Checkout + form + payment method
- `/xac-nhan-don-hang/[id]` — Confirmation + QR bank transfer

> ⚠️ PM cần cung cấp thông tin tài khoản ngân hàng ĐPG trước 26/04

---

### WS3: Design System Overhaul (song song với WS1)
**Priority:** 🟡 Medium | **Status:** Backlog | **Epic:** LEO-328

**Mục tiêu:** Redesign 90% style/color, giao diện mới cho toàn bộ components & pages.

**Issues:**

| Issue | Nội dung | Due |
|-------|---------|-----|
| LEO-343 | Color Palette + Typography mới | 12/04 |
| LEO-344 | Implement Design Tokens globals.css @theme | 15/04 |
| LEO-345 | Redesign Base Components | 22/04 |

**Blocked by:** PM cung cấp reference sites (deadline: 12/04)

---

## 3. Sprint Plan (Revised 06/04)

### Sprint 2 (06/04 → 26/04) — DB + Design
```
Week 1 (06-12/04): LEO-366 Phase 1 (Audit & Design) + LEO-343 (Palette)
Week 2 (13-19/04): LEO-366 Phase 2-3 (Migration + Code) + LEO-344 (Tokens)
Week 3 (20-26/04): LEO-366 Phase 4 (Data Import) + LEO-345 (Components)
```

### Sprint 3 (27/04 → 10/05) — Cart + Page Redesign
```
Week 1: Cart/Checkout Backend (orders schema + actions)
        + LEO-349 (Homepage redesign)
Week 2: Cart/Checkout Frontend + LEO-350, 351 (Category, Product redesign)
```

### Sprint 4 (11/05 → 31/05) — SEO + Content + Launch
```
LEO-353: JSON-LD Schema Markup
LEO-354: Open Graph + Meta Tags
LEO-355: Sitemap.xml + robots.txt
LEO-356: Blog Content
LEO-357: E2E Testing
LEO-358: Lighthouse >90
LEO-359: Final Deploy V2 (HARD DEADLINE: 31/05)
```

---

## 4. Linear Issue Map (06/04/2026)

### ✅ Done (Sprint 1 + P0)
LEO-289, 290, 291, 292, 278, 307, 308, 309-319, 320, 321, 322, 323,
LEO-333, 334, 335, 336, 337, 362

### 🔄 In Progress
| Issue | Title | Due |
|-------|-------|-----|
| LEO-366 | 🗄️ DB Restructure | 19/04 |
| LEO-363 | BunnyCDN Setup | ~sớm |

### ⏳ Backlog (Active)
| Issue | Title | Sprint |
|-------|-------|--------|
| LEO-343 | Color Palette + Typography | S2 |
| LEO-344 | Design Tokens | S2 |
| LEO-345 | Redesign Components | S2 |
| LEO-364 | Fix ảnh production via BunnyCDN | S2 |
| LEO-349 | Redesign Homepage | S3 |
| LEO-350 | Redesign Category Pages | S3 |
| LEO-351 | Redesign Product Detail | S3 |
| LEO-352 | Redesign About + Partners | S3 |
| LEO-348 | Mega Dropdown Menu | S3 |
| LEO-353-359 | SEO + Content + Launch | S4 |

### ❌ Cancelled (06/04)
LEO-327, 329, 332, 338, 339, 340, 341, 342, 346, 347, 360, 361, 365

---

## 5. PM Decisions

### ✅ Đã chốt

| Quyết định | Ngày |
|-----------|------|
| Phương án tái cấu trúc DB: bỏ schema cũ, thiết kế lại từ đầu theo hita | 06/04 |
| Cancel data pipeline cũ, focus vào DB restructure | 06/04 |
| Cancel Search & Navigation, xem xét sau launch | 06/04 |
| Cancel vietceramics crawl, dùng hita làm nguồn chính | 06/04 |

### 🔴 Đang chờ

| Câu hỏi | Deadline | Blocks |
|---------|----------|--------|
| Design reference sites cho color palette VLXD? | **12/04** | LEO-343 → toàn bộ Design System |
| Thông tin tài khoản ngân hàng ĐPG (tên, STK, ngân hàng) | **26/04** | QR VietQR checkout |

---

## 6. Scope loại bỏ khỏi V2

| Hạng mục | Lý do | Khi nào xem lại |
|----------|-------|-----------------|
| `dien_*` (Điện), `khoa_*` (Khóa) | Đã xóa khỏi DB (LEO-291) | Không xem lại |
| Data Pipeline cũ (mirror gallery/hover, dead URL) | DB làm lại từ đầu, pipeline cũ vô nghĩa | Sau V2 launch |
| Search & Navigation (LEO-329, 346, 347) | Scope quá rộng cho V2 | Post-launch V2.1 |
| Vietceramics crawl (LEO-361) | Pivot sang hita làm nguồn chính | Không xem lại |
| Cart/Checkout ban đầu → **đã đưa lại vào scope** | PM quyết định 06/04 | Sprint 3 |

---

## 7. Definition of Done (V2)

- [ ] Database schema mới hoạt động (~20-25 models)
- [ ] Data import từ hita thành công (TBVS + Bếp + Nước)
- [ ] Giỏ hàng + checkout hoạt động end-to-end
- [ ] QR chuyển khoản VietQR hiển thị đúng
- [ ] Design system mới áp dụng toàn bộ
- [ ] Website live tại dongphugia.com.vn
- [ ] SEO: Lighthouse >90, JSON-LD, Open Graph
- [ ] Blog có nội dung thực (10+ bài)
- [ ] Responsive: mobile + tablet + desktop
- [ ] E2E testing pass all critical flows

---

> **Lần cập nhật tiếp theo:** Sau khi LEO-366 Phase 1 hoàn thành (10/04)
> **PM cần hành động ngay:** Cung cấp design reference sites trước 12/04
