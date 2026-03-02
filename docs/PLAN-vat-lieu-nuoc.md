# PLAN: Frontend Vật Liệu Nước (NUOC)

## 1. Phân tích ngữ cảnh (Context)
Claude Code đã hoàn thành 100% Backend cho danh mục **Vật liệu nước** (bao gồm Schema, Seed Data, Admin CMS, và 5 public API cache).
API có sẵn: `getNuocTypes`, `getNuocBrands`, `getNuocMaterials`, `getNuocProducts`, `getNuocProductBySlug`, `getRelatedNuocProducts`.
Nhiệm vụ của Antigravity là xây dựng Frontend UI cho danh mục này bám sát chuẩn của Thiết bị Vệ sinh & Thiết bị Bếp trước đó.

## 2. Nhiệm vụ chia nhỏ (Task Breakdown)
*Thực thi theo thứ tự sau:*

- [ ] **Task 2.1: Khởi tạo các Component bộ lọc (Category Components)**
  - `SmartFilterNuoc`: Component Sidebar lọc theo Thương hiệu, Kiểu dáng, Chất liệu.
  - `BrandCarouselNuoc`: Component Carousel các thương hiệu ngành nước.
  - `FilterDrawerNuoc`: Drawer dùng cho Mobile/Tablet.

- [ ] **Task 2.2: Xây dựng trang Danh sách sản phẩm (Category Listing)**
  - Route: `src/app/(public)/vat-lieu-nuoc/page.tsx`
  - Fetch song song `getNuocTypes`, `getNuocProducts`, `getNuocBrands`.
  - Hiển thị layout 4 cột, gắn Component Card và Pagination/bộ lọc.

- [ ] **Task 2.3: Khởi tạo Component Chi tiết sản phẩm**
  - `ProductDetailTabsNuoc`: Tabs hiển thị Thông tin chung, Tính năng, và Bảng thông số kỹ thuật.
  - `QuoteForm`: Tái sử dụng form Báo giá (truyền ID và tên sản phẩm).

- [ ] **Task 2.4: Xây dựng trang Chi tiết sản phẩm (Product Detail)**
  - Route: `src/app/(public)/vat-lieu-nuoc/[typeSlug]/[productSlug]/page.tsx`
  - Fetch `getNuocProductBySlug` và `getRelatedNuocProducts`.
  - Dựng UI gồm Breadcrumbs, Image Gallery, Khối giá/Liên hệ, Tabs thông số, Form Báo giá và Sản phẩm liên quan.
  - Viết `generateMetadata` cho SEO và chèn `JSON-LD` Schema.

- [ ] **Task 2.5: Cập nhật điều hướng & Trạng thái**
  - Đảm bảo Navbar header trỏ đúng link `/vat-lieu-nuoc`.
  - Check-in `PROJECT-STATUS.md` và `PLAN-website-completion.md` khi xong.

## 3. Phân công (Agent Assignments)
- **Executor:** Tninie (Antigravity Agent)
- **Mode:** EXECUTION (Chạy lệnh `/create` hoặc tự động bắt đầu code).

## 4. Xác minh (Verification Checklist)
- [ ] Build không có lỗi SSR/Client mismatch.
- [ ] Bộ lọc trên Desktop và Drawer trên Mobile hoạt động tốt.
- [ ] Truyền đúng tham số `product_id` vào Form Báo Giá.
- [ ] Thử submit 1 Báo giá -> Kiểm tra bên CMS Admin xem có nhận không.
