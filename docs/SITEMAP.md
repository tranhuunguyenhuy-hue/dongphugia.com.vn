# Đông Phú Gia — Sitemap chiến lược 3 năm

**Cập nhật:** 31/05/2026 · **Mô hình mục tiêu:** B2C full e-commerce + kênh B2B (nhà thầu/đại lý)
**Phạm vi mở rộng:** Tài khoản & đơn hàng · Thanh toán online · Content & SEO · Loyalty & khuyến mãi

> Ký hiệu trạng thái:
> ✅ Đã có (route hiện tại) · 🔨 Phase 1 (0–12 tháng) · 🟡 Phase 2 (12–24 tháng) · 🔵 Phase 3 (24–36 tháng)

---

## 0. Tổng quan định hướng theo phase

| Phase | Mốc | Trọng tâm | Kết quả |
|-------|-----|-----------|---------|
| **Phase 1** | 0–12 tháng | Hoàn thiện B2C: tài khoản, giỏ hàng → checkout online, theo dõi đơn | Khách mua & thanh toán online trọn vẹn |
| **Phase 2** | 12–24 tháng | Kênh B2B (báo giá, công nợ, giá sỉ) + Loyalty + Content/SEO chiều sâu | Tăng AOV, giữ chân, traffic organic |
| **Phase 3** | 24–36 tháng | Cá nhân hoá, đa kênh, mở rộng dịch vụ & khu vực | Quy mô hoá, lợi thế cạnh tranh dài hạn |

---

## 1. PUBLIC SITE (khách hàng)

### 1.1 Trang chủ & điều hướng
- `/` — Trang chủ ✅
  - Hero / banner động ✅
  - Sản phẩm nổi bật, danh mục, dự án tiêu biểu 🔨
  - Khối "Dành cho nhà thầu / đại lý" (CTA B2B) 🟡
  - Gợi ý cá nhân hoá theo lịch sử xem 🔵

### 1.2 Danh mục sản phẩm (4 ngành hàng)
- `/thiet-bi-ve-sinh` → `/[sub]` → `/[sub]/[slug]` ✅
- `/thiet-bi-bep` → `/[sub]` → `/[sub]/[slug]` ✅ *(schema riêng: bep_brands / bep_product_types / bep_subtypes)*
- `/vat-lieu-nuoc` → `/[sub]` → `/[sub]/[slug]` ✅
- `/gach-op-lat` → `/[sub]` → `/[sub]/[slug]` ✅
- Bộ lọc nâng cao (thương hiệu, giá, thông số kỹ thuật) 🔨
- So sánh sản phẩm 🟡
- Đánh giá & hình ảnh từ khách (UGC) 🟡
- Danh mục mở rộng / ngành hàng thứ 5 🔵

### 1.3 Trang sản phẩm chi tiet
- Thông số, ảnh CDN, mô tả ✅
- Tình trạng tồn kho theo thời gian thực 🔨
- "Thêm vào giỏ" / "Mua ngay" 🔨
- Sản phẩm liên quan / mua kèm (upsell) 🔨
- Hỏi đáp sản phẩm (Q&A) 🟡
- Báo giá số lượng lớn (CTA sang B2B) 🟡

### 1.4 Tìm kiếm
- `/tim-kiem` ✅
- Autocomplete + gợi ý ✅/🔨
- Tìm kiếm theo bộ lọc & sắp xếp 🔨
- Tìm kiếm theo hình ảnh / mã SP 🔵

---

## 2. GIỎ HÀNG, CHECKOUT & THANH TOÁN ONLINE

- `/gio-hang` — Giỏ hàng (Zustand) ✅
- `/checkout` — Trang thanh toán nhiều bước 🔨
  - Thông tin giao hàng (chọn từ sổ địa chỉ) 🔨
  - Phương thức vận chuyển 🔨
  - Cổng thanh toán: VNPay / Momo / chuyển khoản / COD 🔨
  - Áp mã giảm giá / điểm thưởng 🟡
- `/dat-hang-thanh-cong` — Xác nhận đơn ✅
- `/theo-doi-don-hang` — Tra cứu đơn (có / không cần đăng nhập) 🔨
- Thanh toán công nợ B2B (đối tác) 🟡
- Trả góp / hạn mức tín dụng đại lý 🔵

---

## 3. TÀI KHOẢN KHÁCH HÀNG (B2C)

- `/dang-nhap` · `/dang-ky` · `/quen-mat-khau` 🔨
- `/tai-khoan` — Bảng điều khiển 🔨
  - `/tai-khoan/don-hang` — Lịch sử & trạng thái đơn 🔨
  - `/tai-khoan/dia-chi` — Sổ địa chỉ giao hàng 🔨
  - `/tai-khoan/thong-tin` — Hồ sơ cá nhân 🔨
  - `/tai-khoan/yeu-thich` — Wishlist 🟡
  - `/tai-khoan/diem-thuong` — Điểm & hạng thành viên 🟡
  - `/tai-khoan/ma-giam-gia` — Ví voucher 🟡
  - `/tai-khoan/danh-gia` — Đánh giá đã viết 🟡
- Đăng nhập mạng xã hội (Google/Zalo) 🟡

---

## 4. KÊNH B2B (nhà thầu / đại lý)

- `/doi-tac` — Trang giới thiệu đối tác ✅
- `/b2b/dang-ky` — Đăng ký tài khoản doanh nghiệp 🟡
- `/b2b` — Cổng B2B (sau đăng nhập) 🟡
  - `/b2b/bao-gia` — Yêu cầu & quản lý báo giá ✅*(admin quote-requests đã có)* → mở public 🟡
  - `/b2b/gia-si` — Bảng giá sỉ theo hạng 🟡
  - `/b2b/cong-no` — Theo dõi công nợ 🟡
  - `/b2b/dat-hang-nhanh` — Đặt hàng theo mã/file Excel 🟡
  - `/b2b/lich-su` — Lịch sử mua & hoá đơn 🟡
- Quản lý dự án / hồ sơ thầu 🔵
- API/EDI tích hợp cho đại lý lớn 🔵

---

## 5. CONTENT & SEO

- `/blog` → `/[categorySlug]` → `/[categorySlug]/[postSlug]` ✅
- `/du-an` — Dự án thực tế (case study) ✅
- `/huong-dan` — Cẩm nang chọn VLXD, lắp đặt, bảo trì 🔨
- Landing pages theo khu vực Đà Lạt / Lâm Đồng 🟡
- Landing theo nhu cầu (nhà phố, biệt thự, homestay) 🟡
- `/bo-suu-tap` — Bộ sưu tập / phong cách thiết kế 🟡
- Trung tâm media (video, 360°, catalogue PDF) 🔵
- `sitemap.xml` ✅ · Schema.org / structured data 🔨

---

## 6. LOYALTY & KHUYẾN MÃI

- `/khuyen-mai` — Trang tổng hợp ưu đãi 🔨
- `/flash-sale` — Sự kiện giảm giá theo giờ 🟡
- Hệ thống mã giảm giá (admin tạo, user áp) 🔨
- Chương trình tích điểm & hạng thành viên 🟡
- Giới thiệu bạn bè (referral) 🔵
- Ưu đãi sinh nhật / theo segment 🔵

---

## 7. DỊCH VỤ & HỖ TRỢ

- `/dich-vu-lap-dat` — Dịch vụ lắp đặt ✅
- `/van-chuyen-giao-nhan` — Vận chuyển & giao nhận ✅
- `/lien-he` — Liên hệ ✅
- `/ve-chung-toi` — Về chúng tôi ✅
- `/thong-tin-hang-hoa` · `/thong-tin-gia` — Thông tin hàng hoá & giá ✅
- `/cau-hoi-thuong-gap` — FAQ 🔨
- Live chat / Zalo OA / chatbot tư vấn 🟡
- `/bao-hanh` — Tra cứu & yêu cầu bảo hành 🟡

---

## 8. PHÁP LÝ & HỆ THỐNG

- `/dieu-kien-kinh-doanh` ✅
- `/dieu-kien-giao-dich` ✅
- `/chinh-sach-bao-mat` ✅
- `/chinh-sach-doi-tra` — Đổi trả & hoàn tiền 🔨
- `/chinh-sach-van-chuyen` — Chính sách vận chuyển 🔨
- `/maintenance` — Trang bảo trì ✅

---

## 9. ADMIN / CMS (nội bộ)

- `/admin` Dashboard ✅
- Sản phẩm, Danh mục ✅
- Đơn hàng `/admin/orders` ✅ → mở rộng quản lý fulfillment 🔨
- Khách hàng `/admin/customers` ✅
- Báo giá `/admin/quote-requests` (+ builder) ✅
- Đối tác `/admin/doi-tac` ✅
- Blog, Dự án, Banner ✅
- Người dùng & phân quyền ✅
- Quản lý khuyến mãi / voucher 🔨
- Quản lý loyalty & điểm thưởng 🟡
- Quản lý tồn kho & nhập xuất 🟡
- Báo cáo & analytics (doanh thu, AOV, cohort) 🟡
- Quản lý B2B (hạng giá, công nợ, duyệt tài khoản) 🟡

---

## 10. Lộ trình ưu tiên (tóm tắt)

**Phase 1 (0–12 th) — Hoàn thiện B2C giao dịch**
Tài khoản khách → giỏ hàng → checkout + cổng thanh toán → theo dõi đơn → tồn kho realtime → mã giảm giá cơ bản → FAQ, chính sách đổi trả/vận chuyển → structured data SEO.

**Phase 2 (12–24 th) — B2B + giữ chân + nội dung**
Cổng B2B (báo giá public, giá sỉ, công nợ, đặt hàng nhanh) → loyalty/điểm thưởng → wishlist → flash sale → landing SEO theo khu vực → live chat → analytics admin.

**Phase 3 (24–36 th) — Quy mô & cá nhân hoá**
Gợi ý cá nhân hoá → referral → media center → API đại lý → trả góp/tín dụng B2B → mở rộng ngành hàng/khu vực.
