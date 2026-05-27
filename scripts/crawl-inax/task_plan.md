# INAX Crawl Pipeline - Task Plan

## Mục tiêu (Goal)
🔴 **[CẬP NHẬT: TIẾN TRÌNH CRAWL NÀY ĐÃ BỊ ĐÁNH GIÁ LÀ THẤT BẠI. DỰ KIẾN XÓA TOÀN BỘ VÀ CRAWL LẠI TỪ ĐẦU BẰNG PHƯƠNG PHÁP MỚI]**
Crawl **TOÀN BỘ** dữ liệu sản phẩm INAX từ trang Master Listing của Hita, trích xuất kiệt để mọi ngóc ngách dữ liệu (bao gồm Gallery và Specs), loại bỏ hoàn toàn Video/Youtube Thumbnail, và map chuẩn xác vào hệ thống Database ĐPG (cơ chế Full Upsert).

## Các Giai Đoạn (Phases)

### [x] Phase 0: Research & Schema Mapping
- [x] Phân tích cấu trúc trang Master Listing INAX.
- [x] Khảo sát DOM để bắt Giá, Danh mục cấp 3.
- [x] Phát hiện & lên phương án chặn Video/Thumbnail trong Gallery và Description.
- [x] Lên phương án bóc tách Thông số kỹ thuật (Bảng table) và Phụ kiện (Nguyên hộp bao gồm).
- [x] Lập file `scripts/crawl-inax/strategies/inax.ts`.

### [x] Phase 1: Full Discovery (Thu thập toàn bộ URLs)
- [x] Chạy Crawler vào trang Master Listing lấy mảng `[URL, SKU]`.
- [x] Lưu danh sách vào `output/inax-master-urls.json`. Không lọc bỏ SKU đã có trong DB.

### [x] Phase 2: Exhaustive Deep Crawl (Cào kiệt để & Di chuyển Tài nguyên)
- [x] Chạy Core Crawler vào từng URL. Cào các Data Schema:
  - **Hình ảnh**: Cào Main Thumbnail và mảng Gallery. **Chặn `ytimg.com`**.
  - **Thông số kỹ thuật**: Parse bảng Table HTML thành dạng JSON Key-Value.
  - Khối Giá cả (Gốc, Giảm, Giảm online).
  - **Chi tiết sản phẩm (`description`)**: Lấy toàn bộ HTML ẩn dưới nút "Xem thêm". **Xóa thẻ `<iframe/>`, `<video/>`**.
  - **Tab Tài liệu**: Parse PDF files và text "Nguyên hộp bao gồm".
- [x] Chạy cổng Validation. Làm sạch Data (Xóa Hita, Rewrite Internal Links - **Bảo vệ URL hình ảnh và fix Lazy Load**).
- [x] Download Image/PDF (Gallery & Bài viết) -> Upload lên BunnyCDN.
- [x] Thực hiện Upsert DB tự động thông qua Script Crawler (Đã chèn 2,207 sản phẩm).

### [x] Phase 3: Data Transformation & Category Mapping (Chuẩn hóa DB)
- [x] Ánh xạ Danh mục cấp 3 (`product_type`, `product_sub_type`): Dùng SQL/Prisma quét qua `name` và `specs` để tự động gán loại (VD: bồn cầu 1 khối, 2 khối) và đã áp dụng triệt để các bộ lọc hotfix QA (ưu tiên kết cấu, lọc tay gạt, tách củ sen độc lập).
- [x] Di chuyển ảnh trong bài viết mô tả (Deep Image Migration): Tải toàn bộ ảnh mô tả từ Hita về BunnyCDN và cập nhật URL nội bộ để tránh bẫy hotlink.
- [x] Làm sạch SKU (Data Cleansing): Xử lý 1,473 mã bị Hita nối dài thêm tiền tố tiếng Việt (VD: `BON-CAU-INAX-AC-939VN` -> `AC-939VN`), xóa bỏ các bản ghi trùng lặp (Duplicate).
- [ ] Gộp và ẩn Biến thể (Variants - CÔNG VIỆC TIẾP THEO): Tìm kiếm và nhóm các sản phẩm có tính chất liên quan lại thành một Nhóm Biến Thể, thiết lập `is_master` phù hợp.

### [ ] Phase 4: Sync & Audit
- [ ] Đồng bộ Combo (`product_relationships`).
- [ ] Chạy Audit Data Quality toàn diện Frontend & Backend.

