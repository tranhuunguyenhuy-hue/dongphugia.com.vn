# Crawl Spec: INAX từ hita.com.vn → DPG

**Ngày:** 29/05/2026  
**Tác giả:** Tech Lead (Claude)  
**Đọc cùng với:** `docs/crawl/hita-inax-recon.md`

---

## Tổng quan

Crawl ~2,208 sản phẩm INAX từ `hita.com.vn`, import vào Supabase DPG.  
Chiến lược: **upsert theo `sku`** — SKU đã tồn tại thì UPDATE, chưa có thì INSERT.  
Không xóa dữ liệu cũ trước khi chạy.

### Stack yêu cầu
- **Playwright** (bắt buộc — gallery dùng Slick.js lazy load, `requests` thuần không đọc được ảnh)
- **Node.js** hoặc **Python** tùy Antigravity chọn
- Biến môi trường từ `.env`: `DATABASE_URL`, `BUNNY_STORAGE_*`, `BUNNY_CDN_HOSTNAME`

---

## Phase 1 — Discover URLs

### Nguồn URL
Sitemap phân trang: `https://hita.com.vn/product-sitemap.xml?page=N` (N = 1..20)

```js
// Lọc INAX URLs từ sitemap text
const text = await page.locator('pre, body').innerText();
const allUrls = text.match(/https:\/\/hita\.com\.vn\/[^\s<>]+\.html/g) || [];
const inaxUrls = allUrls.filter(url =>
  url.includes('inax') || url.includes('-inax-')
);
```

### ⚠️ Xử lý 404
Sitemap chứa URL đã chết. PHẢI check HTTP status trước khi crawl PDP:
```js
const response = await page.goto(url);
if (response.status() === 404) {
  log.warn(`404 — skip: ${url}`);
  continue;
}
```

### Output Phase 1
File `output/inax-urls.json`: mảng URL strings, ~2,208 entries.

---

## Phase 2 — Crawl PDP

### 2.1 Tên sản phẩm & SKU

```js
const name = await page.locator('h1').innerText();
const skuRaw = await page.locator('.product-code').innerText().catch(() => '');
const sku = skuRaw.trim(); // "AC-1008VRN/BW1"
const slug = new URL(page.url()).pathname.replace(/^\/|\.html$/g, '');
```

---

### 2.2 Breadcrumb → Category mapping

```js
const breadcrumbs = await page.locator('.breadcrumbs li a').all();
const crumbs = await Promise.all(breadcrumbs.map(async el => ({
  text: await el.innerText(),
  href: await el.getAttribute('href')
})));
// crumbs[0] = Trang Chủ (bỏ qua)
// crumbs[1] = category cấp 1: "Bồn Cầu", "Lavabo", "Sen Tắm"...
// crumbs[2] = subcategory cấp 2: "Bồn Cầu 1 Khối", "Lavabo Dương Vành"...
```

**Mapping table** — dùng `hita_url_path` để lookup:

| hita URL path | hita label | DPG category_id | DPG subcategory_id |
|---------------|-----------|------------------|--------------------|
| `/bon-cau-253.html` | Bồn Cầu | `thiet-bi-ve-sinh` | `bon-cau` |
| `/bon-cau-1-khoi-260.html` | Bồn Cầu 1 Khối | `thiet-bi-ve-sinh` | `bon-cau-1-khoi` |
| `/bon-cau-2-khoi-261.html` | Bồn Cầu 2 Khối | `thiet-bi-ve-sinh` | `bon-cau-2-khoi` |
| `/chau-rua-mat-lavabo-254.html` | Lavabo | `thiet-bi-ve-sinh` | `lavabo` |
| `/sen-tam-289.html` | Sen Tắm | `thiet-bi-ve-sinh` | `sen-tam` |
| *(bổ sung khi gặp category mới)* | | | |

> Nếu URL breadcrumb không có trong bảng → log warning, set `subcategory_id = null`, tiếp tục crawl.

---

### 2.3 Giá — parse text, không có data attributes

```js
const priceBlock = await page.locator('#main-price-product').innerText();

function parseVND(str) {
  if (!str) return null;
  const digits = str.replace(/[^\d]/g, '');
  return digits ? parseInt(digits) : null;
}

const currentPriceMatch = priceBlock.match(/^([\d.]+đ)/m);
const originalMatch = priceBlock.match(/Giá gốc:\s*([\d.]+đ)/);
const discountMatch = priceBlock.match(/Giảm thêm:\s*([\d.]+đ)/);

const price = parseVND(currentPriceMatch?.[1]);           // 9940800
const original_price = parseVND(originalMatch?.[1]);      // 17440000
const online_discount = parseVND(discountMatch?.[1]);     // 523000 (optional)
```

---

### 2.4 Gallery Images — NHIỀU BẪY

#### Rule cốt lõi
```js
const productImages = [];

const slides = await page.locator('.item.slick-slide').all();
for (const slide of slides) {
  const img = slide.locator('img').first();
  
  // Lấy data-src trước, fallback về src
  const dataSrc = await img.getAttribute('data-src').catch(() => null);
  const src = await img.getAttribute('src').catch(() => null);
  const rawUrl = dataSrc || src || '';

  // Resolve relative path (một số ảnh chỉ có path "/storage/...")
  const imgUrl = rawUrl.startsWith('/')
    ? `https://hita.com.vn${rawUrl}`
    : rawUrl;

  // SKIP: YouTube thumbnail
  if (imgUrl.includes('i.ytimg.com')) continue;

  // SKIP: placeholder chưa load
  if (!imgUrl || imgUrl.includes('images/original.jpg') || imgUrl.includes('placeholder')) continue;

  // SKIP: không phải ảnh sản phẩm
  if (!imgUrl.includes('/storage/')) continue;

  productImages.push(imgUrl);
}
```

#### ⚠️ Bẫy 1: Slide đầu KHÔNG có `data-src`
Slide đầu tiên (ảnh avatar đã preload) chỉ có `src`, không có `data-src`.  
→ **Luôn dùng `data-src || src`**, không bao giờ chỉ dùng `data-src`.

#### ⚠️ Bẫy 2: Hai CDN domain, cùng path pattern
Cùng 1 sản phẩm có thể có ảnh từ cả 2 domain:
- `https://cdn.hita.com.vn/storage/products/inax/...` (CDN, phổ biến hơn)
- `https://hita.com.vn/storage/product/TIMESTAMP.jpg` (legacy)

→ **KHÔNG filter theo domain**, chỉ filter theo `/storage/` trong path.

#### ⚠️ Bẫy 3: Video slide — detect bằng cả 2 dấu hiệu
```js
const hasPlayButton = await slide.locator('.play-button, .product-yt, [class*="play"]').count() > 0;
const isYoutube = imgUrl.includes('i.ytimg.com');
if (hasPlayButton || isYoutube) continue; // SKIP video slide
```

---

### 2.5 Variants

```js
const variantEls = await page.locator('.variant-item').all();
const variants = await Promise.all(variantEls.map(async el => {
  const lines = (await el.innerText()).split('\n').map(s => s.trim()).filter(Boolean);
  const rawUrl = await el.getAttribute('href') || '';
  const url = rawUrl.replace(/#$/, ''); // ⚠️ Strip trailing "#" (active variant)
  return {
    label: lines[0],
    price: lines[lines.length - 1],
    url: url.startsWith('http') ? url : `https://hita.com.vn${url}`,
    isActive: await el.evaluate(el => el.classList.contains('active'))
  };
}));
```

#### ⚠️ Bẫy: Active variant URL có `#` ở cuối
`https://hita.com.vn/chau-rua-duong-vanh-inax-l-2397v-1515.html#` → strip `#`.

#### Chiến lược dedup variants
```js
// Khi crawl PDP, thêm tất cả variant URLs vào visited set NGAY LẬP TỨC
// để không crawl lại chúng như sản phẩm độc lập
for (const variant of variants) {
  if (variant.url) visitedUrls.add(variant.url);
}
// Đánh dấu cùng variant_group_id = slug của trang đầu tiên gặp nhóm này
```

---

### 2.6 Specs

```js
const specs = {};
const rows = await page.locator('#box-specification table tr').all();
for (const row of rows) {
  const cells = await row.locator('td').all();
  if (cells.length >= 2) {
    const key = (await cells[0].innerText()).trim();
    const val = (await cells[1].innerText()).trim();
    if (key && val) specs[key] = val;
  }
}
// Lưu vào products.specs (JSONB)
```

---

### 2.7 Mô tả sản phẩm — 3 bẫy quan trọng

#### ⚠️ Bẫy 1: DÙNG `innerText`, KHÔNG dùng `innerHTML`
Description chứa `<img>` lazy load — `src` luôn là placeholder `hita.com.vn/images/original.jpg`.  
Nếu lưu HTML nguyên → DPG hiển thị ảnh vỡ trỏ về hita.  
→ **Lưu plain text**, không lưu HTML.

#### ⚠️ Bẫy 2: CSS truncation — content ĐÃ có trong DOM, không cần click "Xem thêm"
```css
/* hita CSS — truncate visual, không ẩn DOM */
.description-collapse { max-height: 650px; overflow: hidden; }
```
`innerText` đọc được full content dù bị overflow:hidden (CSS không ẩn text khỏi DOM).

#### ⚠️ Bẫy 3: Lấy từ inner div để tránh text "Xem thêm"
```js
// SAI — bao gồm text "Xem thêm" của button
const desc = await page.locator('#description-content').innerText();

// ĐÚNG — chỉ lấy nội dung thực
const desc = await page.locator('#description-content .description-collapse').innerText()
  .catch(() => page.locator('#description-content').innerText()); // fallback nếu class thay đổi

const cleanDesc = desc.trim();
```

---

### 2.8 Nguyên hộp (In the box)

**Chỉ có trên bồn cầu và combo** — lavabo, sen tắm, phụ kiện không có section này.

```js
// Lấy từ .panel-body để tránh title "Nguyên hộp bao gồm"
const inBox = await page.locator('#box-package-include .panel-body').innerText()
  .catch(() => null); // null nếu không có section này

// Lưu vào specs['Nguyên hộp'] hoặc field riêng
if (inBox) specs['Nguyên hộp'] = inBox.trim();
```

---

### 2.9 PDF Hướng dẫn lắp đặt

#### ⚠️ Cấu trúc DOM quan trọng
```
#package-attachments        ← outer container (luôn tồn tại)
  └── #box-attachments      ← chỉ tồn tại khi có PDF
        └── <a href="...pdf">
```

Trên sản phẩm KHÔNG có PDF: `#package-attachments` tồn tại nhưng không có `#box-attachments` bên trong — chứa nội dung nguyên hộp (bẫy dễ nhầm).

```js
// ĐÚNG — tìm trong #box-attachments (specific)
const pdfLinks = await page.locator('#box-attachments a').all();
const pdfs = await Promise.all(
  pdfLinks
    .filter(async a => (await a.getAttribute('href') || '').toLowerCase().includes('.pdf'))
    .map(async a => ({
      name: (await a.innerText()).trim(),
      url: await a.getAttribute('href')
    }))
);

// SAI — #package-attachments a sẽ lấy cả link nguyên hộp trên sản phẩm không có PDF
```

---

### 2.10 Video YouTube

```js
const videoBtn = page.locator('#video-product-btn[data-embed]');
const youtubeId = await videoBtn.getAttribute('data-embed').catch(() => null);
// YouTube URL: `https://www.youtube.com/watch?v=${youtubeId}`
```

---

### 2.11 Output cấu trúc 1 sản phẩm (JSON)

```json
{
  "url": "https://hita.com.vn/bon-cau-1-khoi-inax-ac-1008vrn-543.html",
  "slug": "bon-cau-1-khoi-inax-ac-1008vrn-543",
  "name": "Bồn cầu 1 khối INAX AC-1008VRN (AC1008VRN) nắp đóng êm",
  "sku": "AC-1008VRN/BW1",
  "price": 9940800,
  "original_price": 17440000,
  "online_discount_amount": 523000,
  "category_id": "thiet-bi-ve-sinh",
  "subcategory_id": "bon-cau-1-khoi",
  "hita_category_url": "/bon-cau-1-khoi-260.html",
  "specs": {
    "Thương hiệu": "INAX",
    "Nơi sản xuất": "Việt Nam",
    "Bảo hành": "24 tháng",
    "Nguyên hộp": "Thân bồn cầu AC-1008R\nNắp đóng êm CF-1008VS\n..."
  },
  "description": "Thiết kế bồn cầu 1 khối INAX AC-1008VRN nổi bật...",
  "images": [
    "https://hita.com.vn/storage/product/ac-1008vrn-cmyk-5fe2ace0861ee.jpg",
    "https://hita.com.vn/storage/product/resize_1608690909ac-1008vrn.jpg"
  ],
  "variants": [
    { "label": "Nắp đóng êm", "url": "https://hita.com.vn/bon-cau-1-khoi-inax-ac-1008vrn-543.html", "isActive": true },
    { "label": "Nắp điện tử H17", "url": "https://hita.com.vn/bon-cau-1-khoi-nap-dien-tu-inax-ac-1008r-cw-h17vn-7891.html", "isActive": false }
  ],
  "variant_group_id": "bon-cau-1-khoi-inax-ac-1008vrn-543",
  "pdfs": [
    { "name": "Hướng dẫn lắp đặt & sử dụng", "url": "https://cdn.hita.com.vn/storage/products/inax/..." }
  ],
  "youtube_id": "-sPsNtHRQyU"
}
```

---

## Phase 3 — Upload ảnh lên Bunny CDN

```js
// Với mỗi image URL trong products[].images:
async function uploadToBunnyCDN(sourceUrl, sku, index) {
  // 1. Download từ hita
  const imgBuffer = await fetch(sourceUrl).then(r => r.arrayBuffer());

  // 2. Tạo tên file
  const ext = sourceUrl.split('.').pop().split('?')[0]; // jpg, png, gif...
  const fileName = `inax/${sku.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${index}.${ext}`;

  // 3. Upload lên Bunny CDN
  const uploadUrl = `https://${process.env.BUNNY_STORAGE_HOSTNAME}/${process.env.BUNNY_STORAGE_ZONE_NAME}/${fileName}`;
  await fetch(uploadUrl, {
    method: 'PUT',
    headers: { AccessKey: process.env.BUNNY_STORAGE_API_KEY },
    body: imgBuffer
  });

  // 4. Trả về CDN URL
  return `https://${process.env.BUNNY_CDN_HOSTNAME}/${fileName}`;
}
```

**Giới hạn concurrency:** Max 5 uploads song song để tránh rate limit.  
**Dedup:** Check xem CDN URL đã tồn tại chưa trước khi upload lại.

---

## Phase 4 — Import vào Supabase

```js
// Upsert sản phẩm — ON CONFLICT (sku) DO UPDATE
const { data: product } = await supabase
  .from('products')
  .upsert({
    sku: item.sku,
    slug: item.slug,
    name: item.name,
    price: item.price,
    original_price: item.original_price,
    online_discount_amount: item.online_discount_amount,
    brand_id: INAX_BRAND_ID, // lookup trước từ brands table
    category_id: item.category_id,
    subcategory_id: item.subcategory_id,
    description: item.description,
    specs: item.specs,
    is_master: item.variants.find(v => v.isActive)?.label?.includes('đóng êm') || item.variants.length === 0,
    variant_group: item.variant_group_id,
    youtube_url: item.youtube_id ? `https://www.youtube.com/watch?v=${item.youtube_id}` : null,
    is_active: false, // ⚠️ Default OFF — PM review trước khi publish
  }, { onConflict: 'sku' })
  .select('id')
  .single();

// Insert ảnh vào product_images
if (product) {
  await supabase.from('product_images').delete().eq('product_id', product.id); // clear old images
  await supabase.from('product_images').insert(
    cdnUrls.map((url, i) => ({
      product_id: product.id,
      url,
      type: i === 0 ? 'main' : 'gallery',
      sort_order: i
    }))
  );
}
```

> **`is_active: false` mặc định** — mọi sản phẩm import xong đều ẩn cho đến khi PM review và bật lên.

---

## Yêu cầu crawl mẫu (Sample Crawl — bắt buộc trước full run)

### Danh sách 10 URL mẫu — đại diện đủ loại
```
1. https://hita.com.vn/bon-cau-1-khoi-inax-ac-1008vrn-543.html          # bồn cầu, có variant, có video
2. https://hita.com.vn/bon-cau-1-khoi-nap-dien-tu-inax-ac-1008r-cw-h17vn-7891.html  # variant của #1
3. https://hita.com.vn/sen-tam-inax-bfv-113s-1886.html                   # sen tắm, có PDF, không variant
4. https://hita.com.vn/chau-rua-duong-vanh-inax-l-2397v-1515.html        # lavabo, có variant AquaCeramic
5. https://hita.com.vn/van-xa-bon-tieu-inax-uf-3vs-636.html              # phụ kiện nhỏ
6. https://hita.com.vn/tay-gat-inax-a-311v-1595.html                     # URL 404 (test error handling)
7. (1 sản phẩm combo nếu tìm được)
8. (1 sản phẩm không có video)
9. (1 sản phẩm có nhiều ảnh >5)
10. (1 sản phẩm có description dài >2000 chars)
```

### Output sample crawl cần kiểm tra
- [ ] File `output/sample-10.json` — 10 products đầy đủ fields
- [ ] File `output/sample-10-images.json` — CDN URLs sau khi upload
- [ ] Không có URL placeholder `images/original.jpg` trong bất kỳ image field nào
- [ ] Sản phẩm #2 có cùng `variant_group_id` với sản phẩm #1
- [ ] URL 404 (#6) được skip, không crash script
- [ ] `is_active: false` trên mọi record import vào DB
- [ ] `description` là plain text, không chứa HTML tags

---

## Error handling & logging

```js
// Mỗi URL cần log đầy đủ
const log = {
  url,
  status: 'ok' | '404' | 'error',
  sku: item?.sku || null,
  imagesCount: images.length,
  hasVariants: variants.length > 0,
  hasPdf: pdfs.length > 0,
  error: err?.message || null,
  durationMs: Date.now() - start
};
```

Lưu toàn bộ log ra `output/crawl-log.json` để Tech Lead review sau.

---

## Rate limiting

- Delay giữa requests: **1-2 giây** (tránh bị ban)
- Max concurrent pages Playwright: **3**
- Nếu gặp HTTP 429 hoặc Cloudflare block: dừng, báo Tech Lead

---

## Files cần tạo

```
scripts/
├── crawl-hita-inax/
│   ├── 1-discover-urls.js     # Phase 1: sitemap → URL list
│   ├── 2-crawl-pdp.js         # Phase 2: PDP extraction
│   ├── 3-upload-images.js     # Phase 3: Bunny CDN upload
│   ├── 4-import-db.js         # Phase 4: Supabase upsert
│   ├── category-map.js        # Bảng mapping hita → DPG category
│   └── utils.js               # parseVND, resolveUrl, sleep...
output/
├── inax-urls.json             # Phase 1 output
├── crawled-products.json      # Phase 2 output
├── sample-10.json             # Sample crawl output
└── crawl-log.json             # Log mỗi URL
```
