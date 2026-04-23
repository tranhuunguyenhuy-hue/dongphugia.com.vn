# Task Plan: Khử Hardcode & Tối ưu hoá Frontend

## Phase 1: Centralizing Global Configs (Gôm cấu hình chung)
- [ ] Khởi tạo tệp `src/config/site.ts` (hoặc Context/DB Settings tùy phê duyệt) để chứa toàn bộ thông tin công ty: Hotline, Địa chỉ, Email, Social Links, và SEO Meta Defaults.
- [ ] Thay thế các hardcode string ở `header.tsx`, `footer.tsx`, `lien-he`, `dat-hang-thanh-cong` bằng biến config mới.

## Phase 2: Dynamic Navigation (Cấu trúc Menu linh hoạt)
- [ ] Đẩy `PRODUCT_CATEGORIES`, `NAV_LINKS`, `ABOUT_LINKS` ra khỏi JSX, đưa vào `site.ts` (hoặc fetch từ DB).
- [ ] Tái cấu trúc lại luồng gọi Menu trong `header.tsx` và `footer.tsx` để render qua config.

## Phase 3: Abstracting UI Labels & Magic Strings (Tách nhãn UI & Logic truy vấn)
- [ ] Khởi tạo mảng biến `FEATURED_BRANDS_HOMEPAGE` để thay thế `['toto', 'inax', 'caesar', 'kohler']` trong truy vấn trang chủ.
- [ ] Khởi tạo thư mục `src/locales` (hoặc `constants/labels.ts`) chứa các mapping UI (Ví dụ: `STOCK_STATUS: { 'in_stock': 'Còn hàng' }`).
- [ ] Tích hợp labels constants vào `product-card.tsx` và `brand-badge.tsx`.

## Phase 4: Verification (Nghiệm thu)
- [ ] Kiểm tra build `npm run build` không lỗi.
- [ ] Kiểm tra hiển thị Frontend không đổi nhưng code sạch hơn.
