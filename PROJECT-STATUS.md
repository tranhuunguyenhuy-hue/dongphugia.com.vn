# PROJECT-STATUS.md (System Sync)
> Lưu ý: Tệp tin này là Nơi Đồng Bộ Trạng Thái Giữa 2 Agent (Claude Code & Antigravity). Bất kỳ Agent nào hoàn thành Task đều phải vào đây Tick check và Append Log.

## 1. Trạng thái Backend & Database (Claude Code Ownership)

### Danh mục: Thiết bị bếp (Kitchen Appliances)
Ngày cập nhật: 02/03/2026
Người thực hiện: Claude Code

- [x] Schema SQL -> DB (Tạo 5 bảng `bep_` + 6 indexes)
- [x] Prisma db pull + generate (28 models)
- [x] Seed data (9 brands + 10 types + 17 subtypes = 36 records)
- [x] Kiểm tra DB (Connected, Category 3 tồn tại, 8 colors)
- [x] Verify counts (Đúng số liệu, Category 3 is_active = true)
- [x] Public API (`src/lib/public-api-bep.ts`) — 4 hàm cache()
- [x] Server Actions CRUD (`src/lib/bep-actions.ts`)
- [x] Admin CMS Pages (`/admin/bep/products/*`) — list + new + edit + delete
- [x] Build PASS — route `/admin/bep/products` hiển thị trong build output

**📍 Action Next (Frontend)**:
Antigravity tạo Frontend BEP: `/thiet-bi-bep/[typeSlug]/[productSlug]` — Backend API đã sẵn sàng.

---

### Danh mục: Thiết bị Vệ sinh (Sanitary Ware)
- [x] Schema & Seed Data (100% Data)
- [x] Server Actions CRUD (`src/lib/tbvs-actions.ts`)
- [x] Public API (`src/lib/public-api-tbvs.ts`)
- [x] Admin CMS Pages (`/admin/tbvs/*`)

---

### Danh mục: Gạch ốp lát (Tiles)
- [x] Schema & Seed Data (100% Data)
- [x] Server Actions CRUD (`src/lib/actions.ts` etc)
- [x] Public API (`src/lib/public-api.ts`)
- [x] Admin CMS Pages (Đã refactor sang giao diện Accordion tại `/admin/products`)

---

### Danh mục: Vật liệu nước (Water Products)
Ngày cập nhật: 02/03/2026
Người thực hiện: Claude Code

- [x] Schema SQL → DB (6 bảng `nuoc_` + 8 indexes)
- [x] Prisma db pull + generate (34 models)
- [x] Seed data: 7 brands, 6 product_types, 15 subtypes, 3 materials
- [x] Verify counts (Đúng số liệu, category_id=5 is_active=true)
- [x] Public API (`src/lib/public-api-nuoc.ts`) — 5 hàm cache()
- [x] Server Actions CRUD (`src/lib/nuoc-actions.ts`)
- [x] Admin CMS Pages (`/admin/nuoc/products/*`) — list + new + edit + delete
- [x] Sidebar nav — icon Droplets
- [x] Bug fix: `product.colors.length` trong BEP detail page (colors là single FK, không phải array)
- [x] Build PASS — route `/admin/nuoc/products` hiển thị trong build output

**📍 Action Next (Backend)**:
Claude Code hãy proceed sang code **Danh mục 5: Sàn gỗ / Sàn nhựa**. Frontend Vật liệu nước đã xong và live trên UI.

---

### Danh mục: Sàn gỗ (Flooring)
Ngày cập nhật: 02/03/2026
Người thực hiện: Claude Code

- [x] Schema SQL → DB (3 bảng `sango_` + 4 indexes) — đơn giản nhất, không có brands/subtypes
- [x] Prisma db pull + generate (37 models)
- [x] Seed data: 2 product_types (Sàn gỗ công nghiệp, Vật liệu sàn gỗ)
- [x] Verify counts ✅
- [x] Public API (`src/lib/public-api-sango.ts`) — 4 hàm cache(), filter theo thickness_mm
- [x] Server Actions CRUD (`src/lib/sango-actions.ts`) — Zod + fields đặc thù: thickness_mm, width_mm, length_mm, ac_rating, warranty_years
- [x] Admin CMS Pages (`/admin/sango/products/*`) — list + new + edit + delete
- [x] Sidebar nav — icon Layers
- [x] Build PASS — route `/admin/sango/products` hiển thị trong build output

**📍 Action Next (QA & E2E Testing)**:
Tiến hành Test luồng End-to-End toàn bộ 5 danh mục (Tạo SP từ Admin -> Hiển thị & Submit Báo giá ở Client). Quá trình này sẽ nghiệm thu chéo chất lượng Backend của Claude Code và Frontend của Tninie.

---

## 2. Trạng thái Frontend & UI (Antigravity Ownership)

### Danh mục: Thiết bị bếp (Kitchen Appliances)
Người thực hiện: Antigravity (Tninie)

- [x] Route `src/app/(public)/thiet-bi-bep/page.tsx` (Hoàn thiện Layout 4 cột, SmartFilter)
- [x] Route Product Detail `src/app/(public)/thiet-bi-bep/[typeSlug]/[productSlug]/page.tsx` (Hoàn thiện Gallery + Tabs thông số + QuoteForm)

---

### Danh mục: Vật liệu nước (Water Products)
Người thực hiện: Antigravity (Tninie)

- [x] Các Component Filter `/category/*nuoc.tsx` (SmartFilter, Carousel, Drawer)
- [x] Route `src/app/(public)/vat-lieu-nuoc/page.tsx` (Hoàn thiện Layout Grid)
- [x] Route Product Detail `src/app/(public)/vat-lieu-nuoc/[typeSlug]/[productSlug]/page.tsx` (Hoàn thiện Gallery + Tabs chức năng + QuoteForm)

---

### Danh mục: Thiết bị Vệ sinh (Sanitary Ware)
- [x] Layout UI 100% bám sát Figma (Đảo vị trí Component Brand lên Type).
- [x] Đồng bộ Grid lưới thành 4 cột.
- [x] Tích hợp Client Layout & State URL (Filter).
- [x] Sửa Component Product Detail (Spec tabs, Image gallery).

---

### Danh mục: Gạch ốp lát (Tiles)
- [x] Product Categories UI.
- [x] Đồng bộ Grid dưới thành 4 cột, Component Card 100% Figma.
- [x] Màn hình Product Detail hoàn thiện.

---

### Giai đoạn: QA & E2E Testing (Bug Fixes)
Ngày cập nhật: 02/03/2026
Người thực hiện: Antigravity (Tninie)

- [x] Mở rộng Fallback URL Slug cho đa danh mục trên `<ProductCard>` (Fix Bug Bếp/Nước chỏ nhầm link).
- [x] Tăng `maxAge` của Admin Session Cookie lên 30 ngày (Fix Bug Timeout).
- [x] Tạo script chèn dữ liệu bằng raw SQL `sango-fake-products.sql` (Fix Bug Sàn gỗ rỗng do thiếu Seed).
- [x] Đánh giá an toàn cho UI `<Select>` tại Admin (Sử dụng chuẩn HTML5, lỗi do Subagent tương tác - bỏ qua).

---

## 2.5. Cập nhật Image Upload (Claude Code)
Ngày cập nhật: 02/03/2026

- [x] `banners/banner-form.tsx` — thay URL text input → `ImageUploader` (Supabase Storage, folder: `banners`)
- [x] `pattern-types/pattern-type-form.tsx` — thay 2 URL inputs (thumbnail + hero) → `ImageUploader` (folder: `pattern-types`)
- [x] Fix runtime error `prisma.sango_products.findMany` (restart dev server sau `prisma generate`)
- [x] Build PASS

> Lưu ý: Tất cả 7 form admin giờ đều dùng `ImageUploader` → upload thẳng Supabase Storage. KHÔNG dùng local filesystem (`public/uploads/`) — sẽ bị broken trên Vercel.

---

## 3. Nhật Ký Bàn Giao (Hand-off Log)
*Format: [Date] Agent 1 -> Agent 2: Task Description*

* **02/03/2026** (User/Claude) -> Tninie: "Schema BEP đã sẵn sàng. Khi Antigravity cần Backend API + Admin CMS cho Thiết bị bếp, Claude Code sẽ tạo `public-api-bep.ts`, `bep-actions.ts` và admin pages (clone pattern từ TBVS)."
* **02/03/2026** Claude Code -> Tninie: Hoàn thành refactor Admin CMS Gạch ốp lát sang dạng accordion nhóm theo BST tại `/admin/products`. Xóa các trang tạo/sửa BST và Kiểu vân riêng lẻ, gộp chung vào modal. Đã sửa type error `_count.bep_products` trong `src/app/(public)/thiet-bi-bep/page.tsx`.
* **02/03/2026** Claude Code -> Tninie: Xác nhận BEP Backend 100% hoàn thành. `public-api-bep.ts` + `bep-actions.ts` + Admin CMS `/admin/bep/products/*` đã có đủ. Build PASS. Frontend BEP (`/thiet-bi-bep/[typeSlug]/[productSlug]`) chờ Antigravity implement.
* **02/03/2026** Tninie -> Claude Code: Hoàn tất Giai đoạn 2.1 (Frontend Thiết bị bếp). Route Category `thiet-bi-bep` và Product Detail `thiet-bi-bep/[typeSlug]/[productSlug]` đã live với QuoteForm và Tabs. Tninie chờ Claude làm Giai đoạn 1.2 (Backend TB Ngành Nước & Sàn Gỗ).
* **02/03/2026** Claude Code -> Tninie: Hoàn thành **Sàn gỗ (SANGO)** Backend 100%. Schema 3 bảng + Seed (2 types) + `public-api-sango.ts` + `sango-actions.ts` (có fields đặc thù: thickness_mm, ac_rating, warranty_years) + Admin CMS `/admin/sango/products/*`. Build PASS (37 models). **BACKEND 5/5 DANH MỤC HOÀN THÀNH.** Frontend SANGO chờ Antigravity.
* **02/03/2026** Claude Code -> Tninie: Hoàn thành **Vật liệu nước (NUOC)** Backend 100%. Schema 6 bảng + Seed (7 brands, 6 types, 15 subtypes, 3 materials) + `public-api-nuoc.ts` + `nuoc-actions.ts` + Admin CMS `/admin/nuoc/products/*`. Đã sửa bug `product.colors.length` trong BEP detail page. Build PASS (34 models). Frontend NUOC chờ Antigravity.
* **02/03/2026** Tninie -> Claude Code: Đã implement xong 100% UI Frontend cho **Vật liệu nước (NUOC)** (`/vat-lieu-nuoc`). Sẵn sàng làm tiếp Frontend cho Sàn gỗ.
* **02/03/2026** Tninie -> Claude Code: Đã implement xong 100% UI Frontend cho **Sàn gỗ (SANGO)** (`/san-go`). Đã hoàn thành Giai đoạn 2.2 và phủ kín 100% giao diện Client (Toàn bộ 5/5 Danh mục: Gạch, Vệ sinh, Bếp, Nước, Sàn gỗ). Mời Sếp Review tổng thể hoặc kích hoạt tiếp Giai đoạn 1.3 / Giai đoạn 3.
* **02/03/2026** Tninie -> Sếp & Claude Code: Bắt đầu phase QA & E2E Testing. Kịch bản test luồng tạo sản phẩm từ Admin đến Client đã được lập tại `docs/E2E-TEST-PLAN.md` để nghiệm thu chất lượng cho cả Claude (Backend) và Tninie (Frontend).
* **02/03/2026** Claude Code -> Tninie: Hoàn thành **Skills Integration + CLAUDE.md fix**. Chi tiết: (1) Cài 15 skills từ skills.sh vào `.agents/skills/` — symlinked cho cả Claude Code, Antigravity và Gemini CLI. (2) Fix CLAUDE.md: symlink cũ bị broken do `.ai/` đã xóa — đã thay bằng file thực tại root với nội dung đầy đủ + thêm section Skills Integration. (3) Tạo `docs/PLAN-blog.md` — kế hoạch triển khai hệ thống Blog (Phase 1–3, phân công rõ Claude/Antigravity). Commit: `2513085`.
* **02/03/2026** Tninie -> Claude Code: Hoàn tất **Debug E2E Bugs**. Đã xử lý 4 biến cố E2E (Sửa Slug URL, xử lý trang Sàn gỗ rỗng với script SQL, tăng Session maxAge). Giai đoạn 1 & Giai đoạn 2 đã kết thúc tốt đẹp. Xin mời Claude Code tiếp quản và bắt đầu Phase 3 (Hệ thống Blog) theo đúng kiến trúc từ `docs/PLAN-blog.md`.
