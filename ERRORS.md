# 🐛 Error Log - dongphugia

> Tập hợp tất cả lỗi xảy ra trong quá trình phát triển (Auto-generated).

---

## Thống kê nhanh
- **Tổng lỗi**: 1
- **Đã sửa**: 0

---

## [2026-03-27 00:48] - EPERM: operation not permitted trên node_modules

- **Type**: Runtime / Infrastructure
- **Severity**: Critical
- **File**: `node_modules/` (toàn thư mục)
- **Agent**: Tninie
- **Root Cause**: macOS TCC (Transparency, Consent, and Control) đang block quyền truy cập thư mục `node_modules`. Tất cả system calls (`lstat`, `ls`, `xattr`, `find`, `stat`) đều thất bại với `Operation not permitted`. Tuy nhiên, truy cập trực tiếp đến file bên trong (ví dụ: `.package-lock.json`) lại thành công — cho thấy đây là restriction ở mức directory listing, không phải toàn bộ filesystem.
- **Error Message**:
  ```
  Error: EPERM: operation not permitted, lstat '/Users/m-ac/Projects/dongphugia/node_modules'
  Node.js v24.13.0
  ```
- **Fix Applied**: Chưa fix — cần user can thiệp quyền macOS
- **Prevention**: Cấp Full Disk Access cho Terminal/IDE, hoặc reset TCC database cho thư mục dự án
- **Status**: Investigating

---

<!-- Errors sẽ được agent tự động ghi vào đây -->

## [2026-03-27 12:37] - Invalid src prop for next/image (tdm.vn)

- **Type**: Integration
- **Severity**: High
- **File**: `next.config.ts:8`
- **Agent**: Tninie
- **Root Cause**: Next.js `<Image>` component bóp độ phân giải/ảnh từ CDN ngoài nhưng `www.tdm.vn` chưa được khai báo trong `remotePatterns`.
- **Error Message**: 
  ```
  Invalid src prop (https://www.tdm.vn/...) on `next/image`, hostname "www.tdm.vn" is not configured under images in your `next.config.js`
  ```
- **Fix Applied**: Thêm các domain `tdm.vn`, `www.tdm.vn`, và `tuandat.vn` vào `remotePatterns` trong file `next.config.ts`.
- **Prevention**: Khi import dữ liệu từ nguồn ngoài, luôn thêm hostname của nguồn đó vào `next.config.ts` để đề phòng quá trình fetch ảnh gốc hiển thị lỗi cấu hình trước khi ảnh ngầm hoàn tất chuyển sang Supabase.
- **Status**: Fixed

---

## [2026-03-27 12:43] - Dữ liệu Subtype bị lẫn tên sản phẩm

- **Type**: Integration
- **Severity**: High
- **File**: `tbvs_subtypes` DB table
- **Agent**: Tninie
- **Root Cause**: Quá trình cào dữ liệu (Crawler) đã lấy nhầm tên sản phẩm làm thuộc tính `subtype`. Script import ngầm lưu thành hơn 1000 subtype rác khiến bộ lọc Kiểu Dáng bị hỏng.
- **Fix Applied**: Xoá bỏ hơn 1035 `tbvs_subtypes` rác (length > 22 hoặc chứa từ khoá hãng) và reset `subtype_id` của các sản phẩm TDM bị ảnh hưởng về null.
- **Prevention**: Thêm thuật toán chuẩn hóa/mapping `subtype` (ví dụ quy đổi các từ khoá gốc về các ID hợp lệ) trước khi chạy batch import vào CSDL, không bao giờ seed dynamic dữ liệu category/attribute từ web ngoài.
- **Status**: Fixed

---

## [2026-03-27 12:53] - Trùng lặp danh mục con (Product Types) do Crawler

- **Type**: Integration
- **Severity**: Medium
- **File**: `tbvs_product_types` DB table
- **Agent**: Tninie
- **Root Cause**: Bảng mapping danh mục bị trùng lặp khái niệm khi cào từ TDM. Cụ thể "Chậu rửa mặt" / "Chậu rửa lavabo" và "Vòi sen tắm" / "Vòi sen - Sen cây" cùng tồn tại dưới dạng ID khác nhau tạo ra dư thừa trên giao diện.
- **Fix Applied**: Gộp toàn bộ products (450+) và subtypes sang ID danh mục chuẩn. Xóa các danh mục dư thừa (ID 5, 9).
- **Prevention**: Rà soát kỹ bảng seed-data để hợp nhất các từ khoá ngữ nghĩa giống nhau. Đồng nhất 1 file cấu hình taxonomy chung cho crawler và backend.
- **Status**: Fixed

---
