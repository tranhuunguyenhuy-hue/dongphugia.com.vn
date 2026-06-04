# Báo Cáo Kiểm Tra UI/UX — Đông Phú Gia
**Ngày kiểm tra:** 27/05/2026  
**Người kiểm tra:** Claude (Tech Lead, Cowork)  
**Phạm vi:** Toàn bộ giao diện frontend — desktop + mobile + SEO  
**Phương pháp:** Duyệt trực tiếp trên production (`dongphugia.com.vn`) + phân tích mã nguồn

---

## Tóm tắt nhanh

| Mức độ | Số lượng |
|--------|----------|
| 🔴 CRITICAL (cần sửa ngay, đang gây thiệt hại) | 5 |
| 🟠 HIGH (ảnh hưởng lớn đến conversion) | 8 |
| 🟡 MEDIUM (ảnh hưởng UX đáng kể) | 11 |
| 🔵 LOW (cải thiện nhỏ, polish) | 9 |
| **Tổng** | **33 issues** |

---

## CRITICAL — Phải sửa ngay

### C1. Search page crash khi có query
**Trang:** `/tim-kiem?q=<bất kỳ từ nào>`  
**Triệu chứng:** Trang trắng đen hoàn toàn — "This page couldn't load / A server error occurred." — ERROR 3227098399  
**Nguyên nhân:** Server Component (`src/app/(public)/tim-kiem/page.tsx`) gọi internal `fetch()` tới `/api/search?q=...`. Trên Vercel production, self-fetch này crash không có error handling, khiến toàn bộ Server Component render thất bại.  
**Ảnh hưởng:** **Chức năng tìm kiếm hoàn toàn không hoạt động**. Bất kỳ user nào gõ từ khóa vào search đều thấy màn hình đen.  
**Fix:** Wrap `fetchSearchResults()` trong try/catch, trả về empty state thay vì crash. Hoặc tốt hơn: gọi thẳng Prisma từ Server Component thay vì self-fetch HTTP.

---

### C2. Trang 404 có nền đen — hoàn toàn không có style
**Trang:** Bất kỳ URL không tồn tại (ví dụ: `/thiet-bi-ve-sinh/bon-cau/slug-khong-ton-tai`)  
**Triệu chứng:** Nền đen hoàn toàn, chữ trắng — Next.js default 404 component không được styled.  
**Ảnh hưởng:** Rất mất uy tín khi user nhập URL sai hoặc click link cũ. Không có navigation để quay về.  
**Fix:** Tạo `src/app/not-found.tsx` với layout đầy đủ (header, footer, nút quay về trang chủ, gợi ý danh mục).

---

### C3. Google Maps embed bị lỗi trên trang Liên hệ
**Trang:** `/lien-he`  
**Triệu chứng:** Map hiển thị box đen với text: *"Google Maps Platform rejected your request. Invalid request. Invalid 'pb' parameter."*  
**Ảnh hưởng:** Showroom không có bản đồ → user không tìm được địa chỉ → giảm niềm tin, tăng tỷ lệ bỏ trang.  
**Fix:** Kiểm tra lại Google Maps embed URL — param `pb` malformed. Dùng Google Maps Embed API với API Key hợp lệ, hoặc dùng iframe embed URL chuẩn từ Google Maps.

---

### C4. Ảnh sản phẩm KHÔNG hiển thị trong giỏ hàng
**Trang:** `/gio-hang` và Cart Drawer  
**Triệu chứng:** Mỗi dòng sản phẩm trong giỏ chỉ hiện text và giá — ô ảnh trống trắng (blank square).  
**Ảnh hưởng:** User không thể xác nhận trực quan sản phẩm mình đã chọn. Đây là lỗi chức năng cơ bản của e-commerce.  
**Fix:** Đảm bảo `image_main_url` được lưu vào cart store (Zustand) khi add to cart, và render đúng trong `cart-drawer.tsx` + cart page.

---

### C5. Broken images: icon subcategory trên trang chủ và danh mục
**Trang:** Trang chủ, `/thiet-bi-ve-sinh`  
**Triệu chứng:** Ít nhất 2 subcategory icon (Phụ Kiện Bồn Cầu, Thân Bồn Cầu) hiển thị ảnh vỡ — URL là `#` placeholder.  
**Ảnh hưởng:** Giao diện nhìn thiếu chuyên nghiệp ngay ở first fold.  
**Fix:** Upload đúng ảnh icon cho các subcategory bị thiếu trong Admin CMS. Thêm fallback UI khi `image_url` là null hoặc `#`.

---

## HIGH — Ảnh hưởng lớn đến Conversion

### H1. Không có sticky "Add to Cart" khi scroll trên PDP
**Trang:** PDP  
**Triệu chứng:** Khi scroll xuống đọc specs/description, không có floating bar để add to cart. User phải scroll ngược lên để thêm vào giỏ.  
**Benchmark:** Shopee, Tiki, Lazada đều có sticky bottom bar hoặc sticky right panel.  
**Fix:** Thêm sticky CTA bar xuất hiện sau khi scroll qua nút "Thêm vào giỏ hàng" gốc, hiển thị tên sản phẩm ngắn + giá + nút thêm giỏ.

---

### H2. Hero Banner tải trắng 3+ giây (CLS)
**Trang:** Trang chủ  
**Triệu chứng:** Banner hero load blank → pop in sau 3 giây → Cumulative Layout Shift rõ ràng.  
**Nguyên nhân:** Ảnh banner không có `priority` loading hoặc thiếu skeleton placeholder.  
**Ảnh hưởng:** Core Web Vitals CLS cao → ảnh hưởng SEO ranking + trải nghiệm tệ.  
**Fix:** Thêm `priority` prop trên `<Image>` của banner slide đầu tiên. Thêm `background-color` placeholder hoặc blur placeholder.

---

### H3. Sidebar "Banner quảng cáo" trống trên category pages
**Trang:** `/thiet-bi-ve-sinh` và các danh mục khác  
**Triệu chứng:** Slot banner bên phải sidebar hoàn toàn trống — chỉ thấy một khoảng trắng.  
**Ảnh hưởng:** Wasted real estate, giao diện nhìn chưa hoàn chỉnh, mất cơ hội promote sản phẩm nổi bật.  
**Fix:** Điền nội dung banner qua Admin CMS hoặc ẩn slot nếu không có data.

---

### H4. Variant dropdown hiển thị tên sản phẩm đầy đủ — quá dài
**Trang:** PDP có nhiều variant  
**Triệu chứng:** Dropdown "LOẠI CHỖ NGỒI" hiển thị "Bồn cầu 2 khối TOTO CS302DE2 kèm nắp rửa cơ Ecowasher TCW07S" — tên dài 60+ ký tự.  
**Ảnh hưởng:** User không phân biệt được các variant khi tên chúng gần giống nhau.  
**Fix:** Hiển thị chỉ phần tên khác biệt của variant (ví dụ: "Nắp rửa cơ TCW07S", "Nắp rửa điện tử SB02AS") thay vì tên đầy đủ.

---

### H5. Giỏ hàng: layout trống lớn khi cart ít item hơn form
**Trang:** `/gio-hang`  
**Triệu chứng:** Khi cart có ít hơn 3-4 sản phẩm, cột trái (danh sách sản phẩm) kết thúc sớm trong khi cột phải (form đặt hàng) cao hơn → khoảng trắng ~300px bên trái rất xấu.  
**Fix:** Đổi layout thành stack trên mobile/tablet. Trên desktop có thể dùng `min-height` hoặc chuyển form xuống dưới danh sách sản phẩm thay vì side-by-side.

---

### H6. Ảnh sản phẩm trên category page tải rất chậm
**Trang:** `/thiet-bi-ve-sinh` và các listing pages  
**Triệu chứng:** Product card images tải 3+ giây — trong lúc đó card hiển thị trống.  
**Nguyên nhân:** Ảnh từ Bunny CDN chưa có `blurDataURL` placeholder, có thể thiếu `sizes` attribute đúng.  
**Fix:** Thêm `placeholder="blur"` + `blurDataURL` base64 cho ảnh sản phẩm. Xem xét preload ảnh cho fold đầu tiên.

---

### H7. Không có nút "Xem thêm" / Load more trên homepage sections
**Trang:** Trang chủ  
**Triệu chứng:** Các section "Sản phẩm nổi bật", "Khuyến mãi"... hiển thị toàn bộ mà không có phân trang hay nút Load More → trang chủ cuộn rất dài.  
**Fix:** Giới hạn mỗi section 8-12 sản phẩm + "Xem tất cả →" link đến category/filter tương ứng.

---

### H8. Dữ liệu "Nơi sản xuất" bị ghép sai: "Việt Nam In-đô-nê-xi-a"
**Trang:** PDP — tab Thông số kỹ thuật  
**Triệu chứng:** Trường `Nơi sản xuất` hiển thị "Việt Nam In-đô-nê-xi-a" — hai giá trị origins bị nối lại.  
**Nguyên nhân:** Lỗi data import — nhiều origins được concat thành một string.  
**Fix:** Audit lại bảng `origins` và field `origin_id` trong products. Nếu một sản phẩm có nhiều origin, render thành list hoặc chọn origin chính.

---

## MEDIUM — Ảnh hưởng UX Đáng Kể

### M1. Tiêu đề trang bị trùng tên thương hiệu (hệ thống)
**Ảnh hưởng:** Tất cả các trang  
**Triệu chứng:** `<title>` hiển thị "Thiết Bị Vệ Sinh | **Đông Phú Gia | Đông Phú Gia**" — tên thương hiệu bị lặp 2 lần.  
**Nguyên nhân:** Root layout (`src/app/layout.tsx`) đặt `template: "%s | Đông Phú Gia"`. Các page lại tự thêm "| Đông Phú Gia" vào title của mình, dẫn đến double append.  
**Fix:** Trong tất cả page-level metadata, bỏ " | Đông Phú Gia" ở cuối. Ví dụ: `title: "Thiết Bị Vệ Sinh"` (template tự append). Đây là lỗi systemic — cần sửa tất cả page trong `/src/app/(public)/`.

---

### M2. "chính sách" trong form đặt hàng là plain text, không phải link
**Trang:** `/gio-hang`, `/lien-he`  
**Triệu chứng:** "Bằng cách đặt hàng, bạn đồng ý với **chính sách** của Đông Phú Gia." — chữ "chính sách" không phải hyperlink.  
**Fix:** Link "chính sách" tới trang `/chinh-sach-bao-mat` hoặc `/dieu-khoan`. Nếu trang đó chưa có, cần tạo.

---

### M3. Thiếu khoảng cách hợp lý — excess whitespace giữa các section
**Ảnh hưởng:** Homepage, About, Category pages  
**Triệu chứng:** Khoảng trắng 80-150px giữa nhiều section — trang cảm giác rời rạc, không được thiết kế nhất quán.  
**Fix:** Review và chuẩn hóa spacing giữa sections: `py-12 lg:py-16` là hợp lý. Các section hiện tại có thể đang dùng `py-20 lg:py-28` quá cao.

---

### M4. Khoảng trắng 50px thừa giữa thumbnail gallery và tab bar trên PDP
**Trang:** PDP  
**Triệu chứng:** Sau thumbnail track có một khoảng trắng lớn (~50px) trước khi tab bar xuất hiện.  
**Fix:** Xem xét lại margin/padding của gallery container và tab component.

---

### M5. SKU code hiển thị trên card sản phẩm — thông tin không cần thiết
**Trang:** Category listing, related products  
**Triệu chứng:** Mỗi product card hiển thị "Mã: CS302DE2#W" — gây clutter, không phù hợp với B2C UX.  
**Fix:** Ẩn SKU trên product card frontend. SKU chỉ cần hiển thị trên PDP (đã có ở đó rồi).

---

### M6. Không có social media links trong footer
**Trang:** Tất cả (footer)  
**Triệu chứng:** Footer không có icon/link Facebook, Zalo, YouTube.  
**Fix:** Thêm social links với icon vào footer. Zalo là kênh quan trọng nhất với khách hàng Việt Nam.

---

### M7. "Từ khóa phổ biến" trong Blog sidebar trống
**Trang:** `/tin-tuc`  
**Triệu chứng:** Section "Từ khóa phổ biến" render nhưng không có tag nào.  
**Fix:** Thêm tags cho các blog posts qua Admin CMS, hoặc ẩn section nếu chưa có data.

---

### M8. Breadcrumb không hiển thị trên mobile
**Code:** `hidden lg:flex` trên breadcrumb  
**Triệu chứng:** Mobile user không biết mình đang ở đâu trong cây danh mục.  
**Fix:** Hiển thị breadcrumb đơn giản trên mobile — có thể chỉ hiện 2 cấp cuối cùng (ví dụ: "Thiết bị vệ sinh > Bồn cầu").

---

### M9. Hero banner aspect ratio cứng — quá thấp trên mobile
**Code:** `aspectRatio: '1216/568'` trên hero banner  
**Triệu chứng:** Trên màn hình 390px, banner cao chỉ ~182px — quá thấp, không impactful.  
**Fix:** Thêm responsive aspect ratio: `aspect-[4/3] sm:aspect-[16/9] lg:aspect-[1216/568]` hoặc thiết kế banner riêng cho mobile.

---

### M10. Ảnh hero trong Blog listing không load
**Trang:** `/tin-tuc`  
**Triệu chứng:** Featured article hiển thị blank image placeholder thay vì ảnh bài viết.  
**Fix:** Kiểm tra `thumbnail_url` của blog post nổi bật — có thể null hoặc URL sai. Thêm fallback image.

---

### M11. Related products hiển thị đối thủ cạnh tranh (INAX) trên trang TOTO
**Trang:** PDP TOTO  
**Triệu chứng:** Section "Sản phẩm liên quan" của bồn cầu TOTO hiển thị 4 sản phẩm INAX — brand khác.  
**Ảnh hưởng:** User có thể rời đi mua brand khác thay vì mua TOTO, hoặc cảm thấy confusing.  
**Fix:** Ưu tiên hiển thị sản phẩm cùng brand + cùng subcategory. Chỉ fallback sang brand khác nếu không đủ sản phẩm cùng brand.

---

## LOW — Polish và Cải Thiện Nhỏ

### L1. Định dạng giá không nhất quán trên product cards
**Triệu chứng:** Một số card hiển thị "31.386.400đ" (không có space trước đ), số khác hiển thị "7.363.500 đ" (có space).  
**Fix:** Chuẩn hóa `formatPrice()` function — áp dụng nhất quán toàn site.

---

### L2. Trang giỏ hàng có `<title>` sai — dùng homepage title
**Trang:** `/gio-hang`  
**Triệu chứng:** `<title>` là "Đông Phú Gia - Vật liệu xây dựng cao cấp tại Đà Lạt" thay vì "Giỏ hàng | Đông Phú Gia".  
**Fix:** Thêm `export const metadata: Metadata = { title: 'Giỏ hàng' }` vào cart page.

---

### L3. Vòng tròn loupe/zoom bí ẩn xuất hiện trên ảnh PDP
**Trang:** PDP  
**Triệu chứng:** Một vòng tròn nhỏ xuất hiện ở góc dưới trái của ảnh chính — không rõ mục đích, không có tooltip.  
**Fix:** Nếu là tính năng zoom: thêm tooltip "Phóng to ảnh". Nếu là bug: xóa.

---

### L4. Cart drawer không có link "Xem giỏ hàng đầy đủ"
**Trang:** Cart drawer (PDP, listing pages)  
**Triệu chứng:** Drawer chỉ có "Tiến hành đặt hàng" và "Tiếp tục mua hàng" — không có option xem full cart page.  
**Fix:** Thêm "Xem giỏ hàng →" link dẫn tới `/gio-hang`.

---

### L5. Không hiển thị số lượng sản phẩm trên trang danh mục
**Trang:** Category listing  
**Triệu chứng:** Không có "Hiển thị X trong Y sản phẩm" — user không biết kho hàng có bao nhiêu sản phẩm.  
**Fix:** Thêm product count: "Đang hiển thị 1-24 / 156 sản phẩm".

---

### L6. Không có trang chính sách bảo mật / điều khoản sử dụng
**Triệu chứng:** Footer có "Điều khoản" và "Quyền riêng tư" nhưng click vào có thể trả 404 hoặc empty.  
**Fix:** Tạo trang `/dieu-khoan` và `/quyen-rieng-tu` với nội dung cơ bản.

---

### L7. Form checkout không có dropdown tỉnh/quận/phường
**Trang:** `/gio-hang`  
**Triệu chứng:** Trường "Địa chỉ nhận hàng" là một input text duy nhất với placeholder "Số nhà, đường, phường/xã, tỉnh/thành".  
**Fix:** Thêm dropdown phân cấp tỉnh → quận → phường (có thể dùng API dữ liệu hành chính Việt Nam) để giảm lỗi địa chỉ và tăng chất lượng leads.

---

### L8. Không có indication khi "Thêm vào giỏ hàng" đang xử lý
**Trang:** PDP  
**Triệu chứng:** Khi click "Thêm vào giỏ hàng", không có loading state trên button — có thể click nhiều lần dẫn đến add duplicate.  
**Fix:** Thêm loading spinner + disable button khi đang xử lý. Kiểm tra Zustand store để prevent duplicate add.

---

### L9. Footer không có link sitemap / map to all categories
**Trang:** Footer  
**Triệu chứng:** Footer chỉ có 4 danh mục chính — thiếu link đến subcategories phổ biến.  
**Fix:** Thêm một số subcategory link phổ biến (Bồn cầu, Sen tắm, Chậu rửa...) để cải thiện internal linking và SEO.

---

## Phân tích Responsive / Mobile

### Điểm tốt (đã implement đúng)
- Header chuyển sang hamburger menu đúng cách (`flex lg:hidden`)  
- Mobile Menu Sheet với accordion cho subcategories  
- Category page: 2-column grid trên mobile, filter drawer ẩn/hiện đúng  
- PDP: Stack dọc trên mobile (`flex flex-col lg:grid lg:grid-cols-2`)  
- Cart: Stack dọc trên mobile (`grid-cols-1 lg:grid-cols-[1fr_400px]`)  
- FloatingContact widget điều chỉnh vị trí cho product page trên mobile

### Vấn đề cần cải thiện trên Mobile
- Hero banner quá thấp (182px) trên màn hình 390px — cần responsive aspect ratio
- Breadcrumb ẩn hoàn toàn trên mobile — mất context điều hướng  
- PDP: Khi scroll xuống, nút add-to-cart biến mất và không có sticky mobile CTA bar

---

## Phân tích SEO

| Vấn đề | Trang bị ảnh hưởng | Mức độ |
|--------|-------------------|--------|
| `<title>` trùng lặp "Đông Phú Gia" | Tất cả các trang | 🟠 HIGH |
| Search page crash → không index được qua search | `/tim-kiem` | 🔴 CRITICAL |
| Breadcrumb không render trên mobile (no structured data) | Category + PDP | 🟡 MEDIUM |
| Thiếu trang Privacy Policy / Terms | `/quyen-rieng-tu`, `/dieu-khoan` | 🔵 LOW |
| Blog images không load → Open Graph images bị lỗi | `/tin-tuc` | 🟡 MEDIUM |

---

## Ma trận Ưu tiên Xử lý

```
                  IMPACT
                  Cao           Thấp
EFFORT  Thấp   [Quick Win]    [Nice to have]
              C2, C3, M1     L1, L2, L4, L9
              C4, C5, H8
        
        Cao    [Big Bets]     [Reconsider]  
              C1, H1, H2     H7, L7
              H5, H6
```

### Sprint ưu tiên đề xuất

**Sprint 1 — Bug Fixes (1 tuần):**
- C1: Fix search page crash
- C2: Tạo custom 404 page
- C3: Fix Google Maps embed
- C4: Fix cart images
- M1: Fix tất cả page title metadata (systemic 1-liner fix)

**Sprint 2 — Conversion Optimizations (2 tuần):**
- H1: Sticky Add-to-Cart bar trên PDP
- H2: Prioritize hero banner loading
- H4: Shorten variant dropdown labels
- H5: Fix cart layout khi ít item
- H8: Fix "Nơi sản xuất" data issue

**Sprint 3 — Polish & SEO (1 tuần):**
- C5: Upload missing subcategory icons
- H3: Fill or hide empty banner slot
- M3-M5: Spacing, SKU visibility, social links
- L1-L2: Price format consistency, cart page title

---

## Phụ lục: Screenshots Tham khảo

Các lỗi được phát hiện qua live browsing trên `dongphugia.com.vn` ngày 27/05/2026 với Chrome desktop 1568px viewport + code review tại `/Users/m-ac/Projects/dongphugia`.

**Trang đã kiểm tra:**
- `/` — Trang chủ
- `/thiet-bi-ve-sinh` — Category listing
- `/thiet-bi-ve-sinh/bon-cau` — Subcategory listing  
- `/thiet-bi-ve-sinh/bon-cau/bon-cau-toto-cs302de2-2-khoi-nap-rua-co-tcw07s` — PDP
- `/gio-hang` — Giỏ hàng + Checkout
- `/tim-kiem?q=bồn+cầu` — Search (CRASH)
- `/tin-tuc` — Blog listing
- `/lien-he` — Liên hệ
- `/ve-chung-toi` — Về chúng tôi
- `[URL không tồn tại]` — 404 page
- Mobile: Code review (viewport resize blocked bởi browser extension)
