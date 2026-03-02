-- ============================================================================
-- SEED DATA — SÀN GỖ
-- ============================================================================

-- Bật danh mục
UPDATE product_categories
SET is_active = TRUE,
    description = 'Sàn gỗ công nghiệp và vật liệu sàn gỗ cao cấp',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 4;

-- LOẠI SẢN PHẨM (2)
INSERT INTO sango_product_types (id, category_id, name, slug, description, icon_name, is_active, sort_order, seo_title, seo_description) VALUES
(1, 4, 'Sàn gỗ công nghiệp', 'san-go-cong-nghiep', 'Sàn gỗ công nghiệp cao cấp với nhiều mẫu vân gỗ tự nhiên, độ bền cao, chống thấm, chống trầy xước', 'layers', TRUE, 1, 'Sàn gỗ công nghiệp cao cấp | Đông Phú Gia', 'Sàn gỗ công nghiệp chính hãng, đa dạng mẫu mã, độ dày 8mm-12mm. Bảo hành dài hạn tại Đà Lạt.'),
(2, 4, 'Vật liệu sàn gỗ', 'vat-lieu-san-go', 'Phụ kiện sàn gỗ: nẹp nhôm, nẹp nhựa, keo dán, xốp lót, màng PE chống ẩm', 'package', TRUE, 2, 'Vật liệu & Phụ kiện sàn gỗ | Đông Phú Gia', 'Phụ kiện sàn gỗ: nẹp, keo, xốp lót, màng chống ẩm. Đầy đủ vật liệu thi công sàn gỗ tại Đà Lạt.')
ON CONFLICT (slug) DO NOTHING;

-- Reset sequence
SELECT setval('sango_product_types_id_seq', (SELECT MAX(id) FROM sango_product_types));
