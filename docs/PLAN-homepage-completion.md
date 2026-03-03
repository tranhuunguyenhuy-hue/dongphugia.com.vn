# PLAN: Hoàn thiện Homepage

## 1. Yêu cầu (Context Check)
- **Đã hoàn thành:** Xóa bỏ 2 section cũ ở cuối trang chủ (Danh mục gạch & Sản phẩm nổi bật chung).
- **Mục tiêu:** Thêm 3 section mới vào Homepage để hoàn thiện nội dung.
  1. Sản phẩm nổi bật của từng danh mục
  2. Blog Section (Tin tức / Bài viết)
  3. Project Section (Dự án tiêu biểu)

## 2. Phân tích & Câu hỏi (Socratic Gate)
Trước khi bước vào code, cần xác định rõ:
- **Dữ liệu (Data):** Các section này sẽ dùng data giả (Mock data) dựng UI trước hay kết nối thẳng với API (từ file `public-api.ts`)? //Trả lời: Sử dụng trực tiếp data có sẵn (những danh mục sản phẩm chưa có sản phẩm thì để trống:empty state)
- **Giao diện (UI/UX):** Sẽ tiếp tục bám theo thiết kế "Modern, Clean, Airy & Glassmorphism" với các tone màu chủ đạo Xanh (Mint/Emerald) và bo góc mềm mại như Header & Footer chứ ạ? // trả lời: Không sử dụng style đó nữa mà sử dụng style đồng nhất với các trang và components đã có, không define thêm, nếu tôi cần UI mới tôi sẽ đưa hình ảnh tham khảo
- **Trải nghiệm hiển thị:** Có mảng nào cần ứng dụng hiệu ứng Carousel (trượt ngang) thay vì Grid tĩnh (lưới) để tiết kiệm thanh cuộn không Sếp? // Section Dự án nên dùng carousel để tiết kiệm diện tích , section blog cũng tương tự

## 3. Phân chia Task (Task Breakdown)

### Task 1: Component `FeaturedCategoriesProducts` (Sản phẩm nổi bật theo danh mục)
- Chuyển từ việc hiển thị một cục "Sản phẩm nổi bật" sang chia theo TAB hoặc danh sách dọc cho từng danh mục lớn (vd: Tab Gạch ốp | Tab Thiết bị vệ sinh).
- Tái sử dụng `ProductCard`.

### Task 2: Component `BlogSection` (Tin tức)
- Khối hiển thị 3-4 bài báo nổi bật nhất.
- Element: Ảnh Thumbnail chuẩn tỷ lệ, Tiêu đề, Trích dẫn ngắn, Nút "Xem thêm".


### Task 3: Component `ProjectSection` (Dự án tiêu biểu)
- Dạng thư viện ảnh (Gallery/Masonry) hoặc Slider.
- Element: Hình ảnh công trình nhà tắm/nội thất thực tế có overlay tên dự án khi hover.

### Task 4: Ráp nối & Hoàn thiện trang chủ
- Nhúng 4 Component trên vào vị trí trống ở cuối file `src/app/(public)/page.tsx`.
- Cân chỉnh khoảng cách (padding/margin) tương thích (Responsive) giữa các section.

## 4. Verification Checklist (Tiêu chí nghiệm thu)
- [x] Đủ 3 section mới chạy trơn tru, không có khoảng trắng chết.
- [x] Responsive hoàn hảo trên Mobile, Tablet, Desktop.
- [x] Kế thừa đúng mã màu, hiệu ứng nổi (Shadow) và bo khối (Radius) của Dongphugia.
- [x] Terminal không bắn lỗi hay Warning. 
