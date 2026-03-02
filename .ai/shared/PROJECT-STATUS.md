# PROJECT STATUS - Đông Phú Gia
> File này được cả Claude Code và Antigravity đọc/cập nhật
> Cập nhật mỗi khi bắt đầu và kết thúc session làm việc

## Cập nhật lần cuối
- **Ngày:** 02/03/2026
- **Agent:** Claude Code
- **Công việc:** Admin Gạch ốp lát — Refactor layout BST accordion

---

## Trạng thái hiện tại

### ✅ Hoàn thành
- Database schema mới (14 tables → 22 tables, snake_case, Int ID)
- Seed data: 5 pattern types, 35 collections, 60 products (Gạch ốp lát)
- **[02/03/2026] Schema TBVS: 8 bảng tbvs_ + 78 records seed**
- Public pages: Homepage, `/gach-op-lat`, `/gach-op-lat/[patternSlug]`, `/gach-op-lat/[patternSlug]/[productSlug]`
- Admin pages: Dashboard, Products CRUD, Collections CRUD, Pattern Types CRUD, Quote Requests, Banners
- Admin auth: HMAC cookie (ADMIN_PASSWORD + AUTH_SECRET)
- Fix bugs: PostgreSQL sequence out of sync, redirect() conflict, slugify đ/Đ
- Build PASS: 21 pages, 0 errors (02/03/2026)

### 🔔 Tin nhắn cho Antigravity

#### ✅ Đã hoàn thành — Schema TBVS (02/03/2026)

**Bảng mới (8 bảng prefix tbvs_):**
- `tbvs_brands` — 7 thương hiệu: TOTO, Inax, Kohler, American Standard, Viglacera, Caesar, Grohe
- `tbvs_product_types` — 8 loại SP: Bồn cầu, Vòi lavabo, Phụ kiện bồn cầu, Chậu rửa mặt, Vòi sen, Bồn tắm, Nắp bồn cầu, Phụ kiện phòng tắm
- `tbvs_subtypes` — 41 loại con dùng làm filter
- `tbvs_materials` — 7 chất liệu
- `tbvs_technologies` — 15 công nghệ (gắn với brand)
- `tbvs_products` — Bảng sản phẩm (chưa có data)
- `tbvs_product_technologies` — Quan hệ N-N
- `tbvs_product_images` — Ảnh phụ

**Dùng chung với Gạch ốp lát:** `colors` (8), `origins` (8), `product_categories`

**Category id=2 đã bật:** `is_active = TRUE`

**Prisma schema:** Đã pull + generate (23 models)

**Files SQL:** `prisma/migrations/tbvs-schema.sql`, `prisma/migrations/tbvs-seed.sql`

**URL Structure dự kiến:**
- `/thiet-bi-ve-sinh/` → Trang tổng (8 loại SP)
- `/thiet-bi-ve-sinh/bon-cau/` → Listing theo loại
- `/thiet-bi-ve-sinh/bon-cau/[productSlug]/` → Chi tiết SP

### ✅ Đã hoàn thành — Backend & Admin TBVS (02/03/2026)
- `src/lib/public-api-tbvs.ts` — 4 hàm: getTBVSTypes, getTBVSProducts (paginated), getTBVSProductBySlug, getRelatedTBVSProducts
- `src/lib/tbvs-actions.ts` — create/update/delete với Zod validation, Prisma.JsonNull
- Admin: `/admin/tbvs/products/` (list + new + [id] edit), form với multi-select technologies + JSON spec editor + ImageUploader
- Sidebar nav: link "TB Vệ sinh" (ShowerHead icon)
- Build PASS: 26 pages, 0 errors

### ✅ Đã hoàn thành — Schema Thiết bị bếp (02/03/2026)

**Bảng mới (5 bảng prefix bep_):**
- `bep_brands` — 9 thương hiệu: Teka, Malloca, Bosch, Electrolux, Hafele, Siemens, Faster, Canzy, Giovani
- `bep_product_types` — 10 loại SP: Bếp điện-Bếp từ, Bếp gas, Máy hút mùi, Máy rửa chén, Vòi rửa chén, Chậu rửa chén, Lò nướng, Lò vi sóng, Phụ kiện bếp, Tủ lạnh
- `bep_subtypes` — 17 loại con dùng làm filter
- `bep_products` — Bảng sản phẩm (chưa có data sản phẩm)
- `bep_product_images` — Ảnh phụ

**Dùng chung:** `colors`, `origins`, `product_categories`

**Category id=3 đã bật:** `is_active = TRUE`

**Prisma schema:** Đã pull + generate (28 models)

**Files SQL:** `prisma/migrations/bep-schema.sql`, `prisma/migrations/bep-seed.sql`

**URL Structure dự kiến:**
- `/thiet-bi-bep/` → Trang tổng (10 loại SP)
- `/thiet-bi-bep/bep-dien-bep-tu/` → Listing theo loại
- `/thiet-bi-bep/bep-dien-bep-tu/[productSlug]/` → Chi tiết SP

### ✅ Đã hoàn thành — Backend API + Admin CMS BEP (02/03/2026)
- `src/lib/public-api-bep.ts` — getBepTypes, getBepProducts (paginated+filter), getBepProductBySlug, getRelatedBepProducts
- `src/lib/bep-actions.ts` — createBepProduct, updateBepProduct, deleteBepProduct (Zod, Prisma.JsonNull)
- Admin `/admin/bep/products/` — list (filter by type) + new + [id] edit
- Form: dropdowns type→subtype, brand, color, origin; JSON spec editor; ImageUploader main/additional/hover
- Sidebar nav: "TB Bếp" (ChefHat icon)
- Build PASS: 29 pages, 0 errors

### 📋 API Handoff cho Antigravity (BEP)
Antigravity có thể dùng ngay các hàm sau từ `src/lib/public-api-bep.ts`:

| Hàm | Dùng cho |
|-----|---------|
| `getBepTypes()` | Sidebar filter — trả về types + subtypes + product count |
| `getBepProducts({ typeSlug?, subtypeSlug?, brandSlug?, page?, limit? })` | Product listing, paginated |
| `getBepProductBySlug(slug)` | Product detail — full relations (brand, color, origin, images) |
| `getRelatedBepProducts(typeId, excludeId, limit)` | "Sản phẩm liên quan" section |

**URL structure để build routes:**
- `/thiet-bi-bep` → listing tổng
- `/thiet-bi-bep/[typeSlug]` → listing theo loại (VD: `/thiet-bi-bep/bep-gas`)
- `/thiet-bi-bep/[typeSlug]/[productSlug]` → chi tiết SP

### ❌ Chưa làm (BEP)
- Public pages: listing, detail (Antigravity phụ trách)
- Seed sản phẩm mẫu

### ✅ Đã hoàn thành — Admin Gạch ốp lát BST Accordion (02/03/2026)

**Thay đổi:**
- `src/app/admin/(dashboard)/products/page.tsx` — Layout mới: accordion theo Bộ sưu tập thay cho flat list
- `src/app/admin/(dashboard)/products/products-accordion.tsx` — Client component: accordion, search, expand/collapse, delete BST/SP
- `src/app/admin/(dashboard)/products/collection-modal.tsx` — Modal tạo/sửa BST (không cần trang riêng)
- `src/app/admin/(dashboard)/sidebar-nav.tsx` — Xóa menu "Bộ sưu tập" và "Kiểu vân"
- `src/app/admin/(dashboard)/collections/page.tsx` — Redirect → `/admin/products`
- `src/app/admin/(dashboard)/pattern-types/page.tsx` — Redirect → `/admin/products`
- `src/lib/actions.ts` — Thêm `revalidatePath('/admin/products')` cho collection create/update/delete
- `src/app/(public)/thiet-bi-bep/page.tsx` — Fix type error `_count.products` → `_count.bep_products`

**Tính năng:**
- Accordion per BST: header (thumbnail + tên + count + edit/delete) + table SP khi expand
- Group cuối: "Sản phẩm chưa phân loại" (collection_id = null)
- Search client-side theo SKU/tên — auto-expand BST có kết quả, highlight từ khoá
- Modal create/edit BST với `key` prop để reset form khi chuyển collection
- Build PASS: **31 pages, 0 errors**

**Git:** Đã commit & push — xem bên dưới

---

## 🔔 Tin nhắn cho AI tiếp theo

### Kiến trúc quan trọng
- Server actions (`src/lib/actions.ts`) KHÔNG dùng `redirect()` — return `{ success: true }` và để client navigate
- `slugify()` đã fix để xử lý đ/Đ → d
- Admin hiện không có auth (TODO: re-enable NextAuth v5)
- Collection chỉ là filter qua query params — KHÔNG có trang riêng

### Schema changes (so với trước)
- 01/03/2026: Reset hoàn toàn, 14 tables, snake_case, Int SERIAL ID
- Thêm `quote_requests` table (sau reset)
- Không còn: Brand, Banner, Post, Partner, Project, AdminUser

---

## Files quan trọng cần đọc
1. `.ai/shared/WORKFLOW.md` - Quy trình làm việc
2. `.ai/shared/CONVENTIONS.md` - Quy tắc code
3. `.ai/shared/DATABASE-SCHEMA.md` - Schema hiện tại
4. `prisma/schema.prisma` - Prisma schema (source of truth)
5. `CLAUDE.md` (root, symlink → `.ai/claude/CLAUDE.md`) - Project instructions
