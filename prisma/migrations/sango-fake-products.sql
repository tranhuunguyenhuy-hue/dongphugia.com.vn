-- Trồng cây Sàn Gỗ (Tạo Data SP Ảo cho trang Sàn gỗ)
-- Sử dụng product_type_id = 1 (Sàn gỗ công nghiệp)

INSERT INTO sango_products (
    sku, name, slug, description, image_main_url, price, price_display, 
    thickness_mm, width_mm, length_mm, ac_rating, warranty_years, 
    is_active, is_featured, sort_order, product_type_id,
    created_at, updated_at
) VALUES 
('SG-DPG-001', 'Sàn gỗ công nghiệp Dong Phu', 'san-go-dong-phu-1', '<p>Sàn gỗ công nghiệp cốt xanh chống ẩm chuẩn HDF.</p>', '/images/logo.png', 250000.00, '250,000 / m2', 8, 195, 1220, 'AC4', 15, TRUE, TRUE, 1, 1, NOW(), NOW()),
('SG-RBN-002', 'Sàn gỗ Robina chống cháy', 'san-go-robina-1', '<p>Siêu phẩm chịu nước bảo hành mối mọt.</p>', '/images/logo.png', 350000.00, '350,000 / m2', 12, 195, 1220, 'AC5', 20, TRUE, FALSE, 2, 1, NOW(), NOW()),
('SG-KOS-003', 'Sàn gỗ Kosmos vân sồi', 'san-go-kosmos-1', '<p>Vân gỗ sồi tự nhiên đẹp mắt.</p>', '/images/logo.png', 180000.00, '180,000 / m2', 8, 125, 808, 'AC3', 10, TRUE, FALSE, 3, 1, NOW(), NOW()),
('SN-HK-004', 'Sàn nhựa hèm khóa xám', 'san-nhua-hem-khoa-1', '<p>Sàn nhựa giả gỗ hèm khoá chống nước tuyệt đối.</p>', '/images/logo.png', 220000.00, '220,000 / m2', 4, 150, 920, 'AC4', 5, TRUE, TRUE, 4, 2, NOW(), NOW()),
('SG-OC-005', 'Sàn gỗ tự nhiên Óc Chó', 'san-go-tu-nhien-1', '<p>Đẳng cấp biệt thự.</p>', '/images/logo.png', 950000.00, '950,000 / m2', 15, 90, 900, 'AC6', 25, TRUE, TRUE, 5, 1, NOW(), NOW())
ON CONFLICT (slug) DO UPDATE SET is_active = TRUE;
