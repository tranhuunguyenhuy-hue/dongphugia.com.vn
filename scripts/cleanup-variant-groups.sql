-- =============================================================================
-- LEO-435: P1 — DB Schema + Data Cleanup
-- Chạy ngày: 2026-05-27
-- Mục tiêu: Thêm cột variant_type, variant_label; cập nhật constraint stock_status;
--           dọn dẹp dữ liệu variant_group.
-- =============================================================================

-- ============================================================
-- SECTION 1: DDL — Thêm cột và cập nhật constraint
-- ============================================================

-- 1.1 Thêm cột variant_type (loại biến thể: color, seat_type, v.v.)
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_type VARCHAR(30) DEFAULT NULL;

-- 1.2 Thêm cột variant_label (nhãn hiển thị của biến thể, ví dụ: "Đen mờ", "Có nắp")
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_label VARCHAR(100) DEFAULT NULL;

-- 1.3 Xóa constraint stock_status cũ (nếu tồn tại) để thêm giá trị mới
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_stock_status_check;

-- 1.4 Tái tạo constraint stock_status với các giá trị mới bao gồm 'contact' và 'pre_order'
ALTER TABLE products ADD CONSTRAINT products_stock_status_check
  CHECK (stock_status IN ('in_stock', 'out_of_stock', 'discontinued', 'contact', 'pre_order'));

-- ============================================================
-- SECTION 2: Data Cleanup — Dọn dẹp dữ liệu variant_group
-- ============================================================

-- 2.1 Xóa variant_group cho các sản phẩm chỉ có 1 mình trong nhóm
--     (variant_group chỉ có ý nghĩa khi có ≥ 2 sản phẩm cùng nhóm)
--
-- Preview trước khi chạy:
-- SELECT COUNT(*) FROM products WHERE variant_group IN (
--   SELECT variant_group FROM products WHERE variant_group IS NOT NULL
--   GROUP BY variant_group HAVING COUNT(*) = 1
-- );
-- → Kết quả: 645 rows
--
UPDATE products
SET variant_group = NULL,
    is_master     = false
WHERE variant_group IN (
    SELECT variant_group
    FROM products
    WHERE variant_group IS NOT NULL
    GROUP BY variant_group
    HAVING COUNT(*) = 1
);
-- Rows updated: 645

-- 2.2 Đánh dấu các sản phẩm Sen Tắm (bộ combo) là is_combo=true
--     Nhận diện qua: subcategory slug chứa 'sen-tam' + sku có dấu '/' (combo SKU)
--
-- Preview trước khi chạy:
-- SELECT COUNT(*) FROM products p
-- JOIN subcategories s ON p.subcategory_id = s.id
-- WHERE s.slug LIKE '%sen-tam%' AND p.sku LIKE '%/%';
-- → Kết quả: 700 rows
--
UPDATE products
SET is_combo      = true,
    is_master     = true,
    variant_group = NULL
WHERE subcategory_id IN (
    SELECT id FROM subcategories WHERE slug LIKE '%sen-tam%'
)
  AND sku LIKE '%/%';
-- Rows updated: 700

-- 2.3a Set variant_type = 'color' cho các sản phẩm có màu theo suffix SKU
--      Các suffix màu: #MBE (đen mờ), #MBL (đen bóng), #MGR (gương),
--                      #MW (trắng mờ), #GW (vàng trắng), #XW (xanh trắng), #W (trắng)
--
UPDATE products
SET variant_type = 'color'
WHERE variant_group IS NOT NULL
  AND (
      sku LIKE '%#MBE'
      OR sku LIKE '%#MBL'
      OR sku LIKE '%#MGR'
      OR sku LIKE '%#MW'
      OR sku LIKE '%#GW'
      OR sku LIKE '%#XW'
      OR sku LIKE '%#W'
  );
-- Rows updated: 345

-- 2.3b Set variant_type = 'seat_type' cho bồn cầu chưa được gán variant_type
--      (biến thể loại nắp bệt: có nắp điện / không nắp / nắp cơ)
--
UPDATE products
SET variant_type = 'seat_type'
WHERE variant_group IS NOT NULL
  AND variant_type IS NULL
  AND subcategory_id IN (
      SELECT id FROM subcategories WHERE slug LIKE '%bon-cau%'
  );
-- Rows updated: 152

-- ============================================================
-- SECTION 3: Verification queries
-- ============================================================

-- Xác nhận variant_type distribution
-- SELECT variant_type, COUNT(*) FROM products GROUP BY variant_type ORDER BY COUNT(*) DESC;

-- Xác nhận is_combo distribution
-- SELECT is_combo, COUNT(*) FROM products GROUP BY is_combo;

-- Xác nhận các sản phẩm còn lại có variant_group hợp lệ (≥ 2 sản phẩm/nhóm)
-- SELECT variant_group, COUNT(*) as cnt FROM products
-- WHERE variant_group IS NOT NULL
-- GROUP BY variant_group
-- HAVING COUNT(*) = 1;
-- → Phải trả về 0 rows

-- ============================================================
-- SECTION 4: P4 Fix — Sửa lỗi variant_type sai cho bồn cầu
-- Chạy ngày: 2026-05-27
-- Root cause: Step 2.3a ghi variant_type='color' cho SKU suffix #XW, #W, v.v.
--             Step 2.3b chỉ ghi 'seat_type' khi variant_type IS NULL → bị bỏ qua.
-- Fix: subcategory bon-cau được ưu tiên hơn SKU suffix.
--      Overwrite KHÔNG check variant_type IS NULL.
-- ============================================================

-- 4.1 Preview trước khi chạy (kiểm tra các bon-cau bị gán sai variant_type='color'):
-- SELECT sku, variant_type, variant_group
-- FROM products
-- WHERE variant_group IS NOT NULL
--   AND subcategory_id IN (SELECT id FROM subcategories WHERE slug LIKE '%bon-cau%')
--   AND variant_type != 'seat_type'
-- ORDER BY sku LIMIT 20;
-- → Ví dụ: CS767CRW17#XW có variant_type='color' (sai)

-- 4.2 Fix: Ghi đè variant_type='seat_type' cho TẤT CẢ bồn cầu có variant_group
--         (không phụ thuộc variant_type hiện tại là gì)
UPDATE products
SET variant_type = 'seat_type'
WHERE variant_group IS NOT NULL
  AND subcategory_id IN (
      SELECT id FROM subcategories WHERE slug LIKE '%bon-cau%'
  );
-- Rows updated: 383

-- 4.3 Verify CS767CRW sau fix:
-- SELECT sku, variant_type, variant_group FROM products WHERE sku LIKE 'CS767CRW%' LIMIT 5;
-- → Tất cả phải có variant_type='seat_type'

-- ============================================================
-- PATCH: Clear remaining single-item variant groups (post-audit fix)
-- Chạy ngày: 2026-05-27
-- Root cause: Victory Auditor phát hiện 87 sản phẩm vẫn còn variant_group đơn lẻ
--             sau cleanup P1 (các bước 2.1 dùng cả is_master=false, nhưng một số
--             sản phẩm mới/bỏ sót vẫn còn single-item group).
-- Fix: Clear variant_group = NULL cho tất cả nhóm chỉ có 1 thành viên.
-- ============================================================

-- PATCH Preview (phải thấy 87 rows trước khi chạy):
-- SELECT COUNT(*) FROM products WHERE variant_group IN (
--   SELECT variant_group FROM products WHERE variant_group IS NOT NULL GROUP BY variant_group HAVING COUNT(*)=1
-- );
-- → Kết quả: 87 rows

UPDATE products
SET variant_group = NULL
WHERE variant_group IN (
    SELECT variant_group
    FROM products
    WHERE variant_group IS NOT NULL
    GROUP BY variant_group
    HAVING COUNT(*) = 1
);
-- Rows updated: 87

-- PATCH Verify (phải = 0 sau khi chạy):
-- SELECT COUNT(*) FROM products WHERE variant_group IN (
--   SELECT variant_group FROM products WHERE variant_group IS NOT NULL GROUP BY variant_group HAVING COUNT(*)=1
-- );
-- → Phải trả về 0 rows

-- ============================================================
-- PATCH: Fix is_master for standalone products (variant_group=NULL, is_combo=false)
-- Chạy ngày: 2026-05-27
-- Root cause: Patch trước chỉ set variant_group=NULL cho 87 sản phẩm single-item,
--             nhưng KHÔNG set is_master=false. P1 gốc đã set cả hai.
--             Kết quả: 5272 sản phẩm standalone (variant_group=NULL, is_combo=false)
--             vẫn bị gán is_master=true nhầm.
-- Fix: Set is_master=false cho tất cả sản phẩm standalone.
-- ============================================================

-- PATCH Preview (phải thấy 5272 rows trước khi chạy):
-- SELECT COUNT(*) FROM products
-- WHERE variant_group IS NULL
--   AND is_master = true
--   AND is_combo = false;
-- → Kết quả: 5272 rows

UPDATE products
SET is_master = false
WHERE variant_group IS NULL
  AND is_master = true
  AND is_combo = false;
-- Rows updated: 5272

-- PATCH Verify (phải = 0 sau khi chạy):
-- SELECT COUNT(*) FROM products
-- WHERE variant_group IS NULL
--   AND is_master = true
--   AND is_combo = false;
-- → Phải trả về 0 rows
