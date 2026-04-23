# Findings: Frontend Hardcode Analysis

## 1. Contact Info & SEO (Khu vực Cấu hình chung)
- Số điện thoại `0855528688` bị fix cứng tại `header.tsx`, `footer.tsx`, `lien-he/page.tsx`, `dat-hang-thanh-cong/page.tsx`, `product-cta.tsx`.
- Các nội dung SEO (`export const metadata`) đang ghi trực tiếp dưới dạng chuỗi `string` bên trong tất cả các file `page.tsx`.
- Các câu CTA như "Gọi điện nhận tư vấn ngay..." hay Social Links (Facebook, Zalo) bị code cứng.

## 2. Menu Navigation (Khu vực Điều hướng)
- `PRODUCT_CATEGORIES`, `NAV_LINKS`, `ABOUT_LINKS` trong `header.tsx` và `footer.tsx` là những static arrays.
- Chưa liên kết linh động mặc dù đã có logic Mega Menu.

## 3. Product Queries (Magic Strings)
- Hàm `getTopProductsPerBrand` tại trang chủ dùng mảng tĩnh: `['toto', 'inax', 'caesar', 'kohler']`.

## 4. UI Labels & Status (Trạng thái và Nhãn sản phẩm)
- Label trạng thái kho hàng: `'Còn hàng'`, `'Hết hàng'`, `'Đặt hàng'`, `'Liên hệ báo giá'` bị viết thẳng trong `product-card.tsx`.
- Các tag: `'Mới'`, `'Nổi bật'`, `'No Image'`.
- Tên category dự phòng: `'Thiết bị vệ sinh'`, `'Đông Phú Gia'`.
- Code logic if/else cứng ở `brand-badge.tsx` (VD: `if (slug === 'toto')`).
