# PRD — Đông Phú Gia Website V2
> **Dự án:** dongphugia.com.vn — E-Commerce Showcase VLXD
> **Phiên bản:** 2.0
> **Ngày:** 06/04/2026 (cập nhật 07/04/2026)
> **PM:** Nguyen Huy
> **Status:** Draft — Chuẩn bị wireframe redesign

---

## Executive Summary

Đông Phú Gia là đại lý VLXD tại Đà Lạt cần website showcase sản phẩm chuyên nghiệp phục vụ khách hàng B2C (gia đình xây/sửa nhà) và B2B (thầu xây dựng, nội thất). Website **không có giỏ hàng truyền thống** — thay bằng hệ thống Báo giá (quote request) và Đặt hàng đơn giản (checkout cơ bản với thanh toán VietQR). V2 tập trung vào 3 trụ cột: **DB thống nhất**, **giao diện chuyên nghiệp**, và **luồng chuyển đổi rõ ràng từ browse → báo giá/đặt hàng**.

---

## 1. Problem Statement

Website hiện tại (V1) có cấu trúc database phân mảnh (53 bảng riêng biệt cho từng danh mục), giao diện chưa tạo được cảm giác tin cậy cho sản phẩm VLXD cao cấp, và không có luồng mua hàng rõ ràng. Hậu quả: khách vào xem rồi thoát mà không có cách liên hệ hoặc đặt hàng thuận tiện — dẫn đến tỷ lệ chuyển đổi thấp và phụ thuộc vào Zalo/điện thoại thủ công.

**Đối tượng bị ảnh hưởng:**
- Khách hàng B2C đang xây/sửa nhà cần tìm thiết bị vệ sinh, bếp, vật liệu nước
- Khách hàng B2B (nhà thầu, công ty nội thất) cần báo giá nhanh số lượng lớn
- Admin Đông Phú Gia cần quản lý sản phẩm và đơn hàng hiệu quả

---

## 2. Goals

| # | Goal | Metric | Target |
|---|------|--------|--------|
| G1 | Khách hàng tìm được sản phẩm đúng nhu cầu | % khách xem ≥ 3 SP / session | ≥ 40% |
| G2 | Tăng chuyển đổi thành báo giá hoặc đặt hàng | Tỷ lệ click CTA (Báo giá / Đặt hàng) | ≥ 5% session |
| G3 | Giao diện tạo cảm giác chuyên nghiệp & tin cậy | Lighthouse Performance score | ≥ 90 |
| G4 | Admin quản lý 5,259 SP + đơn hàng không cần dev | Thời gian onboard admin mới | ≤ 30 phút |
| G5 | Website được index tốt trên Google | Số từ khóa VLXD Đà Lạt vào top 10 | ≥ 20 từ khóa |

---

## 3. Non-Goals

| Non-Goal | Lý do |
|----------|-------|
| Thanh toán online trực tiếp (VNPAY, Momo gateway) | Phức tạp, cần tài khoản merchant — V2 dùng VietQR chuyển khoản thủ công |
| Tài khoản người dùng / lịch sử đơn hàng | Không đủ traffic để justify — V2 dùng order number tra cứu |
| Live chat / chatbot | Dùng Zalo floating button đã có |
| Tìm kiếm full-text nâng cao | Cancelled Sprint 2 — xem xét Sprint 5+ |
| Gạch ốp lát + Sàn gỗ data import | Nguồn data chưa xác định — xử lý sau Sprint 2 |
| Mobile app | Ngoài scope hoàn toàn |

---

## 4. User Personas & Stories

### Persona A — Chủ nhà đang xây/sửa nhà (B2C)

> Huy, 38 tuổi, xây nhà ở Đà Lạt, cần mua bồn cầu + lavabo + sen tắm TOTO. Không am hiểu kỹ thuật, chọn theo thương hiệu và giá. Hay dùng điện thoại.

**User Stories:**

- **A1.** Là chủ nhà, tôi muốn xem danh sách sản phẩm theo danh mục để tìm thiết bị vệ sinh phù hợp với căn phòng tắm của tôi.
- **A2.** Là chủ nhà, tôi muốn lọc sản phẩm theo thương hiệu và khoảng giá để không mất thời gian xem những sản phẩm ngoài ngân sách.
- **A3.** Là chủ nhà, tôi muốn xem ảnh gallery rõ nét và thông số kỹ thuật của sản phẩm để tự tin trước khi liên hệ.
- **A4.** Là chủ nhà, tôi muốn gửi yêu cầu báo giá cho nhiều sản phẩm cùng lúc để nhận báo giá tổng hợp từ cửa hàng.
- **A5.** Là chủ nhà, tôi muốn đặt hàng và thanh toán chuyển khoản để xác nhận đơn mà không cần ra tận cửa hàng.

### Persona B — Nhà thầu / Công ty nội thất (B2B)

> Minh, 45 tuổi, chủ thầu xây dựng, cần mua thiết bị cho 5 căn hộ. Cần báo giá nhanh, đơn giản, giao nhiều.

**User Stories:**

- **B1.** Là nhà thầu, tôi muốn tìm nhanh sản phẩm theo tên/SKU để tiết kiệm thời gian.
- **B2.** Là nhà thầu, tôi muốn thêm nhiều sản phẩm vào giỏ và gửi báo giá tổng để nhận được chiết khấu số lượng lớn.
- **B3.** Là nhà thầu, tôi muốn thấy thông tin đại lý (địa chỉ, SĐT, email) rõ ràng để liên hệ trực tiếp khi cần.

### Persona C — Admin Đông Phú Gia

> Nhân viên nội bộ quản lý sản phẩm, cập nhật giá, xem đơn hàng.

**User Stories:**

- **C1.** Là admin, tôi muốn thêm/sửa/xóa sản phẩm từ giao diện CMS mà không cần biết code.
- **C2.** Là admin, tôi muốn xem và cập nhật trạng thái đơn hàng để theo dõi tiến độ xử lý.
- **C3.** Là admin, tôi muốn quản lý banner trang chủ để cập nhật khuyến mãi theo mùa.
- **C4.** Là admin, tôi muốn xem danh sách yêu cầu báo giá theo ngày để phản hồi kịp thời.

---

## 5. Information Architecture & User Flows

### 5.1 Cấu trúc URL

```
dongphugia.com.vn/
├── /                              → Homepage
├── /thiet-bi-ve-sinh/             → Category: TB Vệ Sinh (4,477 SP)
│   ├── /thiet-bi-ve-sinh/bon-cau/ → Subcategory: Bồn Cầu (959 SP)
│   └── /thiet-bi-ve-sinh/[slug]   → Product Detail
├── /thiet-bi-bep/                 → Category: TB Bếp (597 SP)
│   └── /thiet-bi-bep/[slug]
├── /vat-lieu-nuoc/                → Category: Vật Liệu Nước (185 SP)
│   └── /vat-lieu-nuoc/[slug]
├── /gach-op-lat/                  → Coming Soon
├── /san-go/                       → Coming Soon
├── /thuong-hieu/[slug]            → Brand Page (cross-category)
├── /bao-gia/                      → Giỏ báo giá (quote cart)
├── /dat-hang/                     → Checkout
├── /don-hang/[orderNumber]        → Order lookup
├── /blog/                         → Blog VLXD
├── /du-an/                        → Dự án thực tế
├── /doi-tac/                      → Đối tác thương hiệu
└── /ve-chung-toi/                 → About
```

### 5.2 User Flow chính — Browse → Đặt hàng

```
Homepage
  ↓ Click category hoặc featured product
Category Page (/thiet-bi-ve-sinh)
  ↓ Filter (brand, giá, subcategory)
  ↓ Click sản phẩm
Product Detail
  ↓ Xem ảnh gallery, specs, features
  ↓ [Thêm vào giỏ] hoặc [Yêu cầu báo giá]
        ↓                      ↓
  Cart Page              Quote Request Form
  ↓ Checkout             ↓ Submit → Email/Zalo
  ↓ Nhập thông tin
  ↓ Xem QR VietQR
  ↓ Chuyển khoản
  ↓ Xác nhận đơn hàng
  Order Confirmation Page (/don-hang/DPG20260406xxxx)
```

### 5.3 User Flow phụ — Admin

```
/admin/login
  ↓
/admin (Dashboard)
  ├── /admin/products     → List + search + filter
  │   ├── /admin/products/new
  │   └── /admin/products/[id]
  ├── /admin/orders       → List đơn hàng, filter by status
  │   └── /admin/orders/[id]  → Update status, confirm payment
  ├── /admin/quote-requests → Xem yêu cầu báo giá
  ├── /admin/brands
  ├── /admin/blog
  ├── /admin/banners
  └── /admin/partners
```

---

## 6. Feature Requirements

### 6.1 Homepage — P0 (Must Have)

| ID | Feature | Acceptance Criteria |
|----|---------|---------------------|
| HP-1 | Hero Banner (carousel) | Hiển thị 2-3 banners, autoplay 5s, CTA button dẫn đến category |
| HP-2 | 3 Category Cards | TBVS / Bếp / Nước — click → category page. Gạch + Sàn gỗ ẩn hoặc "Coming soon" |
| HP-3 | Featured Products Grid | 4 SP/category, is_featured=true, hiển thị ảnh + tên + giá + badge "Mới" / "Bán chạy" nếu is_new/is_bestseller=true |
| HP-4 | Brand Showcase | Logo 8-10 thương hiệu nổi bật, click → brand page |
| HP-5 | Floating CTA | Zalo + Phone button fixed bottom-right, luôn hiển thị |
| HP-6 | Stats Section | "X+ sản phẩm", "Y+ thương hiệu", "Z+ dự án" — lấy dynamic từ DB |

### 6.2 Category Page — P0 (Must Have)

| ID | Feature | Acceptance Criteria |
|----|---------|---------------------|
| CAT-1 | Subcategory tabs/chips | Lọc theo subcategory không reload trang |
| CAT-2 | Sidebar filter — Brand | Multi-select, dynamic từ brands table theo category |
| CAT-2b | Sidebar filter — Màu / Chất liệu / Xuất xứ | Select đơn, load từ `colors`, `materials`, `origins` — chỉ hiển thị khi subcategory có sản phẩm với field đó |
| CAT-3 | Sidebar filter — Giá | Range slider min-max, step 500k |
| CAT-4 | Sidebar filter — Subcategory-specific | Load từ filter_definitions theo subcategory đang chọn |
| CAT-5 | Product Grid | 20 SP/trang, ảnh + tên + brand + giá + badge "Mới"/"Bán chạy", responsive 2-3-4 cols |
| CAT-6 | Sort | Mới nhất / Giá tăng / Giá giảm / Nổi bật / Bán chạy |
| CAT-7 | Pagination hoặc Infinite scroll | UX mượt trên mobile |
| CAT-8 | Active filter chips | Hiển thị filters đang chọn, click để xóa |
| CAT-9 | Filter trên mobile | Drawer/modal kéo lên từ bottom |
| CAT-10 | Feature icon filter | Row icon filters (Smart, Tiết kiệm nước...) kiểu Hita |

### 6.3 Product Detail — P0 (Must Have)

| ID | Feature | Acceptance Criteria |
|----|---------|---------------------|
| PD-1 | Image Gallery | Ảnh chính lớn + thumbnail strip, zoom on hover, lightbox khi click |
| PD-2 | Product info | Tên, brand, SKU, giá (hoặc "Liên hệ báo giá"), stock_status, badge "Mới" / "Bán chạy" nếu is_new/is_bestseller=true |
| PD-2b | Product meta | Xuất xứ (origin), Màu sắc (color), Chất liệu (material), Bảo hành (warranty_months) — hiển thị dưới dạng tag/chip nếu có |
| PD-3 | Specs tabs | "Thông số kỹ thuật" tab hiển thị specs JSONB dưới dạng table |
| PD-4 | Feature badges | Icon badges (Smart, Nắp êm, Tiết kiệm nước...) |
| PD-5 | CTA — Thêm vào giỏ | Button thêm vào cart (quantity input) |
| PD-6 | CTA — Yêu cầu báo giá | Button mở modal quote request form |
| PD-7 | Breadcrumb | Home > Category > Subcategory > Sản phẩm |
| PD-8 | Related products | 4 SP cùng subcategory, cùng brand ưu tiên |
| PD-9 | Share | Copy link / Zalo share |

### 6.4 Cart & Checkout — P0 (Must Have)

| ID | Feature | Acceptance Criteria |
|----|---------|---------------------|
| CART-1 | Cart page | List SP, quantity editable, subtotal, xóa SP |
| CART-2 | Cart persistence | LocalStorage — giữ cart khi refresh |
| CART-3 | Cart icon header | Badge số lượng SP trong cart |
| CART-4 | Checkout form | Họ tên, SĐT, địa chỉ giao hàng, ghi chú |
| CART-5 | Order summary | List SP, tổng tiền, phí ship (TBD) |
| CART-6 | VietQR payment | Hiển thị QR code chuyển khoản ngân hàng ĐPG, tự động điền số tiền + nội dung |
| CART-7 | Order confirmation | Trang xác nhận với order number DPGYYYYMMDDxxxx |
| CART-8 | Order lookup | /don-hang/[orderNumber] tra cứu trạng thái đơn |
| CART-9 | Email notification | Gửi email xác nhận đơn cho khách (nếu có email) |

### 6.5 Quote Request — P0 (Must Have)

| ID | Feature | Acceptance Criteria |
|----|---------|---------------------|
| QR-1 | Quote button trên Product Detail | Mở form modal |
| QR-2 | Multi-product quote | Thêm nhiều SP vào "quote list" rồi gửi 1 lần |
| QR-3 | Form fields | Họ tên, SĐT, dự án (optional), ghi chú |
| QR-4 | Lưu vào DB | quote_requests table, hiển thị trong /admin/quote-requests |
| QR-5 | Notification | Email/Zalo notification đến admin khi có request mới |

### 6.6 Admin CMS — P0 (Must Have)

| ID | Feature | Acceptance Criteria |
|----|---------|---------------------|
| ADM-1 | Products CRUD | Tạo/sửa/xóa SP, upload ảnh, chọn category/subcategory/brand |
| ADM-2 | Orders management | List, filter by status, update status, confirm payment |
| ADM-3 | Quote requests | List, mark as contacted/done |
| ADM-4 | Brands CRUD | Tạo/sửa brand, upload logo |
| ADM-5 | Banners | Upload + sắp xếp banners homepage |
| ADM-6 | Blog | Tạo/sửa bài viết, upload ảnh, publish/draft |

### 6.7 Brand Pages — P1 (Nice to Have)

| ID | Feature | Acceptance Criteria |
|----|---------|---------------------|
| BR-1 | Brand landing page | /thuong-hieu/toto → list tất cả SP của TOTO cross-category |
| BR-2 | Brand info | Logo, xuất xứ, mô tả ngắn |
| BR-3 | Brand grid | Trang /thuong-hieu/ list tất cả brands |

### 6.8 SEO — P1 (Nice to Have, Sprint 4)

| ID | Feature | Acceptance Criteria |
|----|---------|---------------------|
| SEO-1 | JSON-LD Product schema | Product, BreadcrumbList, LocalBusiness |
| SEO-2 | Open Graph + meta tags | Mỗi trang có og:image, og:title, description |
| SEO-3 | Sitemap.xml | Dynamic, cover tất cả SP + categories |
| SEO-4 | robots.txt | Block /admin, allow tất cả trang public |

### 6.9 Performance — P1 (Nice to Have)

| ID | Feature | Acceptance Criteria |
|----|---------|---------------------|
| PERF-1 | ISR caching | revalidate: 3600 cho tất cả public pages |
| PERF-2 | Image optimization | Next.js Image component, WebP, lazy loading |
| PERF-3 | Lighthouse score | ≥ 90 Performance, ≥ 90 SEO |

---

## 7. Design Requirements

### 7.1 Design System (LEO-328 — Sprint 2)

**Color Palette — cần PM confirm:**
- Primary: `#16a34a` (green-600) — màu hiện tại, xem xét giữ hay đổi
- Accent: TBD — cần reference sites từ PM
- Neutral: `#0f172a` (dark), `#f8fafc` (light bg)
- Semantic: Success `#16a34a`, Warning `#f59e0b`, Destructive `#ef4444`

**Typography:**
- Heading: Be Vietnam Pro hoặc Inter — bold, clean
- Body: Inter — 14-16px, line-height 1.6
- Mono: Cho specs/SKU

**Tone:**
- Chuyên nghiệp, không quá corporate
- Cảm giác như showroom cao cấp (Hita, Cera, Việt Ý)
- Ảnh sản phẩm là trung tâm — UI phục vụ ảnh

### 7.2 Responsive Breakpoints

| Breakpoint | Width | Layout chính |
|-----------|-------|--------------|
| Mobile | < 768px | 1 cột, filter drawer |
| Tablet | 768-1024px | 2 cột product grid |
| Desktop | > 1024px | Sidebar filter + 3-4 cột grid |

### 7.3 Component Priority cho Wireframe

Thứ tự vẽ wireframe (từ cao đến thấp):

1. **Header + Navigation** — Logo, mega menu categories, search bar, cart icon
2. **Homepage** — Hero, category cards, featured grid, brands
3. **Category Page** — Sidebar filter + product grid + subcategory chips
4. **Product Detail** — Gallery + info + CTA + specs tabs
5. **Cart + Checkout** — Cart page + checkout form + VietQR
6. **Mobile flows** — Filter drawer, mobile product detail

---

## 8. Technical Context (cho Wireframe Reference)

> Không phải yêu cầu thiết kế — chỉ để designer hiểu constraints.

- **Framework:** Next.js 16, React 19 — Server Components
- **Styling:** Tailwind CSS v4 — utility-first, không cần custom classes phức tạp
- **UI Library:** shadcn/ui (Radix UI) — có sẵn: Dialog, Drawer, Slider, Select, Tabs...
- **Icons:** Lucide React — stroke-based, clean
- **Database:** 5,259 sản phẩm, filter dynamic từ DB, ISR cache 1 giờ
- **Images:** Hosted trên **Bunny CDN** (`cdn.dongphugia.com.vn`) — mirrored từ nguồn gốc, URL cố định theo pattern `/products/{category}/{brand}/{slug}/{filename}`

**Constraints quan trọng cho designer:**
- Filter sidebar phải load từ DB (dynamic, không hardcode)
- Specs hiển thị từ JSONB — mỗi subcategory có fields khác nhau
- Giá có thể là số (hiển thị VNĐ) hoặc null (hiển thị "Liên hệ báo giá")
- Cart state là client-side (localStorage) — không cần auth

---

## 9. Success Metrics

### Leading Indicators (thấy trong 2-4 tuần)
- Bounce rate giảm < 60%
- Avg session duration tăng > 2 phút
- Pages per session > 3
- Filter usage rate > 30%

### Lagging Indicators (thấy trong 1-3 tháng)
- Quote request submissions: ≥ 10/tuần
- Orders: ≥ 5/tuần
- Google organic traffic: +50% vs V1
- Top 10 Google: ≥ 20 từ khóa VLXD Đà Lạt

---

## 10. Open Questions

| # | Câu hỏi | Owner | Deadline | Blocks |
|---|---------|-------|----------|--------|
| OQ-1 | Design reference sites cho color palette? (VLXD, showroom cao cấp VN) | **PM (Huy)** | 12/04 | Wireframe, LEO-343 |
| OQ-2 | Tài khoản ngân hàng ĐPG cho VietQR (tên, STK, ngân hàng)? | **PM (Huy)** | 26/04 | CART-6 |
| OQ-3 | Phí giao hàng: cố định, theo km, hay miễn phí? | **PM (Huy)** | 26/04 | CART-5, Checkout UI |
| OQ-4 | Có cần trang tra cứu đơn hàng public (/don-hang/[number]) không? | **PM (Huy)** | 26/04 | CART-8 |
| OQ-5 | Brand page (/thuong-hieu/toto) có cần trong V2 không? | **PM (Huy)** | 15/04 | BR-1, Navigation |
| OQ-6 | Header navigation: Mega menu hay dropdown đơn giản? | **PM (Huy) + Design** | 12/04 | Header wireframe |
| OQ-7 | Filter specs per subcategory đã approve chưa? (xem LEO-370 filter_definitions config) | **PM (Huy)** | 19/04 | CAT-4, Bước 2 LEO-370 |

---

## 11. Timeline

| Phase | Nội dung | Deadline | Status |
|-------|---------|----------|--------|
| **Sprint 2** | DB Restructure (LEO-366) + Design System Tokens | 26/04 | 🔄 In Progress |
| ↳ Phase 4 | Data import 5,259 SP | 26/04 | 🔄 Antigravity đang làm |
| ↳ LEO-343-345 | Color palette + Design tokens + Base components | 22/04 | ⏳ Chờ PM confirm colors |
| **Sprint 3** | Cart/Checkout + Page Redesign | 10/05 | 📋 Planned |
| ↳ Cart & Checkout | Backend orders + Frontend cart + VietQR | 10/05 | Blocked by LEO-366 |
| ↳ LEO-349-352 | Homepage + Category + Product Detail + About redesign | 10/05 | Blocked by Design System |
| **Sprint 4** | SEO + Content + Testing + Launch | 31/05 | 📋 Planned |
| ↳ LEO-353-359 | JSON-LD + OG + Sitemap + Blog + E2E + Lighthouse + Deploy | 31/05 | Blocked by Sprint 3 |

---

## 12. Appendix — Data Layer Reference cho Wireframe

> Designer cần hiểu những lớp data này để wireframe đúng.

### Một sản phẩm gồm 6 lớp:

```
[1] Taxonomy      categories → subcategories
                  Vd: "Thiết Bị Vệ Sinh" → "Bồn Cầu"

[2] Core          products (sku, name, slug, price, description,
                  is_active, is_featured, is_new, is_bestseller,
                  warranty_months)
                  Badge rules:
                    is_new=true       → Badge "Mới" (xanh lá)
                    is_bestseller=true → Badge "Bán chạy" (cam)
                    is_featured=true  → ưu tiên xuất hiện trên Homepage

[3] Lookup FKs    brand_id  → brands      (tên, logo, slug)
                  origin_id → origins     (Nhật Bản, Thái Lan...)
                  color_id  → colors      (Trắng, Đen, Crom...)
                  material_id → materials (Sứ, Inox 304...)
                  Tất cả 4 FKs đều có thể là NULL (không bắt buộc)
                  Hiển thị: tag/chip trong PD-2b, filter trong CAT-2b

[4] Flexible specs JSONB  { kieu_xa, loai_nap, kich_thuoc, cong_nghe... }
                  Mỗi subcategory có fields riêng
                  Cũng chứa: documents (PDF/CAD links), warranty_text

[5] Media         product_images (image_type: 'main' | 'gallery')
                  URL pattern: cdn.dongphugia.com.vn/products/{cat}/{brand}/{slug}/{file}

[6] Feature tags  product_feature_values → product_features
                  Smart, Nắp êm, Tiết kiệm nước, CeFiONtect...
                  Hiển thị: icon row trên PD-4, filter row trên CAT-10
```

### Filter sidebar hoạt động thế nào:

```
User vào /thiet-bi-ve-sinh
  → Load filter_definitions WHERE category_id = 1 (TBVS)
  → Hiển thị: Thương hiệu (multi), Khoảng giá (range), Chất liệu (select)

User chọn subcategory "Bồn Cầu"
  → Load thêm filter_definitions WHERE subcategory_id = bon-cau
  → Hiển thị thêm: Kiểu xả, Kiểu thoát, Loại nắp
```

### Giá hiển thị logic:

```
products.price = 5,348,800  → Hiển thị: "5.348.800 ₫"
products.price = null       → Hiển thị: "Liên hệ báo giá"
products.price_display != null → Ưu tiên hiển thị price_display
```
