# Kế hoạch Debug Lỗi E2E Testing (Debug E2E Bugs)

**Mục tiêu:** Khắc phục 4 lỗi phát hiện trong quá trình chạy E2E Test tự động (Browser Subagent) mà không làm ảnh hưởng hay phá vỡ logic gốc của Claude Code.

---

## 1. Phân tích các lỗi hiện tại & Trách nhiệm xử lý

Nhìn chung, đa phần các lỗi này nằm lơ lửng giữa ranh giới Frontend (Giao diện hiển thị, cấu trúc link) và việc tích hợp Backend (Validation Form, Truy vấn Filter). Tninie hoàn toàn có đủ năng lực để Debug và Fix những lỗi này một cách an toàn.

| ID | Mô tả lỗi (Bug) | Phân loại | Mức độ an toàn khi Tninie Fix |
|---|---|---|---|
| **#1** | **Admin Dropdown Validation:** Các ô `<Select>` (Thương hiệu, BST) dùng `shadcn/ui` không nhận giá trị khi thao tác bằng tool auto. | Admin UI / React Hook Form | **An toàn.** Cần check component `CustomSelect` hoặc cách bind event `onChange` của form. |
| **#2** | **Category Slug Mismatch:** Sản phẩm Bếp / Nước nhưng link lại trỏ sang `/gach-op-lat/...` | Frontend Navigation | **Rất An Toàn.** Khả năng cao do truyền sai prop `basePath` vào component `<ProductCard />` trên màn list. |
| **#3** | **Sàn gỗ Empty Page:** Trang `/san-go` hiển thị rỗng dù có data. | Frontend + API Fetching | **An toàn.** Kiểm tra logic truyền Filter (Thickness, Type) hoặc kiểm tra cờ `is_active` trong Prisma Fetching. |
| **#4** | **Admin Session Timeout:** Bị logout đột ngột. | Auth Config (`auth.js` / NextAuth) | **Cần cẩn thận.** Chỉ audit lại `session.maxAge` trong config, không đổi core logic. |

---

## 2. Các bước triển khai Debug (Task Breakdown)

### Phase 1: Sửa các lỗi Frontend nghiêm trọng (Bugs #2 & #3)
- [ ] **Sửa Bug #2 (Lỗi Slug Danh mục lộn xộn):**
  - Mở `src/app/(public)/thiet-bi-bep/page.tsx` và `vat-lieu-nuoc/page.tsx`.
  - Tìm component `<ProductCard />` đang được map.
  - Sửa lại truyền prop `basePath` đúng với danh mục (ví dụ: `basePath="/thiet-bi-bep"` thay vì `/gach-op-lat`).
- [ ] **Sửa Bug #3 (Trang Sàn gỗ bị rỗng):**
  - Đọc `src/app/(public)/san-go/page.tsx` và `src/lib/public-api-sango.ts`.
  - In thử (console.log) data trả về, check xem tại sao mảng `products` lại trống. (Có thể do logic where `is_active` hoặc format dữ liệu fetch từ DB trả về khác với biến).

### Phase 2: Audit Admin UI (Bug #1 & #4)
- [ ] **Sửa Bug #1 (Select Validation ở Admin):**
  - Kiểm tra `src/app/(admin)/admin/products/product-form.tsx` (hoặc các form tương tự ở Tbvs/Bếp).
  - Đảm bảo thẻ `<Select>` của shadcn có dùng thẻ `<select hidden>` native, hoặc được wrap chuẩn xác với `<Controller>` của `React-hook-form` để Tool automation (và cả user browser cũ) có thể submit được.
- [ ] **Sửa Bug #4 (Session):**
  - Check `src/auth.ts` (hoặc `middleware.ts`). Nếu `maxAge` quá thấp (vd: 1-2 tiếng), update lên 30 ngày (2592000s).

---

## 3. Quy tắc an toàn (Verification Checklist)

- [ ] **KHÔNG overwrite API core:** Nếu API của Claude viết đang chạy ổn định, cấm không được viết đè, chỉ sửa tham số frontend truyền vào.
- [ ] **Test kỹ lưỡng sau khi sửa:** Sửa xong Bug nào, tự khởi chạy command Git diff và Check Live Server bug đó.
- [ ] **Commit riêng biệt:** Mỗi bug fix sẽ dùng 1 commit cụ thể (vd: `fix(frontend): correct basePath for kitchen and water products`) để Claude Code vào sau dễ review lịch sử.

---
**Plan output:** `docs/PLAN-debug-e2e-bugs.md`
