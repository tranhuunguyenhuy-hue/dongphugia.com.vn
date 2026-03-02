-- ============================================================================
-- SEED DATA — THIẾT BỊ BẾP
-- ============================================================================

-- Bật danh mục Thiết bị bếp
UPDATE product_categories
SET is_active = TRUE,
    description = 'Thiết bị bếp cao cấp từ các thương hiệu hàng đầu: Teka, Malloca, Bosch, Electrolux',
    seo_title = 'Thiết bị bếp cao cấp | Đông Phú Gia Đà Lạt',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 3;

-- ===================
-- THƯƠNG HIỆU (9)
-- ===================
INSERT INTO bep_brands (id, name, slug, origin_country, description, is_active, is_featured, sort_order) VALUES
(1, 'Teka', 'teka', 'Đức', 'Thương hiệu thiết bị bếp cao cấp từ Đức với hơn 95 năm kinh nghiệm', TRUE, TRUE, 1),
(2, 'Malloca', 'malloca', 'Tây Ban Nha', 'Thương hiệu thiết bị bếp châu Âu với thiết kế hiện đại', TRUE, TRUE, 2),
(3, 'Bosch', 'bosch', 'Đức', 'Tập đoàn công nghệ hàng đầu thế giới từ Đức', TRUE, TRUE, 3),
(4, 'Electrolux', 'electrolux', 'Thụy Điển', 'Thương hiệu gia dụng toàn cầu từ Thụy Điển', TRUE, TRUE, 4),
(5, 'Hafele', 'hafele', 'Đức', 'Chuyên gia phụ kiện và thiết bị bếp từ Đức', TRUE, FALSE, 5),
(6, 'Siemens', 'siemens', 'Đức', 'Tập đoàn công nghệ đa quốc gia từ Đức', TRUE, FALSE, 6),
(7, 'Faster', 'faster', 'Việt Nam', 'Thương hiệu thiết bị bếp Việt Nam chất lượng cao', TRUE, FALSE, 7),
(8, 'Canzy', 'canzy', 'Malaysia', 'Thương hiệu thiết bị bếp từ Malaysia', TRUE, FALSE, 8),
(9, 'Giovani', 'giovani', 'Ý', 'Thiết bị bếp phong cách Ý, thiết kế tinh tế', TRUE, FALSE, 9)
ON CONFLICT (slug) DO NOTHING;

-- ===================
-- LOẠI SẢN PHẨM (10)
-- ===================
INSERT INTO bep_product_types (id, category_id, name, slug, description, icon_name, is_active, sort_order, seo_title) VALUES
(1, 3, 'Bếp điện - Bếp từ', 'bep-dien-bep-tu', 'Bếp điện từ, bếp hồng ngoại, bếp từ kết hợp cao cấp', 'zap', TRUE, 1, 'Bếp điện & Bếp từ cao cấp | Đông Phú Gia'),
(2, 3, 'Bếp gas', 'bep-gas', 'Bếp gas âm kính, bếp gas dương từ các thương hiệu uy tín', 'flame', TRUE, 2, 'Bếp gas cao cấp | Đông Phú Gia'),
(3, 3, 'Máy hút mùi', 'may-hut-mui', 'Máy hút mùi ống khói, âm tủ, đảo, cổ điển', 'wind', TRUE, 3, 'Máy hút mùi cao cấp | Đông Phú Gia'),
(4, 3, 'Máy rửa chén', 'may-rua-chen', 'Máy rửa chén âm tủ, mini, độc lập tiết kiệm nước', 'washing-machine', TRUE, 4, 'Máy rửa chén cao cấp | Đông Phú Gia'),
(5, 3, 'Vòi rửa chén', 'voi-rua-chen', 'Vòi rửa chén rút dây, vòi lạnh, vòi bếp đá', 'droplets', TRUE, 5, 'Vòi rửa chén cao cấp | Đông Phú Gia'),
(6, 3, 'Chậu rửa chén', 'chau-rua-chen', 'Chậu rửa chén inox, chậu đá cao cấp', 'square', TRUE, 6, 'Chậu rửa chén cao cấp | Đông Phú Gia'),
(7, 3, 'Lò nướng đa năng', 'lo-nuong-da-nang', 'Lò nướng âm tủ, lò nướng đa năng cao cấp', 'microwave', TRUE, 7, 'Lò nướng đa năng | Đông Phú Gia'),
(8, 3, 'Lò vi sóng', 'lo-vi-song', 'Lò vi sóng âm tủ, lò vi sóng kết hợp', 'radio', TRUE, 8, 'Lò vi sóng cao cấp | Đông Phú Gia'),
(9, 3, 'Phụ kiện bếp', 'phu-kien-bep', 'Phụ kiện bếp, giá kệ, ray ngăn kéo, giỏ đựng', 'wrench', TRUE, 9, 'Phụ kiện bếp cao cấp | Đông Phú Gia'),
(10, 3, 'Tủ lạnh', 'tu-lanh', 'Tủ lạnh âm tủ, tủ lạnh side by side cao cấp', 'refrigerator', TRUE, 10, 'Tủ lạnh cao cấp | Đông Phú Gia')
ON CONFLICT (slug) DO NOTHING;

-- Reset sequences sau khi insert với explicit IDs
SELECT setval('bep_brands_id_seq', COALESCE((SELECT MAX(id) FROM bep_brands), 0) + 1, false);
SELECT setval('bep_product_types_id_seq', COALESCE((SELECT MAX(id) FROM bep_product_types), 0) + 1, false);

-- ===================
-- SUBTYPES (17)
-- ===================

-- Bếp điện - Bếp từ (3)
INSERT INTO bep_subtypes (product_type_id, name, slug, sort_order) VALUES
(1, 'Bếp điện từ kết hợp', 'bep-dien-tu-ket-hop', 1),
(1, 'Bếp điện hồng ngoại', 'bep-dien-hong-ngoai', 2),
(1, 'Bếp từ', 'bep-tu', 3)
ON CONFLICT (slug) DO NOTHING;

-- Bếp gas (2)
INSERT INTO bep_subtypes (product_type_id, name, slug, sort_order) VALUES
(2, 'Bếp gas Teka', 'bep-gas-teka', 1),
(2, 'Bếp gas Malloca', 'bep-gas-malloca', 2)
ON CONFLICT (slug) DO NOTHING;

-- Máy hút mùi (4)
INSERT INTO bep_subtypes (product_type_id, name, slug, sort_order) VALUES
(3, 'Máy hút mùi ống khói', 'may-hut-mui-ong-khoi', 1),
(3, 'Máy hút mùi âm tủ', 'may-hut-mui-am-tu', 2),
(3, 'Máy hút mùi đảo', 'may-hut-mui-dao', 3),
(3, 'Máy hút mùi cổ điển', 'may-hut-mui-co-dien', 4)
ON CONFLICT (slug) DO NOTHING;

-- Máy rửa chén (3)
INSERT INTO bep_subtypes (product_type_id, name, slug, sort_order) VALUES
(4, 'Máy rửa chén âm tủ', 'may-rua-chen-am-tu', 1),
(4, 'Máy rửa chén mini', 'may-rua-chen-mini', 2),
(4, 'Máy rửa chén độc lập', 'may-rua-chen-doc-lap', 3)
ON CONFLICT (slug) DO NOTHING;

-- Vòi rửa chén (3)
INSERT INTO bep_subtypes (product_type_id, name, slug, sort_order) VALUES
(5, 'Vòi bếp rút dây', 'voi-bep-rut-day', 1),
(5, 'Vòi bếp lạnh', 'voi-bep-lanh', 2),
(5, 'Vòi bếp đá', 'voi-bep-da', 3)
ON CONFLICT (slug) DO NOTHING;

-- Chậu rửa chén (2)
INSERT INTO bep_subtypes (product_type_id, name, slug, sort_order) VALUES
(6, 'Chậu rửa chén inox', 'chau-rua-chen-inox', 1),
(6, 'Chậu rửa chén đá', 'chau-rua-chen-da', 2)
ON CONFLICT (slug) DO NOTHING;
