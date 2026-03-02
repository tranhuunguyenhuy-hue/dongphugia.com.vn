# KẾ HOẠCH MVP: TỐI ƯU HOMEPAGE, FOOTER & SEO (02/03/2026)

## 📌 Bối cảnh (Context)
- Tạm dừng (pause) module Thiết bị vệ sinh để đợi DB/Schema từ Claude Code.
   - [x] Tạo Schema `Product` ở trang chi tiết sản phẩm.
   - [x] Sửa sitemap pattern pages và thêm allow/disallow robots.txt.
   - [x] **Tninie Review**: Kiểm tra lại thẻ Semantic HTML (`h1`, `h2`, `nav`) cho Header, Footer, Trang chủ và trang Sản phẩm. Bổ sung `alt` text. (02/03/2026)
- Chuyển hướng tập trung: Hoàn thiện nốt phần UI của trang chủ (Homepage) và chân trang (Footer).
- Yêu cầu lõi 2: Củng cố nền tảng SEO (On-page SEO) cho MVP launch để đảm bảo crawl tốt cho các sản phẩm Gạch ốp lát.

---

## 🎯 Phân bổ Nhiệm vụ & Checklist (Task Breakdown)

### 1. Khu vực Frontend: Homepage & Footer (Tninie - Thiết kế)
**Homepage:**
- **Values Section**: Dựng 4 icons "Giao hàng, Chính hãng, Lắp đặt, Giá tốt" với gradient background đồng nhất.
- **Category Listing**: Update block danh mục (1 Gạch to + 4 danh mục nhỏ 2x2 grid) bằng ảnh có từ Figma.
- **Featured Products**: Verify & tối ưu UI khoảng cách của slider/grid hiển thị "Sản phẩm nổi bật".
- Tinh chỉnh spacing tổng thể, thêm animation mượt (AOS/Framer Motion tương tự phần Gạch), đổ bóng nhẹ (shadow) và tối ưu font-size giúp trang chủ Premium hơn.

**Footer:**
- Dựng giao diện bám sát thiết kế Figma: Logo, Cột thông tin liên hệ, Các link CSKH/Chính sách, Cột Bản đồ/Mã số thuế.
- Setup layout responsive cho Footer hiển thị thành dạng accordion/stack dọc khi xem trên Mobile.

---

### 2. Khu vực Architecture & SEO Foundation (Claude Code & Tninie phối hợp)
Giải quyết nỗi lo về SEO, chúng ta cần đảm bảo Technical SEO của Next.js App Router đạt chuẩn.

**Tasks Cấu Hình / Dữ liệu (Claude Code):** ✅ HOÀN THÀNH (02/03/2026)
1. **Dynamic Meta Tags** ✅ — Tất cả trang đã có metadata:
   - `src/app/layout.tsx`: `metadataBase` + `title.template = '%s | Đông Phú Gia'`
   - `/` (Homepage): `export const metadata` với title, description, keywords
   - `/gach-op-lat`: `metadata` cập nhật — title chuẩn hoá + description tốt hơn
   - `/[patternSlug]/[productSlug]`: `generateMetadata` động — title từ `seo_title || product.name`, description 160 ký tự
2. **Open Graph & Twitter Cards** ✅ — Đã bổ sung:
   - Homepage + `/gach-op-lat`: OGP với `image: /images/hero-banner.jpg`
   - Product detail: OGP + Twitter card với `image_main_url` từ DB
3. **Structured Data (JSON-LD)** ✅ — Đã inject vào product detail:
   - Schema `@type: Product` với name, sku, image, offers (price_display), countryOfOrigin
4. **Sitemap** ✅ — Đã sửa:
   - Pattern pages: canonical URL dùng `?pattern=[slug]` thay vì redirect path
   - Product pages: priority nâng lên 0.7 (từ 0.6)
   - **Robots.txt** ✅: Thêm `Disallow: /api/`
   - Build PASS: 21 pages, 0 errors

**Tasks Tối Ưu Hình Thức (Tninie):** ✅ HOÀN THÀNH (02/03/2026)
- [x] **Semantic HTML**: Review thẻ Heading (H1-H3) tại Homepage, Footer và Product Detail (Chỉ 1 thẻ H1 duy nhất trên trang). Đã bổ sung `h1.sr-only` cho Homepage và `nav aria-label` cho Footer/Breadcrumbs.
- [x] **Alt Text Hình Ảnh**: Đảm bảo các component `<Image>` render từ dữ liệu DB đều có `alt` text thay thế mô tả chân thực sản phẩm/danh mục để bọ Google dễ cào. (Ví dụ: `alt={`Mẫu vân ${pt.name}`}`).
- [x] **Internal Links**: Đảm bảo thanh điều hướng ở Header và Footer trỏ đúng URL danh mục giúp bots crawl dễ dàng hơn.

---

## 🚀 Trình tự thực thi (Next Actions)

1. Tninie (tôi) đảm nhận xây dựng **Homepage (Sections còn thiếu)** và **Footer** ngay trong lượt này.
2. Bạn có thể sử dụng `@Claude` thực thi **Thiết lập chuẩn SEO (Meta, OGP, Sitemap, Schema)**.
3. Chạy report Lighthouse kiểm tra Core Web Vitals (Performance, Accessibility, Best Practices, SEO).
