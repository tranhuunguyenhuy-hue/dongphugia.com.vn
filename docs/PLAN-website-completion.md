# Kế hoạch hoàn thiện toàn bộ Website (Website Completion Plan)

**Mục tiêu:** Đưa dự án từ trạng thái hiện tại (hoàn thiện Gạch ốp lát & Thiết bị vệ sinh) đến điểm 100% hoàn tất bao gồm toàn bộ danh mục sản phẩm, tính năng Báo giá, chuẩn hóa UI/UX Admin và tối ưu SEO Front-end trước khi Deploy lên Vercel.

---

## Giai đoạn 1: Backend & Admin CMS Coverage (Claude Code)
**Mục tiêu:** Mở khóa toàn bộ các trang quản trị còn thiếu và cung cấp API cho Frontend.

- [x] **1.1. Hoàn thiện Admin & API Thiết bị Bếp** *(Hoàn thành 02/03/2026)*
  - `src/lib/public-api-bep.ts` ✅ (4 hàm cache)
  - `src/lib/bep-actions.ts` ✅ (createBepProduct, updateBepProduct, deleteBepProduct)
  - Admin CMS `/admin/bep/products/*` ✅ (list + new + [id] + delete button)
  - Build PASS ✅
- [x] **1.2. Mở khóa 2 Danh mục cuối cùng** *(Hoàn thành 02/03/2026)*
  - **Vật liệu nước**: 6 bảng `nuoc_`, 7 brands, 6 types, 15 subtypes, 3 materials. API + Actions + Admin `/admin/nuoc/products/*` ✅
  - **Sàn gỗ**: 3 bảng `sango_`, 2 types, fields đặc thù (thickness_mm, ac_rating...). API + Actions + Admin `/admin/sango/products/*` ✅
  - Build PASS 37 models ✅
- [ ] **1.3. Tính năng Báo Giá nâng cao**
  - Viết logic gửi Reply (Email) cho chức năng Báo giá tại Admin.
  - Hoàn thiện UI Dashboard Báo giá: View chi tiết yêu cầu, Cập nhật trạng thái (Pending -> Replied -> Closed).

---

## Giai đoạn 2: Frontend & Client UI (Antigravity/Tninie)
**Mục tiêu:** Phủ sóng toàn bộ trang hiển thị sản phẩm cho khách hàng, đảm bảo UI/UX mượt mà chuẩn Figma.

- [x] **2.1. Frontend Thiết bị Bếp** *(Hoàn thành)*
  - Xây dựng route `src/app/(public)/thiet-bi-bep/page.tsx` (Tích hợp SmartFilter & Layout 4 cột) ✅
  - Xây dựng route Chi tiết `src/app/(public)/thiet-bi-bep/[typeSlug]/[productSlug]/page.tsx` (Gallery + Tabs thông số + Quote Form) ✅
- [ ] **2.2. Frontend Ngành Nước & Sàn Gỗ**
  - [x] Vật liệu ngành nước (Hoàn thành Layout + Filter + Detail + Báo giá) ✅
  - [ ] Sàn gỗ / Sàn nhựa (Đang chờ triển khai UI hiển thị và chi tiết sản phẩm).
- [ ] **2.3. Hoàn thiện Báo Giá Client-side**
  - Gắn form Báo giá động vào từng sản phẩm (Gạch, Vệ sinh, Bếp, Nước, Sàn gỗ).
  - Hiệu ứng feedback (Toast success) khi khách tải xong yêu cầu.
- [ ] **2.4. Audit giao diện Admin "Pro Max"**
  - Rà soát lại animation, hover effects, gradient cho các trang: Banners, Bài viết, Dự án, Đối tác.

---

## Giai đoạn 3: SEO & Performance Optimization (Phối hợp)
**Mục tiêu:** Sẵn sàng cho Production (Google Indexing & Fast Loading).

- [ ] **3.1. Technical SEO**
  - Bổ sung Dynamic Metadata (`generateMetadata` trong Next.js) cho trang Danh mục, Bộ sưu tập và Chi tiết sản phẩm.
  - Thêm Open Graph (OG) Images cho các trang chính.
  - Tích hợp Structured Data (JSON-LD) cho Product Schema.
  - Chỉnh sửa `sitemap.ts` tự động map toàn bộ URL sản phẩm.
- [ ] **3.2. Tối ưu Hiệu năng**
  - Quét qua Tailwind v4 và kiểm tra console loại bỏ warning.
  - Kiểm tra Next/Image Optimization (Lazy loading hình ảnh dự án, logo brand).
  - Tối ưu Caching chiến lược (Revalidate paths hợp lý).

---

## Giai đoạn 4: QA & Deployment (Release)
**Mục tiêu:** Live website ổn định.

- [ ] **4.1. Audit & Bug Squashing**
  - Kiểm tra end-to-end user flow: Tìm kiếm -> Filter -> Xem chi tiết -> Báo giá.
  - Rà soát lỗi responsive trên Mobile/Tablet.
- [ ] **4.2. Triển khai (Deployment)**
  - Push toàn bộ code cuối cùng lên GitHub (main branch).
  - Cấu hình Environment Variables (`DATABASE_URL`, `AUTH_SECRET`, etc.) trên Vercel.
  - Deploy bản Production `vercen --prod`.
  - Smoke test trên domain thực tế.

---

### Phân công tức thì (Next Actions — cập nhật 02/03/2026)
- **Claude Code:** Backend 5/5 danh mục đã xong. Tiến hành **Giai đoạn 1.3** (Reply Báo giá tại Admin CMS).
- **Tninie:** Tiến hành **Frontend Sàn Gỗ** (Hoàn thiện Giai đoạn 2.2).
