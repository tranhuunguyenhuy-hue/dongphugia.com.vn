# 🤝 Quy ước Phối hợp: Antigravity vs. Claude Code
*(Bản nháp được thống nhất để tối ưu quy trình làm việc song song, tránh giẫm chân nhau)*

## 1. Phân chia Lãnh địa (Domain Boundaries)

Để tránh conflict (xung đột) mã nguồn khi 2 AI chạy đồng thời trên cùng một dự án `dongphugia`, chúng ta sẽ tuân thủ nghiêm ngặt ranh giới phân công theo **Full-Stack Separation of Concerns**:

| Vai trò | Phụ trách chính | Trách nhiệm cốt lõi | Các File / Thư mục sở hữu (Ownership) |
| :--- | :--- | :--- | :--- |
| **Claude Code** | **Backend, CSDL & Admin CMS** | - Thiết kế Database (`schema.prisma`), Migration, Seeding.<br>- Viết API, Server Actions (`src/lib/*-actions.ts`).<br>- Xây dựng trang quản trị CMS (`src/app/admin/*`).<br>- Quản lý File Upload, Auth (Supabase). | `prisma/*`, `src/app/admin/*`, `src/lib/*-actions.ts`, `src/app/api/*`, `.env` |
| **Antigravity (Tninie)** | **Frontend Public, UI/UX & SEO** | - Xây dựng Giao diện người dùng (`src/app/(public)/*`).<br>- Thiết kế & Code React Components (`src/components/*`).<br>- Tối ưu Responsive, Animation, Performance.<br>- Triển khai Schema SEO, Metadata. | `src/app/(public)/*`, `src/components/*`, `src/app/globals.css`, `tailwind.config.ts`, `docs/PLAN-*.md` |

> ⚠️ **NGOẠI LỆ DUY NHẤT**: Hai bên chỉ đụng vào file của bên kia khi cực kỳ cần thiết (VD: Claude cần thêm UI cho admin lấy từ components chung, hoặc Tninie cần thêm 1 trường Data Model nhỏ cho UI) - Nhưng PHẢI để lại ghi chú trong File Task.

---

## 2. Giao thức Giao tiếp Bất đồng bộ (Asynchronous Transfer Protocol)

Hai Agent không thể chat trực tiếp với nhau, nên User (Sếp) sẽ đóng vai trò **Người điều phối (Orchestrator)**. 
Để User không phải đọc hiểu quá nhiều code kỹ thuật, 2 AI sẽ giao tiếp với nhau qua **Hệ thống tệp tin chung (Shared Files)**.

Quy trình chuẩn:
1. **Claude nhận Task Backend**: Cập nhật DB -> Viết API -> Xây Admin -> **Tạo file Bàn giao (Hand-off)**.
2. **Claude thông báo User**: "Báo với Tninie là tôi đã làm xong Backend phần X. Đã cập nhật `PROJECT-STATUS.md`."
3. **User báo Tninie**: "Claude Code đã hoàn thành Backend phần X."
4. **Tninie nhận Task Frontend**: Đọc `PROJECT-STATUS.md` -> Gọi API mà Claude viết -> Xây dựng UI -> Test -> **Đánh dấu DONE**.

### 2.1. Nơi chứa thông tin trạng thái
Sử dụng tệp tin: `docs/PROJECT-STATUS.md` (Do Antigravity tạo và duy trì).
- Claude Code có trách nhiệm **Cập nhật** (Append) bảng API vào file này mỗi khi viết xong 1 feature.
- Antigravity có trách nhiệm **Đọc** file này để biết lấy Data từ hàm nào.

---

## 3. Mục Tiêu Tối Thượng: Hoàn Thiện Toàn Bộ Website

Dựa trên mục tiêu mới của Sếp, dưới đây là Roadmap (Lộ trình) còn thiếu của dự án Đông Phú Gia, chia rõ ai làm việc nấy.

### Giai đoạn 1: Hoàn tất Thiết Bị Bếp (Danh mục cốt lõi số 3)
*   **Claude Code (Đã làm xong Core)**: Vừa tạo schema `bep_` và seed database. 
*   **Claude Code (Tiếp theo)**: Cần tạo Server Actions (`src/lib/tbb-actions.ts`), API lấy dữ liệu và Cổng trang `/admin/thiet-bi-bep` hoàn chỉnh.
```markdown
*   **Antigravity (Chờ Claude)**: Sau khi Claude có API, sẽ clone UI Thiết bị vệ sinh sang route `src/app/(public)/thiet-bi-bep` và tối ưu Layout.
```

### Giai đoạn 2: Trang Chi Tiết Sản Phẩm (Product Detail) & Liên Hệ Báo Giá
*   **Claude Code**: Cấu trúc bảng Lưu trữ "Yêu cầu báo giá" (Quote Requests) gửi từ người dùng. Xây dựng trang hiển thị Danh sách yêu cầu trong Admin.
*   **Antigravity**: Tinh gọn Layout Form Báo Giá ở màn Chi tiết Sản phẩm ở cả 3 danh mục (Gạch, TBVS, Bếp). Tối ưu Mobile layout cho nút "Gọi ngay", "Zalo". Cập nhật "Sản phẩm cùng Bộ sưu tập" tại trang chi tiết.

### Giai đoạn 3: Tin Tức (Blog/News), Dự Án & Đối Tác
*   **Claude Code**: Xây dựng Core CRUD cho Bài viết (Posts), Dự án công trình (Projects), Đối tác logo (Partners) trong Admin CMS.
*   **Antigravity**: Hiển thị lưới bài viết tại trang chủ và route `/tin-tuc`, chi tiết `/tin-tuc/[slug]`. Tương tự với trang `/du-an` kiến trúc. 

### Giai đoạn 4: Đánh bóng (QA, Security & Audit)
*   **Cả 2**: User chạy lệnh `/audit`. Claude Code lo rà soát Security (Supabase RLS, API Auth). Antigravity lo rà soát UI (Core Web Vitals, HTML lỗi).

## 4. Tóm tắt cho User (Cách giao việc từ nay về sau)
1. Khởi tạo tính năng: Gọi Claude Code làm Backend trước.
2. Chuyển giao: Gọi Antigravity (Tninie) đổ dữ liệu lên Frontend.
3. Kế hoạch này là **Bất biến**. Sếp chỉ cần đưa link `docs/PLAN-collaboration-protocol.md` cho Claude Code đọc để nó hiểu quy định.
