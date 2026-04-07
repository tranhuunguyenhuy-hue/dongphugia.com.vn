# Handoff Notes — PM ↔ Antigravity

> Chỉ ghi WIP chưa hoàn thành. Xóa entry sau khi handoff done.
> Cập nhật: 06/04/2026 — Scope V2 thay đổi hoàn toàn

---

## 🔴 Active Handoff — PM → Antigravity

### [LEO-366] DB Restructure — Phase 1 DONE, bắt đầu Phase 2

**Status:** Phase 1 hoàn thành ✅ — **Bắt đầu Phase 2 ngay**
**Date:** 06/04/2026
**Deadline Phase 2:** 12/04/2026

---

### ⚠️ Scope đã thay đổi hoàn toàn so với HANDOFF.md cũ (03/04)

**KHÔNG làm theo queue cũ.** Các issues LEO-327, 338, 339, 340, 341, 342, 346, 347, 329, 360, 361, 365 đã bị **CANCEL**. Queue mới chỉ gồm:

| Phase | Issue | Deadline | Status |
|-------|-------|----------|--------|
| Phase 1 — Cleanup backend cũ | LEO-367 | 08/04 | ⏳ Bắt đầu ngay |
| Phase 2 — SQL Migration + Prisma | LEO-368 | 12/04 | ⏳ Sau LEO-367 |
| Phase 3 — Build lại backend unified | LEO-369 | 19/04 | ⏳ Sau LEO-368 |
| Phase 4 — Data Import | LEO-370 | 26/04 | ⏳ Sau LEO-369 |
| Design System | LEO-343, 344, 345 | 12-22/04 | ⏳ Song song |

---

### 📐 Schema đã được PM Approve — ADR-001 (06/04)

**Xem full ADR:** Comment mới nhất trên LEO-366 (06/04/2026 — "ADR-001: Database Architecture")

**3 điều chỉnh bắt buộc so với đề xuất ban đầu:**

1. **`specs JSONB`** trong bảng `products` — KHÔNG dùng bảng `product_attributes` EAV riêng
   - Thêm GIN index: `CREATE INDEX idx_products_specs ON products USING GIN(specs);`

2. **Bỏ `icon_url`** trong `product_features` — chỉ giữ `icon_name` (Lucide icon key)

3. **`UNIQUE(category_id, slug)`** trên `products` — KHÔNG phải global unique slug

---

### 📋 Phase 2 — Việc cần làm ngay (deadline 12/04)

**Bước 1:** Backup CSV tất cả bảng hiện tại từ Supabase Dashboard
→ Lưu vào `backups/archives/pre-v2-migration-2026-04-12/`

**Bước 2:** Viết SQL migration file:
`scripts/db/migration-2026-04-12-v2-schema.sql`
- DROP tất cả bảng per-category (tbvs_*, bep_*, nuoc_*, sango_*, products cũ...)
- CREATE 22 bảng mới theo schema approved trong LEO-366 description
- CREATE indexes (đặc biệt GIN index cho specs JSONB)

**Bước 3:** Chạy SQL trên Supabase Dashboard → SQL Editor

**Bước 4:**
```bash
npx prisma db pull
npx prisma generate
# Restart dev server
```

**Bước 5:** Verify 22 models trong schema.prisma + `npx tsc --noEmit` zero errors

---

### 📌 PM Decisions đã chốt (không cần hỏi lại)

| Câu hỏi | Quyết định |
|---------|-----------|
| Gạch ốp lát + Sàn gỗ từ đâu? | Hita không có. Để sang Sprint sau — làm 3 danh mục TBVS/Bếp/Nước trước |
| `product_attributes` EAV hay JSONB? | JSONB (`specs` column trong products) |
| Slug unique strategy? | `UNIQUE(category_id, slug)` — không phải global |
| `icon_url` trong product_features? | Bỏ — chỉ giữ `icon_name` |

### 🔴 PM Decisions còn đang chờ (HỎI trước khi làm)

| Câu hỏi | Deadline |
|---------|----------|
| Design reference sites cho color palette (LEO-343) | **12/04** |
| `filter_definitions` seed data — Antigravity draft xong chưa? | Trước Phase 4 (26/04) |
| Thông tin tài khoản ngân hàng ĐPG cho QR VietQR | **26/04** |

---

### 🔗 Linear Links quan trọng

| Issue | URL |
|-------|-----|
| LEO-366 (Epic DB Restructure) | https://linear.app/leonguyen/issue/LEO-366 |
| LEO-367 (Phase 1 — Cleanup cũ) | https://linear.app/leonguyen/issue/LEO-367 |
| LEO-368 (Phase 2 — SQL Migration) | https://linear.app/leonguyen/issue/LEO-368 |
| LEO-369 (Phase 3 — Rebuild backend) | https://linear.app/leonguyen/issue/LEO-369 |
| LEO-370 (Phase 4 — Data Import) | https://linear.app/leonguyen/issue/LEO-370 |
| LEO-328 (Design System Epic) | https://linear.app/leonguyen/issue/LEO-328 |

---

## Archived Handoffs

| Date | Issue | Direction | Summary |
|------|-------|-----------|---------|
| 06/04 | LEO-366 ADR-001 | PM→Antigravity | Schema approved: 22 bảng, JSONB specs, scope thay đổi hoàn toàn |
| 03/04 | V2 Setup | PM→Antigravity | ~~V2 roadmap cũ~~ — SUPERSEDED bởi entry trên |
| 01/04 | LEO-322→323 | Claude→Antigravity | Mirror 5,254 main images + gallery crawl TBVS |
