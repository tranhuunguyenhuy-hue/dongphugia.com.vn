# Kế Hoạch Sửa Lỗi Vercel Deploy (Vercel Build Error Fix)

## Bối cảnh vấn đề (Context)
Dựa vào hình ảnh Sếp cung cấp, hệ thống Vercel đang báo lỗi `Error` tại tiến trình `Production` (chấm đỏ) trong 4 lần Commit gần nhất.
Cụ thể, các commit sinh ra lỗi bao gồm:
1. `fix(tiptap): add immediatelyRender false...` (Mới nhất)
2. `feat(backend-takeover): integrate real blog api...`
3. `feat(admin): Refactor Gạch ốp lát...`
4. Một Redeploy từ bản cũ.

Bản deploy thành công gần nhất (chấm xanh `Ready` - Current) đã từ ngày 15 tháng 2.

## Phân Tích & Chẩn Đoán Ban Đầu
Vì Vercel là môi trường Cloud Build (chạy lệnh `npm run build`), các lỗi khiến Vercel "sập tiệm" giữa chừng 90% rơi vào 3 nhóm nguyên nhân sau:

1. **Lỗi Type-Check TypeScript (TS Error):** Quá trình build của Next.js ép buộc kiểu dữ liệu cực gắt. Chỉ cần 1 biến có nguy cơ `undefined` hoặc sai Type (ví dụ `any` không hợp lệ) là Vercel huỷ Build.
2. **Lỗi ESLint:** Cảnh báo Lint (như biến khai báo mà không dùng `unused vars`, thiếu thẻ `alt` cho Image, thiếu dependencies trong `useEffect`) bị Vercel coi là Lỗi nghiêm trọng và ngắt Build.
3. **Lỗi Prisma Client (Thiếu Generate trên Cloud):** Đôi khi hook `postinstall` của Prisma không chạy trên Vercel dẫn đến không tìm thấy Prisma object lúc Build. Vercel cần kết nối Database để tạo các trang Static/SSG (nếu có fetch api trong hàm build).

**Nhận định nhanh:** Nhìn qua lịch sử, cấu trúc trang Admin và Blog mới được đẩy lên (Takeover Backend) đã can thiệp rất sâu vào Typescript Type và ORM Prisma, khả năng cao là TypeScript đang vướng lỗi "strict mode" ở đâu đó trong codebase.

## 🔴 Giai đoạn 1: PLANNING (Đang diễn ra)
- [x] Tạo file kế hoạch này (`PLAN-vercel-deploy-fix.md`).
- [ ] Chờ Sếp phê duyệt kế hoạch.

## 🟢 Giai đoạn 2: IMPLEMENTATION (Khi Sếp nhấn duyệt)

Kế hoạch này sẽ yêu cầu các Đặc vụ (Agents) phối hợp theo trình tự:

**1. Đặc Vụ `devops-engineer` & `debugger` (Log Analysis - Khám bệnh)**
- Kéo Log hệ thống hoặc giả lập lệnh Build Local (`npm run build`) ngay trên máy Sếp. Lý do: Lỗi Vercel 100% sẽ hiển thị y chang trên màn hình Terminal khi chạy lệnh Build này.
- **Mục tiêu:** Bắt chính xác thông báo lỗi Đỏ (VD: "Type error in file X ở dòng Y").

**2. Đặc Vụ `frontend-specialist` / `backend-specialist` (Thực thi y lệnh)**
- Truy cập thẳng vào file bị lỗi.
- Chữa trị dứt điểm các lỗi Type (Thêm Type guard, Interface hoặc ép kiểu) và lỗi ESLint.

**3. Đặc Vụ `test-engineer` (Kiểm chứng - Mặc lên người)**
- Chạy lại lệnh `npm run build` lần thứ 2.
- Nếu Pass chữ xanh `✓ Compiled successfully`, sẽ tạo Commit mới đẩy lên Github (`git push`).
- Theo dõi tiến trình Vercel chuyển sang chấm Xanh.

---

**Sếp duyệt Plan này để em bắt đầu gọi `debugger` chạy `npm run build` trên máy lấy mã lỗi (Error Log) nhé? (Y/N)**
