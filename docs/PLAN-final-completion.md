# KẾ HOẠCH TỔNG KẾT VÀ BÀN GIAO WEBSITE (Final Completion Plan)

**Mục tiêu:** Bản kế hoạch này hợp nhất **Hệ thống Blog/Tin tức** (từ `docs/PLAN-blog.md`) và **5 hạng mục tồn đọng** (từ `docs/PLAN-website-completion.md`). 
Đồng thời, phân định rạch ròi trách nhiệm giữa **Claude Code (Backend)** và **Antigravity - Tninie (Frontend)** để dứt điểm toàn bộ dự án Đông Phú Gia theo định hướng "Pro Max".

---

## Giai đoạn 1: Backend cho Hệ thống Blog (Claude Code)
**Mục tiêu:** Claude Code (Backend) xây dựng toàn bộ Database (Schema, Seed), Server Actions và public API để Tninie (Frontend) lấy dữ liệu.

- [ ] **1.1. Khởi tạo Database Blog (Core MVP)**
  - Schema: `blog_categories`, `blog_posts`, `blog_tags`, `blog_post_tags`.
  - Mặc định 6 cấu hình Category hạt giống (Tin tức, Kiến thức, Hướng dẫn chọn, Dự án, Xu hướng, Thi công).
  - Khai báo Prisma và chạy `npx prisma db pull && npx prisma generate`.
- [ ] **1.2. API & Server Actions**
  - Viết file `src/lib/public-api-blog.ts` chứa các hàm đọc API công khai (ví dụ: `getBlogPosts()`, `getBlogCategories()`).
  - Viết file `src/lib/blog-actions.ts` chứa các Action tạo/xóa/sửa bài viết dành riêng cho Admin CMS.
- [ ] **1.3. CMS Editor cho Admin**
  - Tích hợp chuẩn **TipTap** Rich Text Editor (`@tiptap/react`). Không dùng thư viện lạ.
  - CRUD (Thêm, Sửa, Xóa) 100% cho `posts` và `tags` tại route `/admin/blog/*`.
- [ ] **1.4. Tính năng Báo Giá CMS (Tồn đọng cũ)**
  - Claude Code viết API Mail / System để gửi Reply (Phản hồi) cho khách từ hệ thống Admin (`/admin/quotes`).

---

## Giai đoạn 2: Frontend Client-side (Antigravity - Tninie)
**Mục tiêu:** Tninie (Frontend) lo phần làm đẹp giao diện ngoài trang chủ, đảm bảo Pixel Perfect theo thiết kế Figma đối với phần Tin tức (Blog) và 5 Form tồn đọng.

- [ ] **2.1. Frontend Blog (Phase 1)**
  - Tninie viết layout trang danh sách Blog: `/blog/page.tsx` và `/blog/[categorySlug]/page.tsx`.
  - Thiết kế trang Chi tiết Bài viết (`/blog/[categorySlug]/[postSlug]`) hỗ trợ parsing CSS `<article className="prose">` cho HTML Content của TipTap.
  - Custom UI Mục Lục (TOC): Regex bóc tách thẻ `<h2>`, `<h3>` từ HTML content để làm Sticky Sidebar Menu.
- [ ] **2.2. Hoàn thiện Form Báo Giá (Tồn đọng cũ)**
  - Tninie kiểm tra Toast (Thông báo nổi) thành công cho Form Báo giá của toàn bộ 5 Sản phẩm (Gạch, Vệ sinh, Bếp, Nước, Sàn gỗ). Đảm bảo khách nhập xong không bỡ ngỡ.
- [ ] **2.3. Audit Effect Giao diện Admin "Pro Max" (Tồn đọng cũ)**
  - Tninie Rà soát CSS Hover / Transition / Animation tại các khu vực quản lý Banner, Dự án, Đối tác... để nhìn app xịn hơn.

---

## Giai đoạn 3: SEO & Server Performance (Antigravity - Tninie)
**Mục tiêu:** Chuẩn bị hạ tầng tìm kiếm và chịu tải cho website. Tninie (Frontend) chịu trách nhiệm do am hiểu Next.js Meta Data.

- [ ] **3.1. Technical SEO & Schema Markup**
  - Định nghĩa Header `generateMetadata` chuẩn xác nhất cho Danh mục và Chi tiết (Blog + 5 Loạt Product).
  - Tích hợp Open Graph (og:image) và Data JSON-LD Google Rich Snippet (Product / Article).
- [ ] **3.2. Sitemap Dynamic & Caching**
  - Tự động map URL của Toàn bộ Website (Sản phẩm + Bài viết) vào chung file `sitemap.ts` (Dynamic Generator).
  - Kiểm tra log Warning của Tailwind v4 và config Lazy Loading Hình ảnh `<Image />`.

---

## Giai đoạn 4: Deployment & QA 
**Mục tiêu:** Thả xích dự án.

- [ ] **4.1. Smoke Test (Đa thiết bị)**
  - Khớp nối UI trên Mobile, Desktop và Tablet (iPad).
- [ ] **4.2. Triển khai Vercel**
  - Setting ENV Variables. Release Server `vercen --prod`.

---

## Next Actions (Phân công thực thi)

- **Claude Code:** Vui lòng bắt đầu Code **Giai đoạn 1** (Schema Blog, API TipTap Editor) _VÀ_ dứt điểm Nợ Cũ **1.4** (Gửi Reply Báo giá ở Admin). 
- **Tninie (Antigravity):** Chờ Claude Code ra API Blog. Trong thời gian chờ, Tninie sẽ chủ động chém trước **Giai đoạn 2.2, 2.3 và Toàn bộ Giai đoạn 3 (SEO Tuning)**.
