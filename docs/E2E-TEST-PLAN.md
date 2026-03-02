# Kế hoạch Kiểm thử Toàn diện (E2E Test Plan) - Website Đông Phú Gia

**Người lập:** Antigravity (Tninie)
**Mục tiêu:** Kiểm thử luồng End-to-End (E2E) từ khi tạo sản phẩm trong Admin CMS cho đến khi hiển thị và tương tác trên Client Frontend cho toàn bộ 5/5 danh mục sản phẩm.

---

## 1. Trạng thái công việc hiện tại (Nghiệm thu chéo)
* **Claude Code (Backend):** Đã hoàn tất Backend/Mô hình DB/Admin CMS cho cả 5 danh mục. Đang trong giai đoạn chuẩn bị làm tiếp **Giai đoạn 1.3** (Tính năng Reply Báo giá trong Admin). Bước kiểm thử này sẽ là đợt nghiệm thu chất lượng (QA) cuối cùng cho code của Claude Code.
* **Tninie (Frontend):** Đã hoàn thành 100% UI cho Client. Chuẩn bị chạy kịch bản Test để fix UI Bugs (nếu có).

---

## 2. Kịch bản Kiểm thử chi tiết (Test Cases)

Chúng ta sẽ sử dụng công cụ Trình duyệt (Browser Subagent) hoặc Test Manual tay để đi qua từng luồng sau:

### 🧪 Test Case 1: Gạch ốp lát (Tiles)
1. **Admin CMS (`/admin/products`)**
   - Click "Tạo sản phẩm mới".
   - Upload ảnh chính, ảnh phụ thông qua `ImageUploader` Supabase.
   - Điền đầy đủ thông tin: Tên, SKU, Chọn Bộ sưu tập, Kích thước, Bề mặt, Vân gạch, Không gian.
   - Lưu sản phẩm và kiểm tra xem có hiển thị trong danh sách Admin không.
2. **Client UI (`/gach-op-lat`)**
   - Tìm kiếm sản phẩm vừa tạo ở trang danh sách `/gach-op-lat`.
   - Test bộ lọc nhóm theo Màu sắc, Kích thước để đảm bảo sản phẩm hiện ra.
   - Vào trang chi tiết: Check UI cấu trúc Gallery, Tabs Thông số.
   - Gửi thử 1 Form Báo Giá từ sản phẩm này.

### 🧪 Test Case 2: Thiết bị Vệ sinh (Sanitary Ware)
1. **Admin CMS (`/admin/tbvs/products`)**
   - Tạo sản phẩm mới. Chọn Brand (Thương hiệu), Loại SP (Subtype).
   - Test việc upload ảnh và lưu data.
2. **Client UI (`/thiet-bi-ve-sinh`)**
   - Truy cập danh mục. Click thử vào Brand Carousel xem có filter đúng không.
   - Click vào sản phẩm: Check xem các thông tin của TBVS đã hiện đầy đủ chưa. Submit form báo giá.

### 🧪 Test Case 3: Thiết bị Bếp (Kitchen Appliances)
1. **Admin CMS (`/admin/bep/products`)**
   - Lên sản phẩm mới, chọn Brand (Bosch/Hafele/...), Subtype (Bếp từ, Máy hút mùi...). Thiết lập giá base.
2. **Client UI (`/thiet-bi-bep`)**
   - Kiểm tra `SmartFilterBep` trên Desktop và `FilterDrawer` trên Mobile.
   - Truy cập trang Chi tiết bếp: Soi kỹ phần "Đặc điểm nổi bật" và "Tính năng" xem text có hiển thị đúng format HTML/Markdown không.

### 🧪 Test Case 4: Vật liệu ngành Nước (Water Products)
1. **Admin CMS (`/admin/nuoc/products`)**
   - Tạo sản phẩm mới, kiểm tra field đặc thù là `Material` (Chất liệu: Nhựa PVC, Inox...).
2. **Client UI (`/vat-lieu-nuoc`)**
   - Test bộ lọc Material.
   - Xem trang chi tiết, kiểm tra thông số "Chất liệu" đã hiển thị trong bảng Đặc tả (Specs Table) chưa. Kiểm tra Form Báo giá.

### 🧪 Test Case 5: Sàn gỗ / Sàn nhựa (Flooring)
1. **Admin CMS (`/admin/sango/products`)**
   - Tạo sản phẩm Sàn gỗ mới.
   - Nhập các input đặc thù: `Thickness` (Độ dày mm), `Width` (Rộng), `Length` (Dài), `AC Rating` (Độ mài mòn), `Warranty` (Năm bảo hành).
2. **Client UI (`/san-go`)**
   - Test cực hạn nút Lọc theo Độ dày (ví dụ: `8mm`, `12mm`) xem truy vấn có chính xác không.
   - Kiểm tra giao diện chi tiết: Card vàng `Mới`/`Bán chạy` có hiện lên không? Các thông số RộngxDài có parse đúng định dạng không?

---

## 3. Cách thức Thực hiện (Execution Plan)

Em đề xuất **2 phương án** để triển khai:

* **Phương án A (Tự động hóa bằng AI):** Sếp cấp quyền cho em dùng Tool `browser_subagent` để em tự động điều khiển trình duyệt ẩn, đăng nhập vào cửa sổ Admin `localhost:3000/admin`, tự điền và tạo 5 sản phẩm mẫu. Sau đó em tự navigate sang trang chủ và check UI. Lỗi chỗ nào em tự fix code chỗ đó. (Quá trình này sẽ sinh ra video record để sếp xem).
* **Phương án B (Manual Hỗ trợ phối hợp):** Sếp lên trình duyệt của mình chạy `npm run dev` và tự tạo 1-2 sản phẩm cho mỗi luồng. Trong lúc sếp tạo, sếp nếu thấy bug hay UI lệch, sếp chụp ảnh hoặc báo lỗi em sẽ fix Real-time. Chỗ nào code sai em móc log server ra bắt bệnh.

Sếp thấy Kế hoạch này OK chưa ạ? Sếp chọn Phương án A hay Phương án B để em tiến hành luôn? Nhớ là em sẽ update luôn file `PROJECT-STATUS.md` để ghi nhận đợt tổng kiểm tra E2E này cho cả Claude Code và em.
