# TASK QUEUE - Đông Phú Gia

> Danh sách công việc cần làm, đang làm, và đã hoàn thành
> Cập nhật: 01/03/2026

---

## 🔥 Ưu tiên cao (làm ngay)

- [ ] Test toàn bộ CRUD: Products, Collections, Pattern Types sau fix bug
- [ ] Kiểm tra form báo giá hoạt động đúng (public page + admin)
- [ ] Test image URL input (ảnh chính, ảnh hover, ảnh phụ)

## 📋 Cần làm (theo thứ tự)

### Backend
- [ ] Review và tối ưu Prisma queries (N+1 queries)
- [ ] Error handling tốt hơn cho form validation
- [ ] API route cho image upload (Supabase Storage)

### Frontend Public
- [ ] Kiểm tra SmartFilter hoạt động đúng (màu, bề mặt, kích thước, xuất xứ, vị trí)
- [ ] Responsive design cho mobile
- [ ] Loading skeleton cho product grid
- [ ] SEO meta tags (`generateMetadata`) cho `/gach-op-lat/[patternSlug]/[productSlug]`
- [ ] Open Graph images

### Frontend Admin
- [ ] Auth protection cho admin routes (re-enable NextAuth v5 — hiện có TODO comment)
- [ ] Image upload UI (thay URL input bằng file upload)
- [ ] Pagination cho products list (hiện load hết)
- [ ] Search trong admin products

### DevOps
- [ ] Cấu hình Vercel environment variables
- [ ] Deploy production với schema mới
- [ ] Cấu hình 301 redirects (38 records đã có trong `redirects` table)

## ⏸️ Blocked (chờ xử lý trước)

- [ ] Deploy production — chờ test CRUD xong + fix auth

## ✅ Hoàn thành

- [x] Reset database với schema mới (14 tables, snake_case, Int ID)
- [x] Tạo seed data (60 products, 35 collections, 5 pattern types)
- [x] Public pages: Homepage, Category, Pattern Type, Product Detail
- [x] Admin pages: Dashboard, Products, Collections, Pattern Types, Quote Requests, Banners
- [x] Admin auth: HMAC cookie (ADMIN_PASSWORD + AUTH_SECRET)
- [x] Server actions CRUD (actions.ts)
- [x] Quote requests table + form + admin management
- [x] Fix bug tạo sản phẩm (redirect() conflict → return { success: true })
- [x] Fix slugify() cho ký tự đ/Đ
- [x] Fix error messages P2002 (SKU vs Slug distinction)
- [x] Fix PostgreSQL sequence out of sync (sau seed với explicit IDs)
- [x] Cấu trúc .ai/ cho collaboration
- [x] **Thiết kế schema TBVS (Antigravity/Opus)**
- [x] **Triển khai schema TBVS vào database (Claude Code — 02/03/2026)**
  - 8 bảng tbvs_, indexes, sequences
  - 78 records seed: 7 brands, 8 product types, 41 subtypes, 7 materials, 15 technologies
  - Prisma schema updated (23 models)

## ✅ Hoàn thành (TBVS Backend & Admin — 02/03/2026)
- [x] `src/lib/public-api-tbvs.ts` — getTBVSTypes, getTBVSProducts (paginated+filter), getTBVSProductBySlug, getRelatedTBVSProducts
- [x] `src/lib/tbvs-actions.ts` — createTBVSProduct, updateTBVSProduct, deleteTBVSProduct
- [x] Admin pages: `/admin/tbvs/products/` (list + new + [id] edit)
- [x] Form: multi-select technologies, JSON spec editor, ImageUploader main/additional/hover
- [x] Sidebar nav: "TB Vệ sinh" link

## ✅ Hoàn thành (Schema BEP — 02/03/2026)
- [x] Thiết kế schema Thiết bị bếp (Opus/Antigravity)
- [x] Triển khai schema BEP vào database (Claude Code)
  - 5 bảng bep_, indexes, sequences reset
  - Seed: 9 brands, 10 product_types, 17 subtypes
  - Category id=3 is_active = TRUE
  - Prisma schema updated (28 models)

## ✅ Hoàn thành (BEP Backend & Admin — 02/03/2026)
- [x] `src/lib/public-api-bep.ts` — getBepTypes, getBepProducts (paginated+filter), getBepProductBySlug, getRelatedBepProducts
- [x] `src/lib/bep-actions.ts` — createBepProduct, updateBepProduct, deleteBepProduct
- [x] Admin pages: `/admin/bep/products/` (list + new + [id] edit)
- [x] Form: dropdowns type→subtype, brand, color, origin; JSON spec editor; ImageUploader main/additional/hover
- [x] Sidebar nav: "TB Bếp" link (ChefHat icon)
- [x] Build PASS: 29 pages, 0 errors

## 📋 Cần làm tiếp
- [ ] Public routes `/thiet-bi-bep/` (Antigravity phụ trách Frontend)
- [ ] Public routes `/thiet-bi-ve-sinh/` (Antigravity phụ trách Frontend)
- [ ] Seed sản phẩm mẫu BEP + TBVS

---

## 📝 Notes kỹ thuật

- Schema mới: snake_case, Int SERIAL ID, 14 tables
- Server actions KHÔNG dùng `redirect()` — return `{ success: true }` để client navigate
- `slugify("Đá")` → `"da"` (đã fix, trước đó → `"a"`)
- Collection chỉ là filter, KHÔNG có trang riêng
- Tailwind v4: config trong `globals.css` @theme block, không có `tailwind.config.js`
