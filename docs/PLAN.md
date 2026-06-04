# Kế hoạch triển khai Task LEO-440

## Mục tiêu
Loại bỏ việc lặp lại tên thương hiệu " | Đông Phú Gia" trong tiêu đề (title) của các trang thuộc thư mục `src/app/(public)/`. Vì tên thương hiệu đã được cấu hình tự động thông qua `title.template` trong `src/app/layout.tsx`, các trang con không cần phải nối thêm chuỗi này thủ công nữa.

## Phạm vi thay đổi
- Chỉnh sửa các đối tượng `metadata` tĩnh.
- Chỉnh sửa kết quả trả về của các hàm `generateMetadata()`.
- **Tuyệt đối không** chỉnh sửa file `src/app/layout.tsx`.
- Đối với trang chủ (`src/app/(public)/page.tsx`), có thể giữ nguyên cấu hình hiện tại hoặc dùng object `{ absolute: "..." }` để thiết lập tiêu đề tuyệt đối nếu cần giữ nguyên format cũ.

## Phân công nhiệm vụ

### 1. Nhiệm vụ của `frontend-specialist`
- Tìm và chỉnh sửa tất cả các thuộc tính `title` bên trong các biến `metadata` export hoặc hàm `generateMetadata()`.
- Loại bỏ hậu tố ` | Đông Phú Gia` hoặc biến thể tương tự trong các file sau:
  - `src/app/(public)/dich-vu-lap-dat/page.tsx`
  - `src/app/(public)/gach-op-lat/page.tsx`
  - `src/app/(public)/gach-op-lat/[sub]/page.tsx`
  - `src/app/(public)/gach-op-lat/[sub]/[slug]/page.tsx`
  - `src/app/(public)/doi-tac/page.tsx`
  - `src/app/(public)/ve-chung-toi/page.tsx`
  - `src/app/(public)/tim-kiem/page.tsx`
  - `src/app/(public)/thiet-bi-ve-sinh/page.tsx`
  - `src/app/(public)/thiet-bi-ve-sinh/[sub]/page.tsx`
  - `src/app/(public)/thiet-bi-ve-sinh/[sub]/[slug]/page.tsx`
  - `src/app/(public)/thiet-bi-bep/page.tsx`
  - `src/app/(public)/thiet-bi-bep/[sub]/page.tsx`
  - `src/app/(public)/thiet-bi-bep/[sub]/[slug]/page.tsx`
  - `src/app/(public)/blog/page.tsx`
  - `src/app/(public)/lien-he/page.tsx`
  - `src/app/(public)/du-an/page.tsx`
  - `src/app/(public)/vat-lieu-nuoc/page.tsx`
  - `src/app/(public)/vat-lieu-nuoc/[sub]/page.tsx`
  - `src/app/(public)/vat-lieu-nuoc/[sub]/[slug]/page.tsx`
- **Xử lý trang chủ (`src/app/(public)/page.tsx`)**:
  - Nên xem xét sử dụng cấu hình `absolute` nếu muốn tiêu đề không bị Next.js tự động nối thêm hậu tố template. Ví dụ: `title: { absolute: "Đông Phú Gia - Vật liệu xây dựng cao cấp tại Đà Lạt" }`.
- Sau khi hoàn thành việc loại bỏ các chuỗi duplicate, commit code và báo cáo lại.

### 2. Nhiệm vụ của `test-engineer`
- Sau khi `frontend-specialist` cập nhật xong mã nguồn, chịu trách nhiệm xác minh lại tính toàn vẹn của ứng dụng:
  - Chạy lệnh build của Next.js (ví dụ: `npm run build` hoặc `pnpm build` hoặc `bun run build` tuỳ theo package manager đang sử dụng của project) để đảm bảo không phát sinh lỗi TypeScript/build.
  - Kiểm tra (test) giao diện hoặc chạy môi trường dev/production cục bộ để xác nhận các thẻ `<title>` trên một vài trang tĩnh và trang động hiển thị đúng chuẩn (VD: `<title>Gạch Ốp Lát | Đông Phú Gia</title>`), không bị dư thừa thành `Gạch Ốp Lát | Đông Phú Gia | Đông Phú Gia`.

## Quy trình thực thi
1. Orchestrator giao việc cho `frontend-specialist`.
2. `frontend-specialist` đọc kế hoạch, thực hiện thay đổi và gửi phản hồi thành công.
3. Orchestrator giao việc cho `test-engineer` để xác minh độ ổn định.
4. `test-engineer` chạy các script kiểm tra và báo cáo kết quả.
5. Kết thúc Task LEO-440 và đánh dấu hoàn thành.
