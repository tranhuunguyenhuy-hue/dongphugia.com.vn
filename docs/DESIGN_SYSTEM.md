# Đông Phú Gia — Design System (nghiên cứu từ Airbnb)

**Cập nhật:** 01/06/2026 · Nguồn phân tích: airbnb.com (live, computed styles thật)

Tài liệu này trích xuất ngôn ngữ thiết kế của Airbnb và **map sang brand Đông Phú Gia**. Nguyên tắc: giữ nguyên hệ trung tính / spacing / radius / shadow / component pattern của Airbnb (vốn rất sạch và quen thuộc cho e-commerce), **thay accent coral bằng brand xanh `#16a34a`**.

---

## 1. Tokens gốc Airbnb (đo trực tiếp)

| Nhóm | Giá trị thật trên airbnb.com |
|------|------------------------------|
| Font | `Airbnb Cereal VF` (proprietary), fallback Circular / system |
| Text chính | `#222222` |
| Text phụ | `#6A6A6A` |
| Text mờ / disabled | `#B0B0B0` – `#C1C1C1` |
| Border | `#DDDDDD` |
| Surface xám | `#F7F7F7` / `#F2F2F2`, hover `#EBEBEB` |
| Accent (Rausch) | `#FF385C`; nút gradient `#E61E4D → #E31C5F → #D70466`; dark `#C13515` |
| H1 | 28–32px / 700 / line-height ~1.4 |
| Tiêu đề card | 14px / 500 / `#222` |
| Body | 14–16px / 400 |
| Radius ảnh & card | **12px** |
| Radius input | 8–12px |
| Nút | pill `999px` (CTA chính) hoặc bo 8px |
| Nút icon | tròn `50%` trên nền `#F2F2F2` |
| Header height | 80–96px |
| Shadow card nổi | `0 6px 16px rgba(0,0,0,.12)` |
| Shadow menu/search | `rgba(0,0,0,.08) 0 0 0 1px, rgba(0,0,0,.1) 0 8px 24px` |
| Nút CTA | gradient ngang, pill, 16px/500, padding `14px 24px`, cao 48px |

**Đặc trưng nhận diện Airbnb:**
- Thanh search dạng **pill phân đoạn** (Where · When · Who) + nút tròn accent.
- **Listing card**: ảnh bo 12px, tim wishlist góc phải, badge pill trắng góc trái, tiêu đề + dòng phụ xám + ⭐ rating, **không viền** — phân tách bằng khoảng trắng.
- **Reserve card dính**: giá lớn 22px + "for X nights" phụ, lưới ngày/khách bo góc, nút CTA gradient pill, dòng "You won't be charged yet" xám nhỏ.
- Whitespace rộng rãi, ít đường kẻ, bóng mềm.

---

## 2. Token Đông Phú Gia (đã map)

```css
:root{
  /* Typography — Cereal → Inter (gần nhất, free) */
  --font: "Inter", -apple-system, "Segoe UI", Roboto, sans-serif;

  /* Neutrals (giữ nguyên Airbnb) */
  --text:        #222222;
  --text-soft:   #6A6A6A;
  --text-mute:   #B0B0B0;
  --border:      #DDDDDD;
  --surface:     #F7F7F7;
  --surface-2:   #F2F2F2;
  --white:       #FFFFFF;

  /* Accent — BRAND XANH thay coral */
  --brand:       #16a34a;
  --brand-dark:  #15803d;
  --brand-grad:  linear-gradient(to right,#15803d 0%,#16a34a 50%,#22c55e 100%);
  --brand-tint:  #f0fdf4;

  /* Phụ trợ */
  --sale:        #dc2626;   /* chỉ dùng cho flash sale / giảm giá */
  --star:        #16a34a;   /* rating */

  /* Radius */
  --r-img: 12px; --r-card: 12px; --r-input: 10px; --r-pill: 999px;

  /* Shadow */
  --sh-card: 0 6px 16px rgba(0,0,0,.12);
  --sh-pop:  rgba(0,0,0,.08) 0 0 0 1px, rgba(0,0,0,.1) 0 8px 24px;

  /* Spacing scale (base 8) */
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px; --s6:32px; --s7:48px; --s8:64px;
  --container: 1280px;
}
```

> Quyết định màu: Airbnb dùng coral làm primary. Đông Phú Gia **giữ brand xanh `#16a34a` làm primary** (nhận diện VLXD/ngành xây dựng), coral đỏ `#dc2626` chỉ dành cho nhãn giảm giá / flash sale.

---

## 3. Type scale

| Vai trò | Size / Weight / LH | Token |
|---------|--------------------|-------|
| Display (hero) | 40 / 800 / 1.1 | — |
| H1 trang | 30 / 700 / 1.25 | |
| H2 mục | 22 / 600 / 1.3 | |
| H3 | 18 / 600 / 1.35 | |
| Body | 16 / 400 / 1.55 | |
| Tiêu đề card | 15 / 500 / 1.3 | |
| Phụ / caption | 14 / 400 / 1.4 · `--text-soft` | |
| Giá lớn | 22 / 700 · `--text` (không tô xanh để giữ sang) | |

---

## 4. Components (spec áp dụng)

**Nút**
- Primary: nền `--brand-grad`, chữ trắng, pill `--r-pill`, 16/600, padding 14×24, hover sậm.
- Secondary: viền 1px `--text`, nền trắng, bo 8px.
- Ghost: chữ `--brand`, gạch chân khi hover.
- Icon button: tròn 40px, nền `--surface-2`.

**Input / search**
- Cao 48px, bo `--r-input`, viền `--border`, focus viền `--brand` + ring nhẹ.
- Thanh search lớn (home): pill phân đoạn theo phong cách Airbnb, nút tròn `--brand`.

**Product card** (thay listing card Airbnb)
- Ảnh tỉ lệ ~4:3 bo `--r-img`; tim wishlist góc phải; badge `-15%`/`HOT` pill góc trái.
- Tên 15/500; dòng phụ thương hiệu `--text-soft`; giá 16/700; ⭐ rating.
- Không viền; hover nâng `--sh-card` + scale ảnh nhẹ.

**Sticky Buy card** (thay Reserve card — dùng ở trang sản phẩm)
- Card viền `--border`, bo `--r-card`, shadow `--sh-card`, dính khi cuộn.
- Giá 22/700 + "/ sản phẩm" phụ; chọn số lượng bo góc; nút "Thêm vào giỏ" gradient pill; "Mua ngay" outline; dòng "Giao lắp tận nơi Đà Lạt" xám nhỏ.

**Section header**: H2 22/600 + link "Xem tất cả ›" `--brand`.

---

## 5. Khoảng cách & layout

Container tối đa `1280px`, padding ngang 24–40px. Lưới sản phẩm desktop 4–5 cột gap 24px; mobile 2 cột gap 12px. Section cách nhau 48–64px. Header dính 80px, nền trắng + viền đáy mảnh khi cuộn.

---

## 6. Áp dụng cho codebase

- Đưa các token mục 2 vào `src/app/globals.css` qua `@theme` (Tailwind v4 — KHÔNG tạo `tailwind.config.js`).
- `--brand` map sang `--color-primary` hiện có (`#16a34a`) → không phá vỡ convention.
- Font Inter: thêm `next/font` (Inter) ở root layout.
- shadcn/ui vẫn chỉ dùng trong `admin/`; public dùng component thuần theo spec này.

> Xem mock áp dụng thực tế: `docs/hifi-airbnb.html`.
