-- ============================================================================
-- SEED DATA — THIẾT BỊ VỆ SINH
-- ============================================================================

-- Bật danh mục TBVS
UPDATE product_categories
SET is_active = TRUE,
    description = 'Thiết bị vệ sinh cao cấp từ các thương hiệu hàng đầu: TOTO, Inax, Kohler',
    seo_title = 'Thiết bị vệ sinh cao cấp | Đông Phú Gia Đà Lạt',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 2;

-- ===================
-- THƯƠNG HIỆU (7)
-- ===================
INSERT INTO tbvs_brands (id, name, slug, origin_country, description, is_active, is_featured, sort_order) VALUES
(1, 'TOTO', 'toto', 'Nhật Bản', 'Thương hiệu thiết bị vệ sinh cao cấp hàng đầu Nhật Bản từ năm 1917', TRUE, TRUE, 1),
(2, 'Inax', 'inax', 'Nhật Bản', 'Thương hiệu Nhật Bản thuộc tập đoàn LIXIL với công nghệ Aqua Ceramic', TRUE, TRUE, 2),
(3, 'Kohler', 'kohler', 'Mỹ', 'Thương hiệu cao cấp từ Mỹ với hơn 150 năm kinh nghiệm', TRUE, TRUE, 3),
(4, 'American Standard', 'american-standard', 'Mỹ', 'Thương hiệu Mỹ với công nghệ tiên tiến tiết kiệm nước', TRUE, FALSE, 4),
(5, 'Viglacera', 'viglacera', 'Việt Nam', 'Thương hiệu Việt Nam uy tín, giá cả phù hợp', TRUE, FALSE, 5),
(6, 'Caesar', 'caesar', 'Đài Loan', 'Thương hiệu Đài Loan với thiết kế hiện đại', TRUE, FALSE, 6),
(7, 'Grohe', 'grohe', 'Đức', 'Thương hiệu Đức nổi tiếng về sen vòi cao cấp', TRUE, FALSE, 7)
ON CONFLICT (slug) DO NOTHING;

-- Reset sequence
SELECT setval('tbvs_brands_id_seq', (SELECT MAX(id) FROM tbvs_brands));

-- ===================
-- LOẠI SẢN PHẨM (8)
-- ===================
INSERT INTO tbvs_product_types (id, category_id, name, slug, description, icon_name, is_active, sort_order, seo_title) VALUES
(1, 2, 'Bồn cầu', 'bon-cau', 'Bồn cầu cao cấp từ các thương hiệu hàng đầu', 'toilet', TRUE, 1, 'Bồn cầu cao cấp | Đông Phú Gia'),
(2, 2, 'Vòi lavabo', 'voi-lavabo', 'Vòi lavabo nóng lạnh, vòi cảm ứng, vòi âm tường', 'droplet', TRUE, 2, 'Vòi lavabo cao cấp | Đông Phú Gia'),
(3, 2, 'Phụ kiện bồn cầu', 'phu-kien-bon-cau', 'Nắp sứ, thân cầu, bộ xả, dây cấp', 'settings', TRUE, 3, 'Phụ kiện bồn cầu | Đông Phú Gia'),
(4, 2, 'Chậu rửa mặt', 'chau-rua-mat', 'Lavabo treo tường, âm bàn, đặt bàn, tủ lavabo', 'square', TRUE, 4, 'Chậu lavabo | Đông Phú Gia'),
(5, 2, 'Vòi sen - Sen cây', 'voi-sen-sen-cay', 'Vòi sen nóng lạnh, sen cây, vòi sen nhiệt độ', 'shower-head', TRUE, 5, 'Sen cây & Vòi sen | Đông Phú Gia'),
(6, 2, 'Bồn tắm', 'bon-tam', 'Bồn tắm thường, massage, góc, phòng tắm đứng', 'bath', TRUE, 6, 'Bồn tắm cao cấp | Đông Phú Gia'),
(7, 2, 'Nắp bồn cầu', 'nap-bon-cau', 'Nắp bồn cầu điện tử thông minh, nắp rửa cơ', 'disc', TRUE, 7, 'Nắp bồn cầu thông minh | Đông Phú Gia'),
(8, 2, 'Phụ kiện phòng tắm', 'phu-kien-phong-tam', 'Móc treo, kệ, giá khăn, hộp giấy vệ sinh', 'grip-horizontal', TRUE, 8, 'Phụ kiện phòng tắm | Đông Phú Gia')
ON CONFLICT (slug) DO NOTHING;

SELECT setval('tbvs_product_types_id_seq', (SELECT MAX(id) FROM tbvs_product_types));

-- ===================
-- SUBTYPES (41)
-- ===================

-- Bồn cầu (6)
INSERT INTO tbvs_subtypes (product_type_id, name, slug, sort_order) VALUES
(1, 'Bồn cầu 1 khối', 'bon-cau-1-khoi', 1),
(1, 'Bồn cầu 2 khối', 'bon-cau-2-khoi', 2),
(1, 'Bồn cầu treo tường', 'bon-cau-treo-tuong', 3),
(1, 'Bồn cầu thông minh', 'bon-cau-thong-minh', 4),
(1, 'Bồn cầu trẻ em', 'bon-cau-tre-em', 5),
(1, 'Vòi xịt', 'voi-xit', 6)
ON CONFLICT (slug) DO NOTHING;

-- Vòi lavabo (6)
INSERT INTO tbvs_subtypes (product_type_id, name, slug, sort_order) VALUES
(2, 'Vòi nóng lạnh', 'voi-nong-lanh', 1),
(2, 'Vòi lavabo lạnh', 'voi-lavabo-lanh', 2),
(2, 'Vòi âm tường', 'voi-am-tuong', 3),
(2, 'Vòi cảm ứng', 'voi-cam-ung', 4),
(2, 'Bộ xả lavabo', 'bo-xa-lavabo', 5),
(2, 'Vòi chậu bếp', 'voi-chau-bep', 6)
ON CONFLICT (slug) DO NOTHING;

-- Phụ kiện bồn cầu (6)
INSERT INTO tbvs_subtypes (product_type_id, name, slug, sort_order) VALUES
(3, 'Nắp sứ', 'nap-su', 1),
(3, 'Thân cầu', 'than-cau', 2),
(3, 'Bộ xả bồn cầu', 'bo-xa-bon-cau', 3),
(3, 'Dây cấp', 'day-cap', 4),
(3, 'Nắp nhựa', 'nap-nhua', 5),
(3, 'Van cấp nước', 'van-cap-nuoc', 6)
ON CONFLICT (slug) DO NOTHING;

-- Chậu rửa mặt (4)
INSERT INTO tbvs_subtypes (product_type_id, name, slug, sort_order) VALUES
(4, 'Lavabo treo tường', 'lavabo-treo-tuong', 1),
(4, 'Lavabo âm bàn', 'lavabo-am-ban', 2),
(4, 'Lavabo đặt bàn', 'lavabo-dat-ban', 3),
(4, 'Tủ lavabo', 'tu-lavabo', 4)
ON CONFLICT (slug) DO NOTHING;

-- Vòi sen - Sen cây (6)
INSERT INTO tbvs_subtypes (product_type_id, name, slug, sort_order) VALUES
(5, 'Vòi sen nóng lạnh', 'voi-sen-nong-lanh', 1),
(5, 'Thanh trượt sen', 'thanh-truot-sen', 2),
(5, 'Vòi sen nhiệt độ', 'voi-sen-nhiet-do', 3),
(5, 'Tay sen tắm', 'tay-sen-tam', 4),
(5, 'Vòi sen lạnh', 'voi-sen-lanh', 5),
(5, 'Sen cây', 'sen-cay', 6)
ON CONFLICT (slug) DO NOTHING;

-- Bồn tắm (6)
INSERT INTO tbvs_subtypes (product_type_id, name, slug, sort_order) VALUES
(6, 'Bồn tắm thường', 'bon-tam-thuong', 1),
(6, 'Bồn tắm massage', 'bon-tam-massage', 2),
(6, 'Bồn tắm góc', 'bon-tam-goc', 3),
(6, 'Bồn tắm đặt sàn', 'bon-tam-dat-san', 4),
(6, 'Vòi bồn tắm', 'voi-bon-tam', 5),
(6, 'Phòng tắm đứng', 'phong-tam-dung', 6)
ON CONFLICT (slug) DO NOTHING;

-- Nắp bồn cầu (2)
INSERT INTO tbvs_subtypes (product_type_id, name, slug, sort_order) VALUES
(7, 'Nắp bồn cầu điện tử', 'nap-bon-cau-dien-tu', 1),
(7, 'Nắp bồn cầu rửa cơ', 'nap-bon-cau-rua-co', 2)
ON CONFLICT (slug) DO NOTHING;

-- Phụ kiện phòng tắm (5)
INSERT INTO tbvs_subtypes (product_type_id, name, slug, sort_order) VALUES
(8, 'Móc treo', 'moc-treo', 1),
(8, 'Kệ để đồ', 'ke-de-do', 2),
(8, 'Giá treo khăn', 'gia-treo-khan', 3),
(8, 'Hộp giấy vệ sinh', 'hop-giay-ve-sinh', 4),
(8, 'Gương phòng tắm', 'guong-phong-tam', 5)
ON CONFLICT (slug) DO NOTHING;

SELECT setval('tbvs_subtypes_id_seq', (SELECT MAX(id) FROM tbvs_subtypes));

-- ===================
-- CHẤT LIỆU (7)
-- ===================
INSERT INTO tbvs_materials (name, slug, description, sort_order) VALUES
('Sứ cao cấp', 'su-cao-cap', 'Sứ Vitreous China chất lượng cao', 1),
('Sứ Ceramic', 'su-ceramic', 'Sứ Ceramic tiêu chuẩn', 2),
('Inox 304', 'inox-304', 'Thép không gỉ SUS304', 3),
('Đồng mạ Chrome', 'dong-ma-chrome', 'Đồng thau mạ chrome sáng bóng', 4),
('Nhựa ABS', 'nhua-abs', 'Nhựa ABS cao cấp, chịu nhiệt', 5),
('Acrylic', 'acrylic', 'Acrylic nguyên khối cho bồn tắm', 6),
('Kính cường lực', 'kinh-cuong-luc', 'Kính cường lực an toàn', 7)
ON CONFLICT (slug) DO NOTHING;

SELECT setval('tbvs_materials_id_seq', (SELECT MAX(id) FROM tbvs_materials));

-- ===================
-- CÔNG NGHỆ (15)
-- ===================
INSERT INTO tbvs_technologies (name, slug, brand_id, description, sort_order) VALUES
('CeFiONtect', 'cefiontect', 1, 'Men sứ siêu nhẵn TOTO, chống bám bẩn', 1),
('Tornado Flush', 'tornado-flush', 1, 'Xả xoáy mạnh mẽ TOTO', 2),
('Washlet', 'washlet', 1, 'Nắp điện tử thông minh TOTO', 3),
('Ewater+', 'ewater-plus', 1, 'Nước điện phân diệt khuẩn TOTO', 4),
('Rimless', 'rimless', 1, 'Thiết kế không gờ viền', 5),
('Aqua Ceramic', 'aqua-ceramic', 2, 'Men sứ chống bám bẩn 100 năm Inax', 6),
('Hyperkilamic', 'hyperkilamic', 2, 'Kháng khuẩn ion bạc Inax', 7),
('Ecoful Shower', 'ecoful-shower', 2, 'Sen tiết kiệm nước Inax', 8),
('E-Clean', 'e-clean', 2, 'Rửa sạch tự động Inax', 9),
('Revolution 360', 'revolution-360', 3, 'Xả 360 độ Kohler', 10),
('CleanCoat', 'cleancoat', 3, 'Lớp phủ chống bám Kohler', 11),
('EcoJoy', 'ecojoy', 7, 'Tiết kiệm nước Grohe', 12),
('StarLight', 'starlight', 7, 'Mạ chrome sáng Grohe', 13),
('SilkMove', 'silkmove', 7, 'Điều khiển mượt Grohe', 14),
('Tiết kiệm nước', 'tiet-kiem-nuoc', NULL, 'Thiết kế tiết kiệm nước chung', 15)
ON CONFLICT (slug) DO NOTHING;

SELECT setval('tbvs_technologies_id_seq', (SELECT MAX(id) FROM tbvs_technologies));
