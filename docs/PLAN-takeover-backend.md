# KẾ HOẠCH BỔ SUNG: TIẾP QUẢN CÔNG VIỆC CỦA CLAUDE CODE (Backend Takeover)

**Mục tiêu:** Do Claude Code hết giới hạn sử dụng (usage), Antigravity (Tninie) sẽ chuyển từ vai trò Frontend sang Fullstack để gánh vác các tác vụ Backend còn sót lại và các bước tích hợp cuối cùng, nhằm đưa website Đông Phú Gia về đích đúng hạn.

---

## Giai đoạn 1: Tích hợp API thực cho Hệ thống Blog
Claude Code đã hoàn thành Schema và API/Actions cho Blog, nhưng Frontend vẫn đang dùng Mock Data.
- [ ] Xóa bỏ Mock Data tại `src/app/(public)/blog/page.tsx`.
- [ ] Xóa bỏ Mock Data tại `src/app/(public)/blog/[categorySlug]/page.tsx`.
- [ ] Xóa bỏ Mock Data tại `src/app/(public)/blog/[categorySlug]/[postSlug]/page.tsx`.
- [ ] Fetch dữ liệu thật từ `src/lib/public-api-blog.ts` và tích hợp vào các Component đã có.
- [ ] Tích hợp API logic tự động ghi nhận Lượt xem (`incrementViewCount`) khi user vào bài viết.

## Giai đoạn 2: Xử lý Tính năng Báo Giá CMS (Tồn đọng)
- [ ] Thiết kế form/modal Reply (Phản hồi) tại giao diện Admin `src/app/admin/(dashboard)/quote-requests/page.tsx` (hoặc page chi tiết).
- [ ] Viết Server Action xử lý Gửi Email (hoặc Chuyển trạng thái Đã phản hồi) trong `src/lib/actions.ts` hoặc Action mới.
- [ ] Test luồng Reply Báo giá, cập nhật UI tương ứng (Toast, Update Status).

## Giai đoạn 3: Khâu Về Đích (QA & Deployment)
- [ ] **Smoke Test Toàn diện:** Kiểm tra luồng Mua hàng/Báo giá ở tất cả 5 ngành hàng, duyệt nội dung Blog, Admin CMS.
- [ ] **Mobile Responsive Audit:** Kiểm tra trên thiết bị hẹp (iPhone/iPad).
- [ ] **Deployment:** Build/Deploy lên Vercel.

---

## Phân công thực thi
- **Antigravity (Tninie):** Nhận 100% đầu việc của file Kế hoạch này và sẽ tiến hành thực thi bằng `/create` hoặc nhận lệnh trực tiếp từ sếp.
