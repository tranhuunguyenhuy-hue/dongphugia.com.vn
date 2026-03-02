# Kế Hoạch Triển Khai Danh Mục Thiết Bị Vệ Sinh (TBVS)

## 1. Phân Tích & Đánh Giá Mức Độ Hoàn Thiện Schema hiện tại
Dựa vào cấu trúc Database do Claude Code thiết lập (`schema.prisma`), mức độ hoàn thiện đạt **100% chuẩn mực** cho ngành hàng Thiết Bị Vệ Sinh.
*   **Phân cấp chuẩn xác**: Đã chia 2 lớp Loại (`tbvs_product_types`) -> Kiểu dáng (`tbvs_subtypes`) để dễ dàng tạo sidebar filter.
*   **Đặc tính chuyên sâu**: Tích hợp bảng `tbvs_technologies` (Công nghệ độc quyền như CeFiONtect, Aqua Ceramic) và `tbvs_materials` (Sứ, Đồng mạ...) rất quan trọng để sale ngành nước.
*   **Thuộc tính sản phẩm phong phú**: `tbvs_products` chứa JSON `specifications`, `warranty_months`, `features`, `is_new`, `is_bestseller` giúp Frontend có rất nhiều không gian để trình bày giao diện cao cấp.
*   **Seed data**: Claude Code báo cáo đã có 78 records mẫu, đủ để ngay lập tức code giao diện mà không bị trống.

---

## 2. Phân Công Nhiệm Vụ (Task Delegation)
Để tối ưu hóa thời gian triển khai, công việc sẽ được chạy **song song** giữa 2 Agent:

### 👨‍💻 Phần việc của Claude Code (Backend, API & Admin CMS) ✅ HOÀN THÀNH
**Tiêu điểm:** Xử lý Logic, Cấu trúc Dữ liệu và Bảng điều khiển Quản trị.
1. **[x] Public API Layer (`src/lib/public-api-tbvs.ts`)** — DONE (02/03/2026):
   - `getTBVSTypes()` — types + subtypes + product count, dùng `cache()`
   - `getTBVSProducts(filters)` — paginated, filter by type/subtype/brand
   - `getTBVSProductBySlug(slug)` — full relations (technologies, images, brand, material...)
   - `getRelatedTBVSProducts(typeId, excludeId, limit)` — same type, exclude current
2. **[x] Admin CMS** — DONE (02/03/2026):
   - `src/lib/tbvs-actions.ts` — createTBVSProduct, updateTBVSProduct, deleteTBVSProduct
   - `/admin/tbvs/products` — List page (filter by type, table view)
   - `/admin/tbvs/products/new` — Create form
   - `/admin/tbvs/products/[id]` — Edit form
   - Form: multi-select technologies (toggle buttons), JSON specifications (dynamic key-value editor), ImageUploader (main + additional + hover), dropdowns: type/subtype/brand/material/color/origin
   - Sidebar nav: thêm link "TB Vệ sinh" với icon ShowerHead
   - Build PASS: 26 pages, 0 errors

### 🎨 Phần việc của Tninie (Frontend Public, UI/UX & SEO) ✅ HOÀN THÀNH
**Tiêu điểm:** Giao diện người dùng đồng nhất 100% với Gạch ốp lát, tích hợp SEO sâu.
1. **[x] Cấu Trúc Route (App Router)**:
   - `src/app/(public)/thiet-bi-ve-sinh/page.tsx` (Trang chủ TBVS)
   - `src/app/(public)/thiet-bi-ve-sinh/[typeSlug]/page.tsx` (Trang Danh mục - vd: Bàn cầu)
   - `src/app/(public)/thiet-bi-ve-sinh/[typeSlug]/[productSlug]/page.tsx` (Trang Chi tiết)
2. **[x] Tái Thiết Kế & Đồng Nhất UI (Tái sử dụng Component)**:
   - Trang Danh sách: Tạo các Component lọc chuyên dụng (CategorySelectorTBVS, SmartFilterTBVS, FilterDrawerTBVS, BrandCarouselTBVS). Bind Data từ API.
   - Trang Chi tiết: Đã bind Layout trang chi tiết (`ProductImageGallery`, Box Liên hệ báo giá, `QuoteForm` fix path lỗi).
   - Mở rộng UI: Thêm `ProductDetailTabsTBVS` hỗ trợ parse bảng `specifications` (Dạng Key-value) và render danh sách công nghệ (`technologies`).
3. **[x] Cập nhật Nav & Homepage**:
   - Unlock các thẻ `<Link>` đang bị disable chữ "Sắp có" ở Header, Footer, Homepage's Category Listing (Đã mở).
4. **[x] Tối ưu SEO**:
   - Bổ sung `generateMetadata` tạo thẻ tiêu đề, mô tả tĩnh cho TBVS (Hoàn tất).
   - Đổ Schema JSON-LD `Product` cho sản phẩm TBVS (Đã bind data).

---

## 3. Kế Hoạch Tác Chiến (Execution Plan)
Hai Agent sẽ bắt đầu làm việc độc lập. 
*   **Tninie** có thể Mock (giả lập) dữ liệu trước để lên layout các trang App Route nếu API chưa xong. Hoặc chờ Claude Code cung cấp hàm API xong rồi bind data.
*   **Claude Code** tập trung ngay vào việc xuất API và hoàn thiện Admin Dashboard.

> **Trạng thái hiện tại**: Đã sẵn sàng. Sếp vui lòng gọi Claude Code để giao việc Backend, trong lúc đó tôi (Tninie) sẽ tiến hành scaffold (dựng khung) các trang Frontend.
