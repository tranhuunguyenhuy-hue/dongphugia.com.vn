# KẾ HOẠCH MVP LAUNCH — ĐÔNG PHÚ GIA

> **Mục tiêu**: Ra mắt website showcase gạch ốp lát tại `dongphugia.com.vn` trên Vercel.
> **Ngày tạo**: 01/03/2026  
> **Agents**: Tninie (Antigravity Orchestrator) + Claude Code (Executor)

---

## 📋 Tổng quan hiện trạng

### ✅ Đã hoàn thành
| Hạng mục | Chi tiết |
|---|---|
| **Database Schema** | 13 bảng PostgreSQL (snake_case, Int ID), seed 60 sản phẩm, 35 bộ sưu tập, 5 kiểu vân |
| **Prisma Schema** | `schema.prisma` đã sync từ Supabase, Prisma Client đã generate |
| **Public API** | `public-api.ts` — 9 hàm fetching data (categories, patterns, products, filters, related) |
| **Server Actions** | `actions.ts` — CRUD Products, Collections, PatternTypes, QuoteRequests + Zod validation |
| **Homepage** | Hero + Stats + Values + Pattern Types grid + Featured Products |
| **Admin Sidebar** | 5 nav links: Dashboard, Sản phẩm, Bộ sưu tập, Kiểu vân, Báo giá |
| **Admin Product Form** | Form tạo/sửa sản phẩm với đầy đủ lookups (patterns, collections, surfaces, sizes...) |
| **Header/Footer** | Layout công khai cơ bản (topbar + menu + mobile drawer) |
| **Gạch ốp lát routes** | `/gach-op-lat` (listing) → `/gach-op-lat/[patternSlug]` → `/gach-op-lat/[patternSlug]/[productSlug]` |

### ❌ Chưa hoàn thành / Cần kiểm tra
| Hạng mục | Vấn đề |
|---|---|
| **Auth (Admin)** | NextAuth đã bị xóa → Admin panel không có bảo vệ → Cần thiết lập lại |
| **Image Upload** | API `/api/upload` cần kiểm tra tương thích schema mới (Supabase Storage) |
| **Build test** | Chưa chạy `npm run build` → có thể còn lỗi import/type từ schema cũ |
| **SEO** | `sitemap.ts` đã sửa nhưng chưa verify; thiếu meta tags cho các trang public |
| **Responsive** | Chưa kiểm tra mobile cho tất cả các trang |
| **Admin pages** | Collections, PatternTypes, Quote-requests — cần verify CRUD hoạt động |
| **Product detail** | Components `product-detail-tabs.tsx`, `product-image-gallery.tsx` — cần verify |
| **Smart Filter** | `smart-filter.tsx` — cần verify hoạt động với schema mới |
| **Quote submission** | Form báo giá ở trang public — cần verify |
| **CLAUDE.md** | Thông tin cũ (còn reference auth, banner, post...) → Cần cập nhật |

---

## 🎯 Định nghĩa MVP

MVP = **Website có thể deploy lên Vercel**, người dùng cuối (khách hàng) có thể:

1. ✅ Xem trang chủ với sản phẩm nổi bật
2. ✅ Duyệt gạch ốp lát theo kiểu vân (Marble, Đá tự nhiên, Vân gỗ...)
3. ✅ Lọc sản phẩm theo bộ sưu tập, kích thước, bề mặt, màu sắc, xuất xứ
4. ✅ Xem chi tiết sản phẩm (ảnh, thông số, sản phẩm liên quan)
5. ✅ Gửi yêu cầu báo giá
6. ✅ Gọi điện tư vấn (CTA nổi bật)
7. ✅ Admin có thể quản lý sản phẩm, bộ sưu tập, kiểu vân, báo giá

**Ngoài phạm vi MVP** (làm sau):
- Đăng tin tức / Blog
- Đối tác / Dự án showcase
- Danh mục khác (TB vệ sinh, TB bếp, Sàn gỗ)
- Search toàn cục
- Analytics / Tracking

---

## 🗂️ Phân chia Phases

### Phase 1: Build Verification & Bug Fix (Ưu tiên: 🔴 Cao nhất)

> **Mục tiêu**: Code build thành công, không có lỗi runtime.
> **Agent chính**: Claude Code  
> **Agent review**: Tninie

| # | Task | File(s) liên quan | Ước tính |
|---|---|---|---|
| 1.1 | Chạy `npm run build` và fix tất cả lỗi TypeScript/import | Toàn bộ `src/` | 30-60 min |
| 1.2 | Xóa các import/reference đến modules đã xóa (auth, banner, post...) | `tsconfig.json`, `next.config.ts`, các file còn lại | 15 min |
| 1.3 | Verify Prisma Client generate thành công | `prisma/schema.prisma` | 5 min |
| 1.4 | Chạy `npm run dev` và confirm trang chủ load được | — | 10 min |

**Tiêu chí hoàn thành**: `npm run build` pass 0 errors.

---

### Phase 2: Public Frontend — Verify & Polish (Ưu tiên: 🔴 Cao)

> **Mục tiêu**: Tất cả trang công khai hoạt động đúng và đẹp.
> **Agent chính**: Claude Code (code) + Tninie (review UI/UX)

| # | Task | File(s) | Ước tính |
|---|---|---|---|
| 2.1 | Verify Homepage render đúng (Pattern Types, Featured Products) | `(public)/page.tsx` | 15 min |
| 2.2 | Verify trang listing `/gach-op-lat` (danh sách kiểu vân) | `(public)/gach-op-lat/page.tsx` | 15 min |
| 2.3 | Verify trang `/gach-op-lat/[patternSlug]` (filter + products grid) | `[patternSlug]/page.tsx`, `smart-filter.tsx` | 30 min |
| 2.4 | Verify trang chi tiết `/gach-op-lat/[patternSlug]/[productSlug]` | `[productSlug]/page.tsx`, `product-detail-tabs.tsx`, `product-image-gallery.tsx` | 30 min |
| 2.5 | Verify `ProductCard` hiển thị đúng (ảnh, tên, giá, badge) | `components/ui/product-card.tsx` | 15 min |
| 2.6 | Verify form Báo giá (public) hoạt động — submit + lưu DB | `actions.ts` (`submitQuoteRequest`) | 20 min |
| 2.7 | Responsive check: Mobile + Tablet cho tất cả trang public | Tất cả trang `(public)/` | 30 min |
| 2.8 | SEO: Meta tags (title, description) cho mỗi trang public | Mỗi `page.tsx` — thêm `generateMetadata()` | 30 min |
| 2.9 | Verify `sitemap.ts` output đúng URL mới | `src/app/sitemap.ts` | 10 min |

**Tiêu chí hoàn thành**: Tất cả trang public load đúng data, responsive tốt, không 404/500.

---

### Phase 3: Admin Panel — Verify & Secure (Ưu tiên: 🟡 Trung bình-Cao)

> **Mục tiêu**: Admin CMS hoạt động đầy đủ CRUD với bảo vệ cơ bản.
> **Agent chính**: Claude Code  
> **Agent review**: Tninie (security + UX)

| # | Task | File(s) | Ước tính |
|---|---|---|---|
| 3.1 | Thiết lập Auth bảo vệ admin — phương án đơn giản nhất cho MVP | `admin/` layout, middleware | 60 min |
| 3.2 | Verify Dashboard page render (thống kê cơ bản) | `admin/(dashboard)/page.tsx` | 15 min |
| 3.3 | Verify CRUD Products (list, create, edit, delete) | `admin/products/` | 30 min |
| 3.4 | Verify CRUD Collections | `admin/collections/` | 20 min |
| 3.5 | Verify CRUD Pattern Types | `admin/pattern-types/` | 20 min |
| 3.6 | Verify Quote Requests management (list, update status) | `admin/quote-requests/` | 15 min |
| 3.7 | Verify Image Upload API (`POST /api/upload`) hoạt động | `api/upload/route.ts` | 15 min |
| 3.8 | Admin UI polish — loading states, toast messages, error handling | Tất cả admin pages | 30 min |

**Tiêu chí hoàn thành**: Admin CRUD hoạt động, có auth protection cơ bản.

---

### Phase 4: Pre-Deploy Checklist (Ưu tiên: 🟡 Trung bình)

> **Mục tiêu**: Sẵn sàng deploy lên Vercel.
> **Agent chính**: Tninie (audit) + Claude Code (fix)

| # | Task | Chi tiết | Ước tính |
|---|---|---|---|
| 4.1 | Security audit nhanh | Kiểm tra env vars, SQL injection (Prisma OK), XSS, CORS | 20 min |
| 4.2 | Performance check | Image optimization (next/image), revalidate config, bundle size | 15 min |
| 4.3 | Cập nhật `CLAUDE.md` theo đúng trạng thái mới | Xóa reference cũ, thêm modules mới | 15 min |
| 4.4 | Cập nhật `robots.txt` + `favicon` | `public/` | 10 min |
| 4.5 | Cấu hình Vercel env vars | DATABASE_URL, DIRECT_URL, AUTH_SECRET | 10 min |
| 4.6 | Test build final: `npm run build` clean pass | — | 10 min |

**Tiêu chí hoàn thành**: Build sạch, env vars config, sẵn sàng `vercel --prod`.

---

### Phase 5: Deploy & Verify Production (Ưu tiên: 🟢 Thấp nhất — chỉ làm khi P1-P4 xong)

> **Mục tiêu**: Website live trên Vercel.
> **Agent**: User chủ trì + cả 2 agents hỗ trợ

| # | Task | Chi tiết |
|---|---|---|
| 5.1 | Deploy lên Vercel | `vercel --prod` |
| 5.2 | Verify production — tất cả trang public | Browser test |
| 5.3 | Verify production — admin CRUD | Browser test |
| 5.4 | Cấu hình domain `dongphugia.com.vn` | Vercel DNS settings |
| 5.5 | SSL / HTTPS verify | Tự động bởi Vercel |

---

## 👥 Phân công Agent

### Tninie (Antigravity Orchestrator)
**Vai trò**: Kiến trúc sư / Reviewer / Quality Gate

- Lập kế hoạch và phân công task (file này)
- Review code changes trước khi merge
- Security audit (Phase 4.1)
- UI/UX review (responsive, design consistency)
- Cập nhật tài liệu (CLAUDE.md, PLAN)
- Gợi ý hành động tiếp theo khi bắt đầu session mới

### Claude Code (Executor)
**Vai trò**: Lập trình viên chính / Executor

- Fix build errors (Phase 1)
- Verify + fix tất cả trang public (Phase 2)
- Verify + fix admin CRUD (Phase 3)
- Implement Auth protection (Phase 3.1)
- SEO meta tags (Phase 2.8)
- Pre-deploy fixes (Phase 4)

---

## 🔄 Quy trình phối hợp giữa 2 Agents

### Khi bắt đầu session mới
1. **Đọc file này** (`docs/PLAN-mvp-launch.md`) để biết bước tiếp theo
2. **Đọc `CLAUDE.md`** để nắm context kỹ thuật
3. **Kiểm tra Phase nào đang active** (xem phần Progress Tracker bên dưới)
4. **Bắt đầu task tiếp theo** trong Phase đang active

### Khi hoàn thành một task
1. Cập nhật **Progress Tracker** bên dưới (đánh dấu ✅)
2. Ghi chú ngắn về kết quả (OK / có vấn đề gì)
3. Chuyển sang task tiếp theo trong cùng Phase

### Khi Phase hoàn thành
1. **Tninie review** toàn bộ Phase
2. Nếu có vấn đề → tạo task fix bổ sung
3. Nếu OK → chuyển sang Phase tiếp theo

---

## 📊 Progress Tracker

### Phase 1: Build Verification & Bug Fix
- [x] 1.1 — `npm run build` fix errors → **PASS** (0 errors, 14/14 pages, 01/03/2026)
- [x] 1.2 — Xóa import/reference cũ → **OK** (tsconfig đã exclude backups/, scripts/ — không có stale imports)
- [x] 1.3 — Prisma generate OK → **PASS**
- [x] 1.4 — Dev server chạy OK → **PASS** (build 14/14 pages, Prisma OK, 01/03/2026)

### Phase 2: Public Frontend
- [ ] 2.1 — Homepage
- [ ] 2.2 — Listing gạch ốp lát
- [ ] 2.3 — Pattern type + filter
- [ ] 2.4 — Product detail
- [ ] 2.5 — ProductCard component
- [ ] 2.6 — Form báo giá
- [ ] 2.7 — Responsive check
- [ ] 2.8 — SEO meta tags
- [ ] 2.9 — Sitemap

### Phase 3: Admin Panel
- [x] 3.1 — Auth protection → **DONE** (HMAC cookie, login page, logout, layout check — 01/03/2026) ⚠️ Cần thêm `ADMIN_PASSWORD=...` vào `.env`
- [x] 3.2 — Dashboard → **OK** (queries đúng schema, thống kê + tables, 01/03/2026)
- [x] 3.3 — CRUD Products → **OK** (fix: deleteProduct trả về `{ success: true }`)
- [x] 3.4 — CRUD Collections → **OK** (fix: deleteCollection trả về `{ success: true }`)
- [x] 3.5 — CRUD Pattern Types → **OK** (không có delete button — intentional, actions đúng)
- [x] 3.6 — Quote Requests → **OK** (list + filter tabs + status buttons đầy đủ)
- [x] 3.7 — Image Upload → **DONE** (Thay đổi quyết định: Đã tích hợp `ImageUploader` và Supabase Storage trực tiếp vào Admin Form thay vì dùng URL ngoài. Hỗ trợ multi-image và chọn ảnh Thumbnail)
- [x] 3.8 — UI polish → **OK** (code review cho thấy loading states + toasts đã có)

### Feature: Product Detail & Image Upload (02/03/2026)
- [x] API & Component Admin: Thay input văn bản cho Link ảnh bằng module `ImageUploader` hỗ trợ kéo/thả, up nhiều ảnh, chọn Thumbnail chính.
- [x] API Public: Sửa hàm `getProductBySlug` và tạo hàm `getRelatedProductsInCollection` lấy nhóm sản phẩm cùng mã.
- [x] Cải tiến Layout UI (Frontend): Gò form Info bên phải (Giá, SKU, Size, Box) vừa đúng 1 view màn hình.
- [x] Related Variants: Tích hợp list SKU pill badge bấm được cho các sản phẩm cùng Collection.

### Feature: Banner Management (01/03/2026)
- [x] DB: model `banners` thêm vào schema.prisma + `prisma db push` → table tạo thành công
- [x] API: `getBanners()` thêm vào `public-api.ts`
- [x] Actions: `createBanner`, `updateBanner`, `deleteBanner` trong `actions.ts`
- [x] Admin CRUD: `/admin/banners` (list + create + edit + delete)
- [x] Sidebar: thêm nav link "Banners" (icon: Image)
- [x] Build: PASS (20 pages, 0 errors)

### Phase 4: Pre-Deploy
- [x] 4.1 — Security audit → **DONE** (01/03/2026)
  - ✅ `.env` không bị git track (verified `git ls-files`)
  - ✅ Không có API key/secret hardcode trong src/ (grep clean)
  - ✅ Admin routes `/admin/*` đều protected qua `(dashboard)/layout.tsx`
  - ✅ FIX: `admin-auth.ts` — xóa `dev-fallback-secret` hardcoded; nếu `AUTH_SECRET` không set → `getExpectedToken()` trả về `null` → không session nào valid
  - ✅ FIX: `login/actions.ts` — kiểm tra `AUTH_SECRET` có set trước khi cho login
  - ⚠️ ENV cần có trước khi deploy: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `ADMIN_PASSWORD`
- [x] 4.2 — Performance check → **DONE** (01/03/2026)
  - ✅ `revalidate = 3600` có trên tất cả 4 public pages (`/`, `/gach-op-lat`, `/[patternSlug]`, `/[productSlug]`)
  - ✅ Hero banner images: `priority` + `fill` (LCP ảnh được ưu tiên)
  - ✅ Header logo: `priority`
  - ✅ Product detail main image: `priority` + `fill`
  - ✅ Collection carousel: `width/height` explicit (không dùng fill)
  - ✅ Pattern type listing: `width/height` explicit
  - ✅ FIX: `product-card.tsx` — thêm `sizes` cho `<Image fill>` (trước đó tải 100vw mặc định)
  - ✅ FIX: `product-image-gallery.tsx` thumbnails — thêm `sizes="(max-width: 640px) 80px, (max-width: 1024px) 120px, 174px"`
- [x] 4.3 — CLAUDE.md update → **DONE** (01/03/2026) — CLAUDE.md updated: lessons learned section added (Server Actions, Public API caching, Supabase connection, next/image sizes, auth HMAC pattern, slugify fix)
- [x] 4.4 — robots.txt + favicon → **DONE** (01/03/2026) — `public/robots.txt` created (blocks /admin/, /api/; points to sitemap)
- [x] 4.5 — Vercel env config → **DONE** (01/03/2026) — `docs/config-vercel.txt` created with all 5 env vars (DATABASE_URL, DIRECT_URL, AUTH_SECRET, ADMIN_PASSWORD, NEXT_PUBLIC_SITE_URL) + deploy checklist
- [x] 4.6 — Final build test → **PASS** (01/03/2026) — 21 pages, 0 errors (2 static + 17 dynamic + sitemap), compiled in 2.7s

### Phase 5: Deploy
- [ ] 5.1 — Deploy Vercel
- [ ] 5.2 — Verify public pages
- [ ] 5.3 — Verify admin
- [ ] 5.4 — Domain config
- [ ] 5.5 — SSL verify

---

## ✅ Quyết định đã xác nhận (01/03/2026)

| Hạng mục | Quyết định | Ghi chú |
|---|---|---|
| **Auth Admin** | **Option C — Simple env password** | Dùng biến `ADMIN_PASSWORD` trong `.env`, middleware check cookie/session đơn giản |
| **Image Storage** | **Đã tích hợp (Thay đổi quyết định)** | Tích hợp thành công component Upload trực tiếp lên Supabase bên trong Admin Panel `product-form.tsx` hỗ trợ multiple files + Radio xác định Main Ảnh. |
| **Domain** | **Dùng URL Vercel tạm** | Không cần config DNS `dongphugia.com.vn` cho MVP |

---

*Plan này được tạo bởi Tninie (Antigravity Orchestrator) — 01/03/2026*
*Cả Tninie và Claude Code đều sử dụng file này làm nguồn sự thật (source of truth) cho tiến độ MVP.*
