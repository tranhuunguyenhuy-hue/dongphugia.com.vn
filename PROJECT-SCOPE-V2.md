# PROJECT SCOPE V2 — Đông Phú Gia

> Phiên bản: 2.0 | Ngày tạo: 29/03/2026
> Linear: [Đông Phú Gia - Website VLXD](https://linear.app/leonguyen/project/djong-phu-gia-website-vlxd-179a568436a0)
> PM: Nguyen Huy + Cowork (Claude)

---

## Executive Summary

Scope V2 chuyển đổi dongphugia.com.vn từ website showcase (chỉ xem + báo giá) sang **e-commerce đơn giản** (giỏ hàng + checkout chuyển khoản), đồng thời **redesign toàn bộ giao diện**, **tinh gọn database**, **dọn sạch codebase**, và **nâng chất lượng data sản phẩm**.

**Timeline:** 2 tháng (29/03 → 31/05/2026)
**Team:** Claude Code (backend) · Antigravity (frontend) · Huy + Cowork (PM/review)

---

## 1. Hiện trạng dự án (baseline)

### Tech Stack
```
Frontend:   Next.js 16 + React 19 + TypeScript 5
Styling:    Tailwind CSS v4 (@theme directive)
UI:         shadcn/ui (Radix UI) + Lucide React
Auth:       HMAC-SHA256 cookie (admin only)
Database:   Supabase PostgreSQL
ORM:        Prisma 5.22.0 (53 models)
Storage:    Supabase Storage (bucket: images)
Deploy:     Vercel (chưa deploy production)
```

### Đã hoàn thành (V1)
- 5 danh mục sản phẩm: Gạch ốp lát, TB Vệ sinh, TB Bếp, Sàn gỗ, Vật liệu nước
- Admin CMS đầy đủ (14 modules CRUD)
- Blog, Partners, Projects, About Us
- Quote Request system (báo giá)
- Sitemap, SEO cơ bản, Floating Contact
- ~3,787 sản phẩm đã crawl từ TDM (chưa import production)
- Design system "AquaHome" (Blue #2E7A96 + Neutral + Sand)

### Vấn đề cần giải quyết
- **Database lặp nặng:** Mỗi danh mục có bộ bảng riêng (tbvs_*, bep_*, nuoc_*, sango_*) → 53 models, code duplicated
- **Design chưa tối ưu:** Cần redesign 90% style/color + toàn bộ components
- **Chưa có giỏ hàng:** Chỉ có hệ thống "Báo giá", chưa mua được
- **Data chưa sạch:** Ảnh crawler hotlink bị 400, data TDM chưa validate
- **Codebase chưa gọn:** 3 folder agent riêng (.agent/, .agents/, .claude/), nhiều file docs thừa ở root
- **Chưa deploy production**

---

## 2. Scope mới (V2) — 6 workstreams

### WS1: Database Audit & Restructure
**Mục tiêu:** Đánh giá và tinh gọn database schema, chuẩn SEO.

**Phase 1 — Audit (Agent chuyên môn):**
- Phân tích 53 models hiện tại, đánh giá mức độ trùng lặp
- Đề xuất schema mới (gộp vs giữ riêng vs hybrid)
- Đánh giá impact lên codebase (actions, API, admin CMS)
- Migration plan chi tiết + rollback strategy

**Phase 2 — Implementation:**
- Xóa hoàn toàn dien_* (5 bảng) và khoa_* (5 bảng) khỏi DB + Prisma schema
- Thực hiện restructure theo kết quả audit
- Thêm bảng mới cho Cart/Order system
- Cập nhật Prisma schema + generate client
- Data migration script cho existing data

**Bảng mới cần thiết (Cart/Order):**
```
orders
├── id, order_number, customer_name, customer_phone, customer_email
├── customer_address, customer_note
├── payment_method (bank_transfer | pay_later)
├── payment_status (pending | confirmed | failed)
├── order_status (pending | confirmed | processing | shipped | completed | cancelled)
├── subtotal, shipping_fee, total
├── bank_transfer_ref, confirmed_at
├── created_at, updated_at

order_items
├── id, order_id, product_type (gach | tbvs | bep | nuoc | sango)
├── product_id, product_name, product_sku, product_image_url
├── quantity, unit_price, subtotal
├── created_at
```

**SEO columns cần bổ sung (nếu chưa có):**
- `seo_title`, `seo_description`, `seo_canonical` trên tất cả product + category tables
- `structured_data` (JSON-LD) template per entity type

---

### WS2: Design System Overhaul
**Mục tiêu:** Redesign 90% style/color, giao diện mới cho toàn bộ components & pages.

**Trạng thái:** Chờ reference sites từ PM.

**Scope:**
- Thiết kế palette mới (thay thế AquaHome Blue system)
- Typography scale mới
- Cập nhật toàn bộ `globals.css` @theme tokens (~160 dòng)
- Redesign components: Button, Card, Input, Select, Badge, Dialog, Table...
- Redesign layout: Header, Footer, Sidebar (admin), Navigation
- Redesign pages: Homepage, Category listing, Product detail, Blog, About, Contact
- New pages: Cart, Checkout, Order confirmation, Order tracking

**Deliverables:**
- Design tokens file (globals.css) mới
- Component audit checklist (cái nào cần redesign, cái nào giữ)
- Page-by-page redesign với responsive breakpoints

---

### WS3: Giỏ hàng & Checkout
**Mục tiêu:** Thêm flow mua hàng không cần đăng nhập.

**User flow:**
```
Xem sản phẩm → Thêm vào giỏ → Xem giỏ hàng → Checkout
    ↓
Điền thông tin (tên, SĐT, email, địa chỉ, ghi chú)
    ↓
Chọn thanh toán: Chuyển khoản ngân hàng | Thanh toán sau
    ↓
Trang xác nhận: Mã đơn hàng + Thông tin chuyển khoản + QR code
    ↓
Admin nhận thông báo → Xác nhận thanh toán thủ công
```

**Frontend:**
- Cart state: localStorage (client-side, no login required)
- Cart icon trên Header với badge count
- Cart page: danh sách SP, +/-, xóa, subtotal
- Checkout page: form thông tin + chọn payment method
- Order confirmation page: mã đơn, QR bank transfer, thông tin liên hệ
- (Optional) Order lookup page: nhập SĐT/mã đơn → xem trạng thái

**Backend:**
- `order-actions.ts`: createOrder, getOrderByNumber, updateOrderStatus
- `public-api-orders.ts`: getOrderStatus (public lookup)
- Admin: `/admin/orders/*` — list, detail, update status, confirm payment
- Email notification (optional): gửi email xác nhận đơn cho khách

**QR Bank Transfer:**
- Thông tin tài khoản ngân hàng ĐPG (cần PM cung cấp)
- Generate QR code theo chuẩn VietQR (napas)
- Nội dung chuyển khoản: `DPG-{orderNumber}`

---

### WS4: Data Cleanup & Import
**Mục tiêu:** Lọc, validate, và import sạch dữ liệu sản phẩm.

**Tasks:**
- Validate ~3,787 sản phẩm TDM: tên, SKU, giá, mô tả, hình ảnh
- Fix ảnh hotlink bị 400 → download về Supabase Storage
- Loại bỏ duplicate, sản phẩm thiếu thông tin quan trọng
- Chuẩn hóa: slugs, SEO fields, price_display
- Import vào DB production sau khi DB restructure xong
- Verify data integrity post-import

---

### WS5: Codebase Cleanup
**Mục tiêu:** Dọn dẹp cấu trúc, gộp folder agent, xóa file thừa.

**Folder agent — giữ nguyên skills, chỉ dọn config:**
```
Giữ nguyên:                    Dọn dẹp:
├── .agent/     (Antigravity)   → Giữ nguyên (skills + workflows)
├── .agents/    (shared skills) → Giữ nguyên (symlinked skills)
├── .claude/    (Claude Code)   → Giữ nguyên (skills + settings)
```
> Skills của mỗi agent đã được cấu hình riêng, KHÔNG gộp.

**Files root cần dọn:**
- Giữ: `CLAUDE.md`, `README.md`, `PROJECT-SCOPE-V2.md`
- Xóa hoặc archive: `DOCS.md` (merge vào CLAUDE.md), `ERRORS.md`, `GEMINI.md`, `CHANGELOG.md` (archive), `PROJECT-STATUS.md` (thay bằng Linear)
- Di chuyển: backup files → `backups/`

**Codebase:**
- Xóa code liên quan dien_*/khoa_* (actions, API, admin pages nếu có)
- Gộp/refactor duplicate code giữa các category actions
- Clean up unused imports, components không dùng

---

### WS6: SEO & Performance
**Mục tiêu:** Schema markup, Open Graph, Core Web Vitals, Lighthouse >90.

**Tasks:**
- JSON-LD schema markup: Product, BreadcrumbList, LocalBusiness, Organization
- Open Graph meta tags đầy đủ cho tất cả pages
- robots.txt + sitemap.ts update (thêm orders/cart nếu cần)
- Lighthouse audit → target >90 tất cả metrics
- next/image optimization: lazy loading, sizes, priority
- Bundle analysis + code splitting nếu cần

---

## 3. Thông tin dự án hiện tại (inventory)

### Database Models (53 → target ~25-30)

| Prefix | Danh mục | Models | Status |
|--------|----------|--------|--------|
| (none) | Gạch ốp lát | 11 (products, collections, pattern_types, sizes, surfaces, colors, locations, origins, product_images, product_colors, product_locations) | Active |
| tbvs_  | TB Vệ sinh | 8 (products, brands, product_types, subtypes, materials, technologies, product_images, product_technologies) | Active |
| bep_   | TB Bếp | 6 (products, brands, product_types, subtypes, product_images) | Active |
| nuoc_  | Vật liệu nước | 7 (products, brands, product_types, subtypes, materials, product_images) | Active |
| sango_ | Sàn gỗ | 3 (products, product_types, product_images) | Active |
| blog_  | Blog | 4 (posts, categories, tags, post_tags) | Active |
| dien_  | Điện | 5 (products, brands, product_types, subtypes, product_images) | XÓA |
| khoa_  | Khóa | 5 (products, brands, product_types, subtypes, product_images) | XÓA |
| (none) | Chung | 4 (banners, partners, projects, quote_requests, redirects) | Active |

### Server Actions & API Files (16 files)

| File | Entity | Lines |
|------|--------|-------|
| actions.ts | Gạch ốp lát (CRUD) | 18,560 |
| public-api.ts | Gạch ốp lát (public) | 14,320 |
| tbvs-actions.ts | TB Vệ sinh | 7,335 |
| public-api-tbvs.ts | TB Vệ sinh | 4,366 |
| bep-actions.ts | TB Bếp | 6,480 |
| public-api-bep.ts | TB Bếp | 3,419 |
| nuoc-actions.ts | Vật liệu nước | 7,031 |
| public-api-nuoc.ts | Vật liệu nước | 4,082 |
| sango-actions.ts | Sàn gỗ | 6,984 |
| public-api-sango.ts | Sàn gỗ | 3,440 |
| blog-actions.ts | Blog | 7,856 |
| public-api-blog.ts | Blog | 3,466 |
| partner-actions.ts | Partners | 2,643 |
| public-api-partners.ts | Partners | 323 |
| project-actions.ts | Projects | 2,797 |
| public-api-projects.ts | Projects | 539 |

### Components (~40+ files)

| Folder | Components |
|--------|------------|
| ui/ | shadcn/ui base + ImageUploader + RichTextEditor |
| layout/ | Header, Footer, FloatingContact |
| home/ | HeroBanner, FeaturedTabs, BlogSection, BrandSlider, CategoryListing, MegaMenu, StatsBar, ValuesSection (~14 files) |
| category/ | SmartFilter, CollectionCarousel, CategorySidebar, FilterDrawer, SubCategoryGrid (~8 files) |
| product/ | ProductImageGallery, ProductDetailTabs |
| blog/ | PostCard, TOC |
| quote/ | QuoteForm components |

### Pages (routes)

| Route | Type | Status |
|-------|------|--------|
| / | Homepage | Done |
| /gach-op-lat/* | Category + Detail | Done |
| /thiet-bi-ve-sinh/* | Category + Detail | Done |
| /thiet-bi-bep/* | Category + Detail | Done |
| /vat-lieu-nuoc/* | Category + Detail | Done |
| /san-go/* | Category + Detail | Done |
| /blog/* | Blog listing + Post | Done |
| /doi-tac | Partners | Done |
| /du-an | Projects | Done |
| /ve-chung-toi | About Us | Done |
| /admin/* | CMS (14 modules) | Done |
| /gio-hang | Cart | **NEW** |
| /dat-hang | Checkout | **NEW** |
| /xac-nhan-don-hang/[id] | Order confirmation | **NEW** |
| /tra-cuu-don-hang | Order lookup (optional) | **NEW** |
| /admin/orders/* | Order management | **NEW** |

### Data Sources

| Source | Type | Products | Status |
|--------|------|----------|--------|
| TDM (tdm.vn) | JSON crawl | ~3,787 | Chưa import production |
| Vietceramics | HTML crawl | ~unknown | Ảnh hotlink bị 400 |
| Manual (admin) | CMS input | Seed data | OK |

---

## 4. Timeline — 2 tháng (29/03 → 31/05/2026)

### Sprint 1: Foundation (29/03 → 12/04) — 2 tuần
**Goal:** Dọn nền tảng, audit DB, chuẩn bị cho redesign.

| # | Task | Owner | Priority | Depends |
|---|------|-------|----------|---------|
| 1.1 | Codebase cleanup: gộp .agent/.agents/.claude → .dpg/, xóa file thừa | Claude Code | P0 | — |
| 1.2 | DB Audit: phân tích 53 models, đề xuất schema mới | Claude Code | P0 | — |
| 1.3 | Xóa dien_*/khoa_* khỏi DB + Prisma schema | Claude Code | P0 | — |
| 1.4 | Deploy Vercel production (LEO-277) | PM + Claude Code | P0 | — |
| 1.5 | DNS & SSL (LEO-278) | PM | P0 | 1.4 |
| 1.6 | Thu thập reference sites cho design | PM | P1 | — |

**Deliverable:** Codebase sạch, DB audit report, production live.

### Sprint 2: Database + Design (13/04 → 26/04) — 2 tuần
**Goal:** Restructure DB theo audit, bắt đầu design system mới.

| # | Task | Owner | Priority | Depends |
|---|------|-------|----------|---------|
| 2.1 | DB restructure: implement schema mới | Claude Code | P0 | 1.2 |
| 2.2 | Data migration scripts + verify | Claude Code | P0 | 2.1 |
| 2.3 | Update Server Actions + Public API theo schema mới | Claude Code | P0 | 2.1 |
| 2.4 | Design system mới: tokens, palette, typography | Antigravity | P0 | 1.6 |
| 2.5 | Redesign base components (Button, Card, Input...) | Antigravity | P1 | 2.4 |
| 2.6 | Data cleanup: validate TDM products | Claude Code | P1 | — |

**Deliverable:** DB mới hoạt động, design system tokens ready.

### Sprint 3: Cart + Redesign (27/04 → 10/05) — 2 tuần
**Goal:** Build cart/checkout, redesign main pages.

| # | Task | Owner | Priority | Depends |
|---|------|-------|----------|---------|
| 3.1 | Backend: orders schema + order-actions.ts | Claude Code | P0 | 2.1 |
| 3.2 | Backend: Admin order management CMS | Claude Code | P0 | 3.1 |
| 3.3 | Frontend: Cart page + Checkout flow | Antigravity | P0 | 3.1, 2.5 |
| 3.4 | Frontend: Order confirmation + QR transfer | Antigravity | P0 | 3.3 |
| 3.5 | Redesign Homepage + Category pages | Antigravity | P1 | 2.5 |
| 3.6 | Redesign Product detail + Blog pages | Antigravity | P1 | 2.5 |
| 3.7 | Data import: TDM products vào production | Claude Code | P1 | 2.6, 2.1 |

**Deliverable:** Cart/checkout working, pages redesigned.

### Sprint 4: Polish & Launch (11/05 → 31/05) — 3 tuần
**Goal:** SEO, fix ảnh, blog content, test, polish.

| # | Task | Owner | Priority | Depends |
|---|------|-------|----------|---------|
| 4.1 | Fix ảnh crawler → Supabase Storage (LEO-279) | Claude Code | P0 | — |
| 4.2 | SEO: schema markup + Open Graph (LEO-286) | Claude Code | P0 | 3.5 |
| 4.3 | Mega dropdown menu (LEO-284) | Antigravity | P1 | 3.5 |
| 4.4 | Nhập nội dung Blog (LEO-287) | PM + Content | P1 | 3.6 |
| 4.5 | Responsive testing + cross-browser | Antigravity | P0 | 3.5, 3.6 |
| 4.6 | Lighthouse optimization → target >90 | Claude Code | P1 | 4.2 |
| 4.7 | E2E testing: full user flow (browse → cart → checkout) | PM + Agents | P0 | 3.4 |
| 4.8 | Final deploy + smoke test production | PM + Claude Code | P0 | all |

**Deliverable:** Website V2 live, fully tested, SEO optimized.

---

## 5. Dependencies & Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| DB restructure phức tạp hơn dự kiến | Delay Sprint 2-3 | Audit kỹ ở Sprint 1, có rollback plan |
| Reference sites chưa có → design bị delay | Delay Sprint 2 frontend | PM gửi reference trước 12/04 |
| Data migration mất data | Sản phẩm bị thiếu/sai | Backup trước migrate, verify script |
| QR bank transfer cần thông tin TK ngân hàng | Checkout không hoàn thiện | PM cung cấp info bank account trước Sprint 3 |
| Ảnh Vietceramics bị block hoàn toàn | Sản phẩm không có ảnh | Download batch + fallback placeholder |

---

## 6. Thông tin PM cần cung cấp

| Thông tin | Deadline | Cho Sprint |
|-----------|----------|------------|
| Reference sites cho design mới | 12/04/2026 | Sprint 2 |
| Thông tin tài khoản ngân hàng (tên, STK, ngân hàng) | 26/04/2026 | Sprint 3 |
| Nội dung blog (bài viết + hình ảnh) | 10/05/2026 | Sprint 4 |
| Logo mới (nếu có thay đổi) | 12/04/2026 | Sprint 2 |

---

## 7. Definition of Done (V2)

- [ ] Website live tại dongphugia.com.vn
- [ ] Design system mới áp dụng toàn bộ
- [ ] Database tinh gọn, không còn dien_*/khoa_*
- [ ] Giỏ hàng + checkout hoạt động end-to-end
- [ ] QR chuyển khoản hiển thị đúng
- [ ] ~3,787 sản phẩm imported, ảnh trên Supabase Storage
- [ ] SEO: Lighthouse >90, schema markup, Open Graph
- [ ] Codebase sạch: 1 folder agent, không file thừa
- [ ] Blog có nội dung thực (10+ bài)
- [ ] Responsive: mobile + tablet + desktop

---

## Next Steps

1. PM review & approve scope này
2. Cancel/archive 7 Linear issues cũ, tạo issues mới theo Sprint 1-4
3. Bắt đầu Sprint 1 (29/03): Codebase cleanup + DB audit + Deploy
