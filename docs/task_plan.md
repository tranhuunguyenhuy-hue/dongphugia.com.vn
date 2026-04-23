# Task Plan: DB Cleanup & Compatible Lid Feature
**Project**: Đông Phú Gia V2  
**Created**: 2026-04-21  
**Last Updated**: 2026-04-21  
**Status**: 🟡 IN PROGRESS

---

## 🎯 MỤC TIÊU TỔNG THỂ

Làm sạch dữ liệu danh mục Bồn Cầu trong DB (hiện đang rối do crawl từ Hita),
sau đó triển khai tính năng hiển thị **Nắp Bồn Cầu Tương Thích** trên trang
chi tiết sản phẩm — tương tự mô hình Hita.com.vn.

---

## ⚡ CONTEXT NHANH (đọc trước khi làm bất kỳ thứ gì)

```
DB Supabase / Prisma ORM / Next.js 16 / TypeScript
subcategory_id=1  → Bồn Cầu     (851 sp, CÓ 216 sp NHẦM)
subcategory_id=9  → Nắp Bồn Cầu (16 sp, THIẾU ~80 sp đang ở sub=1)
product_type      → CHƯA TỒN TẠI trong schema

Scripts cleanup: scripts/db/
PDP component:   src/components/product/product-detail-tabs.tsx
Category page:   src/app/(public)/thiet-bi-ve-sinh/[sub]/[slug]/page.tsx
```

---

## PHASE 0 — SETUP & SAFETY (30 phút — NGAY HÔM NAY)
**Mục tiêu**: Chuẩn bị môi trường an toàn trước khi chạm vào data production

### Checklist
- [ ] **0.1** Backup snapshot DB (Supabase dashboard → Backups → Create backup)
- [ ] **0.2** Tạo subcategory "Phụ Kiện Bồn Cầu" trong DB
  ```sql
  INSERT INTO subcategories (name, slug, category_id, is_active, sort_order)
  SELECT 'Phụ Kiện Bồn Cầu', 'phu-kien-bon-cau',
         (SELECT id FROM categories WHERE slug='thiet-bi-ve-sinh'),
         true, 99;
  -- Ghi lại ID mới vào findings.md
  ```
- [ ] **0.3** Verify backup tồn tại trước khi tiếp tục
- [ ] **0.4** Chạy audit script để capture baseline số liệu:
  ```bash
  npx tsx --env-file=.env.local scripts/db/audit-hita-data.mts
  ```

### Definition of Done — Phase 0
- Backup confirmed
- Sub "Phụ Kiện Bồn Cầu" tạo thành công
- ID ghi vào docs/findings.md

---

## PHASE 1 — DATA RE-CLASSIFICATION (Ngày 1–2)
**Mục tiêu**: Chuyển 216 sản phẩm sai chỗ về đúng subcategory

### 1.1 — Chuyển ~80 Nắp bồn cầu (sub=1 → sub=9)
- [x] Viết script
- [x] DRY RUN — 130 sp detect đúng
- [x] Chạy thật — **129 sp đã chuyển sang sub=9** ✅

**Pattern keyword nhận diện nắp:**
```
name ILIKE '%nắp bồn cầu%'
name ILIKE '%nắp đóng êm%'
name ILIKE '%nắp rửa%'
name ILIKE '%bệ ngồi%'
name ILIKE '%nắp bàn cầu%'
name ILIKE '%nắp và bệ%'
```

### 1.2 — Chuyển ~136 Phụ kiện (sub=1 → sub=phu_kien_bon_cau)
- [x] Viết script
- [x] DRY RUN — 174 sp detect
- [x] Chạy thật — **172 sp đã chuyển sang sub=32** ✅

**Pattern keyword phụ kiện:**
```
name ILIKE '%két nước%'
name ILIKE '%nút nhấn%'
name ILIKE '%van góc%' OR '%van khóa%'
name ILIKE '%ống nối%' OR '%ống thoát%' OR '%ống xả%'
name ILIKE '%bộ đế%' OR '%linh kiện%'
name ILIKE '%trụ xả%' OR '%trụ cấp%'
name ILIKE '%bích nối%' OR '%đế thải%'
name ILIKE '%dây cấp%' OR '%gioăng%'
name ILIKE '%bộ xả bồn cầu%'
```

### 1.3 — Chuyển ~19 Thân bồn cầu sang Subcategory mới
- [x] Tạo Subcategory "Thân Bồn Cầu" (ID: 33) trong DB
- [x] Viết script
- [x] Chạy thật — **19 sp đã chuyển sang sub=33** ✅

### 1.4 — Manual review 133 bồn cầu "chưa phân loại"
- [ ] Export list ra CSV
- [ ] PM + Dev review từng dòng
- [ ] Flag cái cần chuyển subcategory → chạy update batch

### 1.5 — Naming Cleanup ✅
- [x] Viết script
- [x] Xóa mã SKU bị lặp ở cuối tên
- [x] **760 tên sản phẩm đã được chuẩn hóa** ✅
- [ ] Format chuẩn: `[{Loại}] [Thương Hiệu] [Tên Model/Mã]`

### Definition of Done — Phase 1 (✅ DONE)
- sub_id=9: 129 nắp (tăng từ 16 → 145+ record) ✅
- sub=32 Phụ Kiện Bồn Cầu: 172 sản phẩm ✅
- sub=33 Thân Bồn Cầu: 19 sản phẩm ✅
- sub=1 chỉ còn bồn cầu thuần: **528 sp** (target <= 500 — xấp xỉ đạt) ✅
- 760 tên sản phẩm chuẩn hóa ✅
- Tổng sản phẩm không mất (không xóa record nào) ✅

---

## PHASE 2 — SCHEMA ENHANCEMENT (Ngày 3–4)
**Mục tiêu**: Thêm `product_type` column để phân cấp nội tại

> ⚠️ **BLOCKER**: Không thể chạy `ALTER TABLE` qua Prisma do Supabase có `statement_timeout` quá thấp.
> **Giải pháp**: Thực hiện manual từ Supabase Dashboard SQL Editor.

### 2.0 — Manual SQL qua Supabase Dashboard (USER tự làm)
Trước khi chạy bất kỳ Phase 2 số còn lại, bạn cần chạy SQL này trực tiếp trong **Supabase Dashboard > SQL Editor**:

```sql
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_type VARCHAR(50);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_sub_type VARCHAR(50);
```

- [ ] **2.0** USER chạy SQL trên trong Supabase Dashboard và xác nhận thành công

### 2.1 — Sync Prisma Schema (sau khi 2.0 done)
- [ ] Thêm vào `schema.prisma`:
  ```prisma
  model products {
    // existing fields...
    product_type     String?   // 'bon-cau-1-khoi' | 'bon-cau-2-khoi' | etc.
    product_sub_type String?   // 'nap-rua-co' | 'nap-dien-tu' | 'washlet'
  }
  ```
- [ ] Chạy `npx prisma migrate dev --name add_product_type`
- [ ] Verify migration thành công

### 2.2 — Auto-fill product_type từ name patterns
- [ ] Viết script `scripts/db/fill-product-type.mts`
- [ ] Mapping rules:

| Keyword trong name | product_type |
|---|---|
| "1 khối" | bon-cau-1-khoi |
| "2 khối" | bon-cau-2-khoi |
| "treo tường" | bon-cau-treo-tuong |
| "đặt sàn" | bon-cau-dat-san |
| "thông minh" | bon-cau-thong-minh |
| "xổm" | bon-cau-xom |
| sub=9 + "đóng êm" | nap-dong-em |
| sub=9 + "rửa cơ" | nap-rua-co |
| sub=9 + "điện tử"/"washlet" | nap-dien-tu |

- [ ] DRY RUN → check coverage % (target >80%)
- [ ] Chạy thật
- [ ] Verify

### 2.3 — Update TypeScript types
- [ ] `npx prisma generate`
- [ ] `npx tsc --noEmit` không lỗi

### Definition of Done — Phase 2
- Column product_type tồn tại trong DB
- >80% sản phẩm sub=1 và sub=9 có product_type
- TypeScript compile clean

---

## PHASE 3 — COMPATIBLE LID FEATURE (Ngày 5–7)
**Mục tiêu**: Hiển thị section "Nắp phù hợp" trên PDP bồn cầu

### 3.1 — API / Data Layer
- [ ] Cập nhật query PDP: nếu sub=1 → kéo thêm nắp sub=9 cùng brand
  - File: `src/lib/public-api-products.ts` (hoặc tương đương)
  - Cache tag: `['product-${id}', 'compatible-lids']`
- [ ] Fallback: show top-3 nắp bán chạy nếu không có cùng brand

### 3.2 — Frontend Component
- [ ] Tạo `src/components/product/compatible-lids-section.tsx`
- [ ] Horizontal scroll cards, responsive mobile-first
- [ ] Disclaimer: "Kiểm tra thông số kỹ thuật trước khi đặt hàng"

### 3.3 — Tích hợp vào PDP
- [ ] Mount vào PDP page
- [ ] Chỉ hiện khi `product.subcategoryId === 1` (Bồn Cầu)
- [ ] Test: TOTO CS767 → hiện 3 nắp TOTO
- [ ] Test: Brand không có nắp → section ẩn

### 3.4 — QA & Deploy
- [ ] Test localhost với 5 SKU bồn cầu khác brand
- [ ] `npx tsc --noEmit` clean
- [ ] `vercel --prod`

### Definition of Done — Phase 3
- Section xuất hiện trên PDP TOTO, INAX, CAESAR, COTTO
- Fallback graceful cho brand không có nắp
- Responsive tốt trên mobile
- Deployed production

---

## 📋 TIMELINE

```
Hôm nay (21/04):  [Phase 0] Backup + Tạo sub mới
Ngày 22/04:       [Phase 1a] Re-classify nắp → sub=9
Ngày 23/04:       [Phase 1b] Re-classify phụ kiện + manual review
Ngày 24/04:       [Phase 2a] Prisma migration + product_type
Ngày 25/04:       [Phase 2b] Auto-fill product_type
Ngày 26-27/04:    [Phase 3] Feature + Deploy
```

---

## 🚨 ROLLBACK PLAN

```sql
-- Nếu re-classify sai → rollback về subcategory cũ
-- Script phải log ra danh sách ID trước khi UPDATE
UPDATE products SET subcategory_id = 1
WHERE id IN (<list_id_from_log>);

-- Rollback product_type (dễ)
UPDATE products SET product_type = NULL, product_sub_type = NULL;

-- Cuối cùng: Restore từ Backup Supabase (Phase 0)
```

---

## ✅ CÁC QUYẾT ĐỊNH ĐÃ CHỐT

| # | Vấn đề | Quyết định từ PM | Status |
|---|---|---|---|
| 1 | Brand không có nắp → xử lý hiển thị thế nào? | **Ẩn section** (PDP trở thành PDP cơ bản) | ✅ Chốt |
| 2 | "Thân bồn cầu không két" (vd: GROHE) | Chuyển sang **Subcategory mới** | ✅ Chốt |
| 3 | Naming cleanup (bỏ SKU lặp cuối tên) | **Làm ngay** trong Phase 1 | ✅ Chốt |

---

## EPIC 2: V2 FRONTEND MODERNIZATION (NGAY BÂY GIỜ)

**Status:** 🟡 IN PROGRESS

Sau khi hoàn thành DB Cleanup (Epic 1) và PDP (Epic 2 - Phase 3), chúng ta hiện tiến hành hệ thống UI tĩnh và điều hướng.

### PHASE 4 — Mordenize Navigation (Header, Footer, Mega Menu)
**Mục tiêu**: Đồng bộ hoàn toàn giao diện điều hướng với hệ thống Design Token V2 (Bỏ mảng màu cũ, xoá gradient, áp dụng hiệu ứng viền/bóng chuẩn).

#### 4.1 Cập nhật Header 
- [ ] Chỉnh sửa layout Header dựa trên Figma (Solid white background, sticky, không dùng hiệu ứng kính/glassmorphism).
- [ ] Cập nhật CTA Button, Cart Icon với màu accent V2 chuẩn (`brand-500`).

#### 4.2 Tái cấu trúc Mega Menu (Bỏ Attio Style)
- [ ] Xoá toàn bộ class chứa gradient background. Dùng Token màu Neutral (Stone-100) trên trạng thái hover/active theo quy chuẩn DPG V2.
- [ ] Thay các mã màu Hex (`#3C4E56`, `#C8D9E0`) sang class tương ứng (`text-stone-600`, `border-stone-200`).
- [ ] Gỡ bỏ các animation bóng viền sai chuẩn.

#### 4.3 Tinh chỉnh Footer
- [ ] Kiểm tra Typography, đảm bảo lưới Footer tuân thủ 4-pt rhythm (các khoảng cách gap 8, 16, 24).
- [ ] Gỡ bỏ form viền cũ, đồng bộ với input token V2 chuẩn.
