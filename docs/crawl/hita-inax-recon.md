# Recon: Crawl INAX từ hita.com.vn

**Ngày:** 29/05/2026 | **Trang mẫu:** `/bon-cau-1-khoi-inax-ac-1008vrn-543.html`
**Đã recon:** bồn cầu 1 khối, bộ sen tắm, lavabo dương vành, van xả bồn tiểu (phụ kiện)

---

## 1. Breadcrumb → Category mapping

**Selector:** `.breadcrumbs li a`

```js
const breadcrumbs = [...document.querySelectorAll('.breadcrumbs li a')].map(a => ({
  text: a.innerText.trim(),
  href: a.href
}));
// Kết quả: [Trang Chủ, Bồn Cầu, Bồn Cầu 1 Khối]
// breadcrumbs[1] = category cấp 1
// breadcrumbs[2] = subcategory cấp 2
```

**Mapping table cần build:** `hita_category_url → DPG category_id + subcategory_id`

| hita URL | hita label | DPG category | DPG subcategory |
|----------|-----------|--------------|-----------------|
| /bon-cau-253.html | Bồn Cầu | thiet-bi-ve-sinh | bon-cau |
| /bon-cau-1-khoi-260.html | Bồn Cầu 1 Khối | thiet-bi-ve-sinh | bon-cau-1-khoi |
| *(cần điền thêm khi crawl các category khác)* | | | |

---

## 2. Gallery Images — CRITICAL

**Cấu trúc:** Slider dùng Slick.js

```
.slick-track
  └── .item.slick-slide  ← mỗi slide
        └── img.img-fluid.lazy  ← ảnh (lazy load)
```

### ⚠️ Lazy loading
- Hầu hết ảnh dùng class `lazy` — cần `img.getAttribute('data-src')` để lấy URL thật
- **EXCEPTION:** Slide đầu tiên (ảnh avatar) đôi khi KHÔNG có `data-src` — đã load sẵn, chỉ có `img.src`
- **Rule:** Luôn dùng `img.getAttribute('data-src') || img.src` (fallback về `src`)

### ⚠️ Hai CDN domain — KHÔNG filter theo domain (CRITICAL)
Hita dùng 2 domain ảnh, đôi khi cả 2 xuất hiện trong cùng 1 sản phẩm:
- `cdn.hita.com.vn/storage/products/inax/...` (CDN subdomain, plural "products")
- `hita.com.vn/storage/product/TIMESTAMP.jpg` (legacy, singular "product")
- Ảnh avatar đôi khi là path tương đối `/storage/products/...` → cần resolve thành URL đầy đủ

**→ KHÔNG filter theo domain pattern. Chỉ loại trừ `ytimg`.**

### ⚠️ Phân biệt Video slide vs Product image slide

```js
const slides = [...document.querySelectorAll('.item.slick-slide')];
slides.forEach(slide => {
  const img = slide.querySelector('img');
  const rawSrc = img?.getAttribute('data-src') || img?.src || '';
  // Resolve relative path
  const imgSrc = rawSrc.startsWith('/') ? `https://hita.com.vn${rawSrc}` : rawSrc;

  if (imgSrc.includes('i.ytimg.com') || slide.querySelector('.play-btn, [class*="play"]')) {
    // VIDEO SLIDE → SKIP
  } else if (imgSrc && !imgSrc.includes('placeholder')) {
    // PRODUCT IMAGE → CRAWL
    productImages.push(imgSrc);
  }
});
```

### ⚠️ "Ảnh từ khách hàng" → SKIP hoàn toàn
- Là tab riêng `.item-tab` với text "Ảnh từ khách hàng"
- Không nằm trong main slider → không cần filter thêm nếu chỉ lấy `.item.slick-slide`
- Container: `#modal-customer-img` → không crawl

### ⚠️ Banner quảng cáo hita → SKIP
- Ảnh banner nằm trong `.banner-top` → không nằm trong `.slick-track` của gallery

### Tóm tắt: selector an toàn để lấy product images
```js
const productImages = [...document.querySelectorAll('.item.slick-slide img')]
  .map(img => {
    const raw = img.getAttribute('data-src') || img.src || '';
    // Resolve relative paths
    return raw.startsWith('/') ? `https://hita.com.vn${raw}` : raw;
  })
  .filter(src => src && !src.includes('ytimg') && src.includes('/storage/'));
```

---

## 3. Variants — CRITICAL INSIGHT

**⚠️ Trên hita, mỗi variant là 1 PDP riêng biệt với URL riêng** (không phải dropdown trong cùng 1 trang).

```js
const variants = [...document.querySelectorAll('.variant-item')].map(el => ({
  label: el.innerText.split('\n')[0].trim(),   // "Nắp điện tử H17"
  price: el.innerText.split('\n').pop().trim(), // "13.530.900đ"
  url: el.href,                                // URL sản phẩm khác
  isActive: el.classList.contains('active')    // sản phẩm hiện tại
}));
```

**Ví dụ thực tế từ AC-1008VRN:**
| Label | URL | Ghi chú |
|-------|-----|---------|
| Nắp đóng êm | `/bon-cau-1-khoi-inax-ac-1008vrn-543.html` | ← trang hiện tại (active) |
| Nắp điện tử H17 | `/bon-cau-1-khoi-nap-dien-tu-inax-ac-1008r-cw-h17vn-7891.html` | URL riêng |
| Nắp điện tử H18 | `/combo-inax-116-ac-1008r-cw-h18vn-3242.html` | URL riêng (combo) |
| Nắp điện tử H20 | `/bon-cau-1-khoi-nap-dien-tu-inax-ac-1008r-cw-h20vn-11420.html` | URL riêng |
| ... | ... | |

### ⚠️ Active variant URL có thể có `#` ở cuối
```js
// Active variant URL: "https://hita.com.vn/chau-rua-duong-vanh-inax-l-2397v-1515.html#"
// → Strip "#" khi xử lý
const cleanUrl = el.href?.replace(/#$/, '');
```

### Chiến lược grouping variants:
1. Khi crawl PDP, lấy tất cả `.variant-item[href]` URLs (strip `#` ở cuối)
2. Thêm vào `visited_urls` set → không crawl lại
3. Đánh dấu chúng cùng `variant_group_id`
4. Master product = variant đầu tiên không có tên nắp cụ thể (hoặc variant "đóng êm" / rẻ nhất)
5. **Không cần SKU prefix pattern** vì hita đã link sẵn các variants

---

## 4. Pricing

**Container:** `#main-price-product`

```js
// Cần parse text, không có data attributes riêng
const priceBlock = document.querySelector('#main-price-product').innerText;

// Parse bằng regex:
const currentPrice = priceBlock.match(/([\d.]+đ)/)?.[1];        // "9.940.800đ"
const originalMatch = priceBlock.match(/Giá gốc:\s*([\d.]+đ)/); // "17.440.000đ"
const discountMatch = priceBlock.match(/Giảm thêm:\s*([\d.]+đ)/);// "523.000đ"

// Parse sang số:
function parseVND(str) {
  return parseInt(str?.replace(/[^\d]/g, '') || '0');
}
```

**3 loại giá:**
| Field | DPG field | Ví dụ |
|-------|-----------|-------|
| Giá hiện tại (deal) | `price` | 9.940.800 |
| Giá gốc | `original_price` | 17.440.000 |
| Giảm thêm khi online | `online_discount_amount` | 523.000 |

---

## 5. Specs

**Selector:** `#box-specification table tr`

```js
const specs = {};
[...document.querySelectorAll('#box-specification table tr')].forEach(row => {
  const key = row.cells[0]?.innerText?.trim();
  const val = row.cells[1]?.innerText?.trim();
  if (key && val) specs[key] = val;
});
// Lưu vào products.specs (JSONB)
```

**Ví dụ output:**
```json
{
  "Thương hiệu": "INAX",
  "Nơi sản xuất": "Việt Nam",
  "Bảo hành": "24 tháng",
  "Loại nắp": "Nắp đóng êm",
  "Lượng nước xả": "6/4.5L",
  "Kích thước (DxRxC)": "805x400x588 mm",
  "Thân cầu": "AC-1008",
  "Mẫu nắp": "CF-1008VS"
}
```

---

## 6. Description

**Selector:** `#description-content`

### ⚠️ "Xem thêm" button
- Class: `.description-show-more`
- Nội dung đầy đủ ĐÃ có trong DOM (CSS truncate), không cần click
- Dùng `innerHTML` hoặc `innerText` trực tiếp → lấy full content

### ⚠️ Hyperlinks trong description
- Chứa links nội bộ hita: `href="https://hita.com.vn/bon-cau-1-khoi-260.html"`
- **Xử lý:** Strip tất cả `<a>` tags, giữ text content
```js
const descEl = document.querySelector('#description-content').cloneNode(true);
descEl.querySelectorAll('a').forEach(a => {
  a.replaceWith(document.createTextNode(a.innerText));
});
const cleanDesc = descEl.innerHTML; // hoặc .innerText nếu chỉ cần plain text
```

---

## 7. Nguyên hộp (In the box)

**Selector:** `#box-package-include`

```js
const inBox = document.querySelector('#box-package-include')?.innerText?.trim();
// Output: "Thân bồn cầu AC-1008R\nNắp đóng êm CF-1008VS\nNắp két nước, phao, van xả nước\n..."
```

⚠️ **Chỉ có trên bồn cầu / bộ sản phẩm combo** — KHÔNG có trên lavabo, sen tắm, phụ kiện rời.
Xử lý `null` nếu element không tồn tại.

Lưu vào `products.specs['Nguyên hộp']` hoặc field riêng.

---

## 8. PDF Hướng dẫn lắp đặt

**Selector:** `#package-attachments a[href*=".pdf"]`

```js
const pdfs = [...document.querySelectorAll('#package-attachments a')]
  .filter(a => a.href?.includes('.pdf'))
  .map(a => ({ name: a.innerText?.trim(), url: a.href }));
```

⚠️ Sản phẩm mẫu không có PDF → không phải sản phẩm nào cũng có. Xử lý empty array.

---

## 9. Video

**Selector:** `#video-product-btn[data-embed]`

```js
const videoBtn = document.querySelector('#video-product-btn');
const youtubeId = videoBtn?.getAttribute('data-embed'); // "-sPsNtHRQyU"
// YouTube URL: `https://www.youtube.com/watch?v=${youtubeId}`
// Thumbnail: `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`
```

⚠️ Thumbnail YouTube (`i.ytimg.com`) xuất hiện trong gallery slider slide đầu tiên → **SKIP khi crawl images**.

---

## 10. SKU & Tên sản phẩm

```js
const name = document.querySelector('h1')?.innerText?.trim();
const sku = document.querySelector('.product-code')?.innerText?.trim(); // "AC-1008VRN/BW1"
const slug = window.location.pathname.replace(/^\/|\.html$/g, ''); // "bon-cau-1-khoi-inax-ac-1008vrn-543"
```

---

## 11. Discovery — Tìm tất cả PDP URLs

**Brand page INAX:** `https://hita.com.vn/thiet-bi-ve-sinh-inax-97.html` ✅ (verified)

**Scope INAX trên hita:** 100% thiết bị vệ sinh — **KHÔNG có gạch ốp lát INAX.**

**Thống kê sitemap:**
- Tổng sản phẩm: ~19,377 URLs (20 pages × ~1000)
- INAX URLs: ~2,208
- Sitemap URL pattern: `https://hita.com.vn/product-sitemap.xml?page=N` (N = 1..20)
- ⚠️ Sitemap chứa URL đã chết (404) — crawler PHẢI check HTTP status, skip 404

**Crawl flow:**
```
Brand page → Danh sách category links
  → Category cấp 1 (/bon-cau-253.html)
    → Category cấp 2 (/bon-cau-1-khoi-260.html)
      → Pagination (.pagination a)
        → Product links (.product-item a, [class*="product"] a[href*=".html"])
          → PDP URL
```

**Dedup variants:** Khi crawl PDP, thêm tất cả `.variant-item href` vào `visited_urls` set trước khi crawl tiếp.

---

## 12. Tóm tắt selectors

| Data | Selector | Ghi chú |
|------|----------|---------|
| Tên sản phẩm | `h1` | |
| SKU | `.product-code` | |
| Giá hiện tại | `#main-price-product` + regex | Parse text |
| Giá gốc | `#main-price-product` + regex `/Giá gốc: ([\d.]+đ)/` | |
| Giảm online | `#main-price-product` + regex `/Giảm thêm: ([\d.]+đ)/` | |
| Breadcrumb | `.breadcrumbs li a` | [1]=cat, [2]=subcat |
| Gallery images | `.item.slick-slide img` → `data-src \|\| src` filter `/storage/` & not `ytimg` | Resolve relative paths |
| Variants | `.variant-item` → `.href` + text | Mỗi variant = URL riêng, strip `#` ở cuối |
| Specs | `#box-specification table tr` | key/value pairs |
| Description | `#description-content` | Strip `<a>` tags |
| Nguyên hộp | `#box-package-include` | Optional — chỉ có trên bồn cầu/combo |
| PDF | `#package-attachments a[href*=".pdf"]` | Optional |
| YouTube ID | `#video-product-btn[data-embed]` | Optional |

---

## ⚠️ Những gì cần SKIP

| Loại | Cách nhận biết | Lý do |
|------|---------------|-------|
| Video thumbnail | `img.src` chứa `i.ytimg.com` hoặc slide có `.play-btn` | Không phải ảnh sản phẩm |
| Ảnh từ khách | Tab "Ảnh từ khách hàng" / `#modal-customer-img` | User generated, không thuộc DPG |
| Banner quảng cáo | Container `.banner-top` | Quảng cáo của hita |
| Brand logos | `.brand-menu-desktop img` | Navigation element |
| Lazy placeholder | `img.src` là GIF/placeholder, không có `data-src` | Ảnh chưa load |
