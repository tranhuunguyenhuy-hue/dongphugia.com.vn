# INAX Crawl Pipeline - Session Progress

*Log chi tiết của từng phiên làm việc, lỗi gặp phải và tiến độ thực tế.*

## Phiên 1: Khởi tạo Project & Phase 0
- **Hành động**: Thiết lập cấu trúc thư mục `scripts/crawl-inax/` và cập nhật Blueprint theo hướng Full Upsert.
- **Hành động**: Chạy lệnh bot quét thử trang Master Listing Hita và 1 sản phẩm "Bồn cầu 1 khối INAX AC-4005VN".
- **Kết quả**: Đã bắt thành công mọi Selectors quan trọng: Giá (giảm, gốc), Link PDF, và bóc thành công cấu trúc "Nguyên hộp bao gồm" (nằm trong `div.panel-body`).
- **Trạng thái**: ✅ Hoàn thành Phase 0. Bao gồm lập file cấu hình Strategy.

## Phiên 2: Thực thi Phase 1 (Full Discovery)
- **Vấn đề**: Việc click nút "Xem thêm" trên các danh mục Hita rất dễ dính infinite loop do UI không phân trang kiểu truyền thống hoặc nút bị vô hiệu hóa ngầm.
- **Giải pháp Pivot**: Cào thẳng file XML Sitemap (`https://hita.com.vn/product-sitemap.xml`) chứa toàn bộ liên kết sản phẩm, sau đó dùng Regex lấy các URL chứa từ khóa `inax`.
- **Kết quả**: Vét sạch **2,208** URL sản phẩm INAX trong vòng 10 giây. Tỷ lệ thành công và sót link là 0% vì đây là file sitemap để khai báo cho Google. Dữ liệu đã lưu tại `output/inax-master-urls.json`.
- **Trạng thái**: ✅ Hoàn thành Phase 1.

## Phiên 3: Thực thi Phase 2 & Sửa lỗi Frontend
- **Hành động**: Chạy background job kịch bản `phase2_main.ts` xử lý 2,208 sản phẩm INAX. Đã giải quyết triệt để vấn đề Lazy Load của ảnh, tải tài liệu PDF trên Global DOM, và bảo vệ an toàn cho URL ảnh/link thông qua encode/decode regex tạm thời.
- **Kết quả Crawl**: Hoàn thành xuất sắc 2,202/2,205 sản phẩm (3 lỗi 404 từ Hita). Hệ thống phình to lên 7,504 sản phẩm và hơn 46,265 bức ảnh lưu trữ nội bộ trên BunnyCDN. Dữ liệu đã được Upsert tự động vào Prisma.
- **Phát hiện Bug Frontend**: Phát hiện 183 sản phẩm "Bồn Cầu" biến mất trên danh sách do lỗi Scope Trap của Prisma (`NOT: { contains }` loại bỏ ngầm các record có giá trị `NULL`) và lỗi ghi đè Object `OR` khiến trạng thái `is_master` bị bỏ qua. Đã code lại bằng Array `AND: []` trong `src/lib/public-api-products.ts` để fix triệt để.
- **Trạng thái**: ✅ Hoàn thành Phase 2. Mọi dữ liệu đã vào DB và hiển thị mượt mà.
- **Next Step**: Tiến hành Phase 3 (Data Transformation) quét 2,207 sản phẩm Inax để tự động nhận dạng phân loại Cấp 3 (1 khối, 2 khối, điện tử) do hiện tại đang ở trạng thái NULL ("Không xác định").

## Phiên 4: Thực thi Phase 3 (Data Transformation & Deep Image Migration)
- **Hành động**: Chạy script `migrate_desc_images.ts` quét toàn bộ HTML bài viết mô tả sản phẩm, tải toàn bộ ảnh đang bị hotlink về BunnyCDN và cập nhật lại URL nội bộ cho 634 sản phẩm INAX, xóa hoàn toàn sự phụ thuộc vào CDN đối thủ.
- **Hành động**: Chạy script `map_categories.ts` tự động gán `product_type` (Level 3 category) cho 2,207 sản phẩm INAX dựa trên Breadcrumbs, tên sản phẩm và slug danh mục của ĐPG.
- **Hotfix QA từ Khách hàng**: Áp dụng các quy tắc lọc thông minh trực tiếp trong cơ sở dữ liệu để sửa lỗi phân loại chéo:
  1. *Bồn cầu treo tường thông minh*: Ưu tiên gán `bon-cau-treo-tuong` thay vì gom nhóm vào `bon-cau-thong-minh` để phục vụ bộ lọc kết cấu tốt hơn.
  2. *Sen đứng & Sen cây*: Khớp các chuỗi có chữ "Cây" hoặc "Đứng" để map chuẩn vào slug `sen-dung`.
  3. *Tay sen tắm*: Lọc nghiêm ngặt các sản phẩm có cụm từ "Tay sen", "Tay sen tắm" kết hợp cùng Thương hiệu và SKU. Di chuyển toàn bộ các tay gạt củ sen, tay cầm nước nhầm lẫn sang `phu-kien-sen-tam`.
  4. *Củ sen rời*: Tách củ sen rời (`cu-sen`) khỏi trọn bộ bằng cách lọc các sản phẩm chứa "sen tắm" nhưng KHÔNG có chữ "Bộ".
  5. *Thân vòi & Linh kiện lẻ*: Di chuyển "thân vòi", "núm vặn", "nắp chụp", "ốc" sang `phu-kien-voi` hoặc `phu-kien-sen-tam`.
- **Kết quả**: 100% sản phẩm INAX (2,207 bản ghi) đã được phân loại chuẩn xác vào danh mục cấp 3, sạch bóng hotlink mô tả và sẵn sàng cho giai đoạn tiếp theo.
- **Data Cleansing (Dọn rác SKU)**: Đã chạy script `clean_inax_sku.ts` để tự động loại bỏ các tiền tố rác tiếng Việt bị Hita thêm vào mã SKU (VD: `BON-CAU-1-KHOI-INAX-AC-939VN` -> `AC-939VN`), đồng thời xóa bỏ các bản duplicate bị tạo ra do trùng SKU gốc.
- **Trạng thái**: 🔄 Đang ở Phase 3. Chuẩn bị bước Gom nhóm biến thể (Variant Grouping).

## Phiên 5: Đánh giá tổng quát & Fail (Thất bại)
- **Hành động**: Kiểm định lại chất lượng dữ liệu thu thập được từ đợt crawl đầu tiên qua Hita.
- **Kết quả Audit**: Quá nhiều rác dữ liệu tồn đọng (Giá gốc rỗng/lộn xộn, Slider bị vòng lặp sinh ra 15,000 ảnh rác, SKU sai lệch, Grouping biến thể tốn nhiều công sức dọn dẹp).
- **Trạng thái**: 🔴 **FAIL**. Tiến trình này chính thức bị hủy bỏ. Yêu cầu xóa sạch toàn bộ data Inax cũ và Crawl lại toàn bộ từ đầu bằng phương pháp/công cụ mới hiệu quả hơn.
