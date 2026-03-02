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

## 2. Trạng thái Frontend & UI (Antigravity Ownership)

### Danh mục: Thiết bị bếp (Kitchen Appliances)
Người thực hiện: Antigravity (Tninie)

- [x] Route `src/app/(public)/thiet-bi-bep/page.tsx` (Hoàn thiện Layout 4 cột, SmartFilter)
- [x] Route Product Detail `src/app/(public)/thiet-bi-bep/[typeSlug]/[productSlug]/page.tsx` (Hoàn thiện Gallery + Tabs thông số + QuoteForm)

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

## 3. Nhật Ký Bàn Giao (Hand-off Log)
*Format: [Date] Agent 1 -> Agent 2: Task Description*

* **02/03/2026** (User/Claude) -> Tninie: "Schema BEP đã sẵn sàng. Khi Antigravity cần Backend API + Admin CMS cho Thiết bị bếp, Claude Code sẽ tạo `public-api-bep.ts`, `bep-actions.ts` và admin pages (clone pattern từ TBVS)."
* **02/03/2026** Claude Code -> Tninie: Hoàn thành refactor Admin CMS Gạch ốp lát sang dạng accordion nhóm theo BST tại `/admin/products`. Xóa các trang tạo/sửa BST và Kiểu vân riêng lẻ, gộp chung vào modal. Đã sửa type error `_count.bep_products` trong `src/app/(public)/thiet-bi-bep/page.tsx`.
* **02/03/2026** Claude Code -> Tninie: Xác nhận BEP Backend 100% hoàn thành. `public-api-bep.ts` + `bep-actions.ts` + Admin CMS `/admin/bep/products/*` đã có đủ. Build PASS. Frontend BEP (`/thiet-bi-bep/[typeSlug]/[productSlug]`) chờ Antigravity implement.
* **02/03/2026** Tninie -> Claude Code: Hoàn tất Giai đoạn 2.1 (Frontend Thiết bị bếp). Route Category `thiet-bi-bep` và Product Detail `thiet-bi-bep/[typeSlug]/[productSlug]` đã live với QuoteForm và Tabs. Tninie chờ Claude làm Giai đoạn 1.2 (Backend TB Ngành Nước & Sàn Gỗ).
