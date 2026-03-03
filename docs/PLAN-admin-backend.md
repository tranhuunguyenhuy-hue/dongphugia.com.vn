# PLAN: Hoàn thiện Admin / Backend

## 1. Yêu cầu (Context Check)
Dựa trên rà soát file `PROJECT-STATUS.md` và mã nguồn thực tế tại hệ thống:
- **Đã hoàn thành:** Hệ thống Admin/Backend đã gần như đạt 95% khối lượng. Các module lớn (5 danh mục SP: Gạch, Bếp, Nước, Vệ sinh, Sàn gỗ + Hệ thống Blog + Image Upload + Tool Cào dữ liệu + Quản lý Form báo giá + Quản lý Banner) đều đã có Database, API và giao diện quản trị Admin CMS sống (Live).
- **Mục tiêu:** Cập nhật 2 module còn sót lại chưa có Database và giao diện Admin CMS. Đó là 2 Section vừa được quy hoạch trên Trang Chủ. Thêm hệ thống Authentication bảo vệ Admin nếu cần.

## 2. Phân tích Các Module Cần Bổ Sung (Missing Features)

### A. Module Dự Án Tiêu Biểu (Projects)
*Hiện trạng:* Đang sử dụng Mock Data (mảng dữ liệu tĩnh) tại file `src/components/home/project-section.tsx`.
*Cần làm:*
- **Database (Schema):** Tạo bảng `projects` (Gồm Title, Location, Thumbnail, Tags liên kết...).
- **API (`public-api.ts`):** Viết API lấy danh sách dự án nổi bật (`is_featured`) cho Homepage.
- **Admin CMS:** Tạo thư mục `/admin/projects` (List, Create, Edit, Delete). Bổ sung upload ảnh.
- **Frontend Sync:** Gỡ Mock Data ở `project-section.tsx` và gọi qua Server Component.

### B. Module Đối Tác / Thương Hiệu (Partners/Brands)
*Hiện trạng:* Đã có danh sách Brand nằm rải rác trong từng ngành (như `bep_brands`, `tbvs_brands`...), nhưng chưa có một bảng quản lý chung để hiển thị Slider logo Đối tác nổi bật trên Homepage.
*Cần làm:*
- **Database (Schema):** Tạo bảng `partners` (Gồm Name, Logo_URL, Link_URL, is_active, sort_order).
- **API (`public-api.ts`):** Viết API lấy danh sách Đối tác (Partners).
- **Admin CMS:** Tạo thư mục `/admin/partners` để thêm/sửa/xóa logo Đối tác.

### C. Authentication (Phân quyền bảo mật - Tùy chọn)
*Hiện trạng:* Cần kiểm tra xem Admin đã được cấu hình MiddleWare check User Session hay chưa để chống truy cập trái phép. (Nếu đã làm, có thể bỏ qua).

## 3. Phân chia Task (Task Breakdown)
*Nhân sự đề xuất: Claude Code (Xử lý Schema & Admin CMS) - Antigravity Tninie (Ráp API Frontend)*

- [ ] **Task 1 (Claude Code):** Sửa file `schema.prisma` thêm 2 Model `projects` và `partners`. Chạy `prisma db push`.
- [ ] **Task 2 (Claude Code):** Viết 2 file Server Actions (`project-actions.ts`, `partner-actions.ts`) để lưu dữ liệu.
- [ ] **Task 3 (Claude Code):** Code giao diện Quản trị `/admin/projects` và `/admin/partners`.
- [ ] **Task 4 (Claude Code):** Mở API Query tại `public-api.ts`.
- [ ] **Task 5 (Antigravity):** Gỡ Data giả, gắn API thật vào `ProjectSection` và `PartnerSection` (nếu Sếp cần thêm Section này vào Main web).

## 4. Verification Checklist (Tiêu chí nghiệm thu)
- [ ] Truy cập được vào `/admin/projects` và `/admin/partners` để nhập liệu.
- [ ] Cập nhật xong thông tin thì Homepage đổi hình ảnh realtime.
- [ ] Toàn bộ luồng dữ liệu trơn tru, không báo lỗi Type hay Hydration ở Console.
