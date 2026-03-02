-- ============================================================================
-- SEED DATA — VẬT LIỆU NƯỚC
-- ============================================================================

-- Bật danh mục
UPDATE product_categories
SET is_active = TRUE,
    description = 'Thiết bị nước cao cấp: bồn nước, máy nước nóng, năng lượng mặt trời, máy lọc nước',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 5;

-- THƯƠNG HIỆU (7)
INSERT INTO nuoc_brands (id, name, slug, origin_country, description, is_active, is_featured, sort_order) VALUES
(1, 'Đại Thành', 'dai-thanh', 'Việt Nam', 'Thương hiệu bồn nước và thiết bị nước hàng đầu Việt Nam', TRUE, TRUE, 1),
(2, 'Sơn Hà', 'son-ha', 'Việt Nam', 'Thương hiệu bồn nước inox uy tín với công nghệ Nhật Bản', TRUE, TRUE, 2),
(3, 'Ferroli', 'ferroli', 'Ý', 'Thương hiệu máy nước nóng cao cấp từ Ý', TRUE, TRUE, 3),
(4, 'Ariston', 'ariston', 'Ý', 'Thương hiệu thiết bị nước nóng hàng đầu châu Âu', TRUE, TRUE, 4),
(5, 'Kangaroo', 'kangaroo', 'Việt Nam', 'Thương hiệu máy lọc nước phổ biến tại Việt Nam', TRUE, FALSE, 5),
(6, 'Sunhouse', 'sunhouse', 'Việt Nam', 'Thương hiệu gia dụng Việt Nam với đa dạng sản phẩm', TRUE, FALSE, 6),
(7, 'Midea', 'midea', 'Trung Quốc', 'Tập đoàn gia dụng lớn với công nghệ hiện đại', TRUE, FALSE, 7)
ON CONFLICT (slug) DO NOTHING;

-- LOẠI SẢN PHẨM (6)
INSERT INTO nuoc_product_types (id, category_id, name, slug, description, icon_name, is_active, sort_order, seo_title) VALUES
(1, 5, 'Bồn nước', 'bon-nuoc', 'Bồn nước inox, bồn nhựa các loại dung tích', 'container', TRUE, 1, 'Bồn nước Inox & Nhựa | Đông Phú Gia'),
(2, 5, 'Máy nước nóng', 'may-nuoc-nong', 'Máy nước nóng trực tiếp và gián tiếp', 'thermometer', TRUE, 2, 'Máy nước nóng cao cấp | Đông Phú Gia'),
(3, 5, 'Năng lượng mặt trời', 'nang-luong-mat-troi', 'Máy nước nóng năng lượng mặt trời tiết kiệm điện', 'sun', TRUE, 3, 'Năng lượng mặt trời | Đông Phú Gia'),
(4, 5, 'Bơm nhiệt', 'bom-nhiet', 'Bơm nhiệt heat pump dân dụng và công nghiệp', 'activity', TRUE, 4, 'Bơm nhiệt Heat Pump | Đông Phú Gia'),
(5, 5, 'Máy nước cây nóng lạnh', 'may-nuoc-cay-nong-lanh', 'Máy nước nóng lạnh văn phòng và gia đình', 'glass-water', TRUE, 5, 'Máy nước cây nóng lạnh | Đông Phú Gia'),
(6, 5, 'Máy lọc nước', 'may-loc-nuoc', 'Máy lọc nước RO, Nano cho gia đình và công nghiệp', 'droplets', TRUE, 6, 'Máy lọc nước | Đông Phú Gia')
ON CONFLICT (slug) DO NOTHING;

-- Reset sequences sau khi insert explicit IDs
SELECT setval('nuoc_brands_id_seq', (SELECT MAX(id) FROM nuoc_brands));
SELECT setval('nuoc_product_types_id_seq', (SELECT MAX(id) FROM nuoc_product_types));

-- SUBTYPES (15)
-- Bồn nước (3)
INSERT INTO nuoc_subtypes (product_type_id, name, slug, sort_order) VALUES
(1, 'Bồn đứng', 'bon-dung', 1),
(1, 'Bồn ngang', 'bon-ngang', 2),
(1, 'Bồn công nghiệp', 'bon-cong-nghiep', 3)
ON CONFLICT (slug) DO NOTHING;

-- Máy nước nóng (2)
INSERT INTO nuoc_subtypes (product_type_id, name, slug, sort_order) VALUES
(2, 'Máy nước nóng trực tiếp', 'may-nuoc-nong-truc-tiep', 1),
(2, 'Máy nước nóng gián tiếp', 'may-nuoc-nong-gian-tiep', 2)
ON CONFLICT (slug) DO NOTHING;

-- Năng lượng mặt trời (2)
INSERT INTO nuoc_subtypes (product_type_id, name, slug, sort_order) VALUES
(3, 'Ống chân không', 'ong-chan-khong', 1),
(3, 'Tấm phẳng', 'tam-phang', 2)
ON CONFLICT (slug) DO NOTHING;

-- Bơm nhiệt (2)
INSERT INTO nuoc_subtypes (product_type_id, name, slug, sort_order) VALUES
(4, 'Bơm nhiệt dân dụng', 'bom-nhiet-dan-dung', 1),
(4, 'Bơm nhiệt công nghiệp', 'bom-nhiet-cong-nghiep', 2)
ON CONFLICT (slug) DO NOTHING;

-- Máy nước cây nóng lạnh (2)
INSERT INTO nuoc_subtypes (product_type_id, name, slug, sort_order) VALUES
(5, 'Máy nước nóng lạnh', 'may-nuoc-nong-lanh', 1),
(5, 'Máy lọc nước nóng lạnh', 'may-loc-nuoc-nong-lanh', 2)
ON CONFLICT (slug) DO NOTHING;

-- Máy lọc nước (4)
INSERT INTO nuoc_subtypes (product_type_id, name, slug, sort_order) VALUES
(6, 'Máy lọc nước RO', 'may-loc-nuoc-ro', 1),
(6, 'Máy lọc nước Nano', 'may-loc-nuoc-nano', 2),
(6, 'Máy lọc nước gia đình', 'may-loc-nuoc-gia-dinh', 3),
(6, 'Máy lọc nước công nghiệp', 'may-loc-nuoc-cong-nghiep', 4)
ON CONFLICT (slug) DO NOTHING;

-- CHẤT LIỆU (3)
INSERT INTO nuoc_materials (id, name, slug, description, sort_order) VALUES
(1, 'Inox 304', 'inox-304', 'Thép không gỉ SUS304 cao cấp, bền bỉ', 1),
(2, 'Inox 201', 'inox-201', 'Thép không gỉ SUS201, giá thành hợp lý', 2),
(3, 'Nhựa', 'nhua', 'Nhựa HDPE nguyên sinh, an toàn vệ sinh', 3)
ON CONFLICT (slug) DO NOTHING;

SELECT setval('nuoc_materials_id_seq', (SELECT MAX(id) FROM nuoc_materials));
