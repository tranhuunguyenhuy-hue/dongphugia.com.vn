# LEO-447 — Final Implementation Plan
## Crawl INAX từ hita.com.vn → DPG (v2, Playwright)

> **Sau 2 vòng Multi-Agent Brainstorming**
> **Trạng thái: APPROVED — Sẵn sàng code**

---

## Decision Log Tổng hợp (D-01 → D-22)

### Round 1 Decisions

| ID | Quyết định | Lý do |
|----|-----------|-------|
| D-01 | Description: `innerText` (plain text) | Tránh hotlink/lazy-load complexity. Clean start. |
| D-02 | Slider dedup: `[data-slick-index]` + cap 20 ảnh | Root cause Phiên 5 FAIL — Slick clones không có attribute này |
| D-03 | SKU: không fallback từ slug, skip nếu null | Nguồn gốc 1,473 SKU bẩn lần trước |
| D-04 | Variant group: slug của `isActive=true` variant (deterministic) | Concurrent 3 pages — cần deterministic, không dùng "first encountered" |
| D-05 | PDF selector: cả `#box-attachments` và `#package-attachments` (fallback) | Mâu thuẫn spec vs findings — dùng cả 2, log source |
| D-06 | Gallery filter: `/storage/` trong path | Recon confirmed, spec đúng |
| D-07 | Phase 0: 20 samples, file `sample-20.json` | 10 = 0.45% quá ít |
| D-08 | `crawl-log.json`: 8 fields bắt buộc | AC bắt buộc từ issue |
| D-09 | Concurrency: `p-limit(3)` cho Playwright | Spec constraint |
| D-10 | `is_active: false` — constant, không phải option | Codebase cũ set true — GUARD-1 |
| D-11 | Validation gate: skip nếu thiếu sku/name/images | AC requirement |
| D-12 | CDN upload xong trước, mới import DB | Tránh broken images |

### Round 2 Decisions (Bổ sung từ subtask review)

| ID | Quyết định | Subtask | Lý do |
|----|-----------|---------|-------|
| D-13 | `product_images`: Supabase transaction (delete + insert atomic) | LEO-452 | CRITICAL: tránh sản phẩm 0 ảnh nếu crash giữa chừng |
| D-14 | `image-map.json`: write-temp-then-rename (atomic swap) | LEO-451 | Tránh corrupt khi crash giữa writeFileSync |
| D-15 | `is_active` CASE WHEN: dùng `IS TRUE` không phải `= true` | LEO-452 | NULL không bằng true — vô tình deactivate sản phẩm |
| D-16 | CDN upload: retry 3 lần exponential backoff (1s, 2s, 4s) | LEO-451 | 429 hiện tại bị skip vĩnh viễn không retry |
| D-17 | Tên file Phase 0: `sample-20.json` (cập nhật spec dòng 428, 480) | LEO-448 | D-07 đã quyết định — spec cũ chưa cập nhật |
| D-18 | Biến lặp sitemap: `pageNum` (không phải `page`) | LEO-449 | Shadow Playwright `page` object — TypeError risk |
| D-19 | Resume mode: `--resume` flag cho script 2 và 3 | LEO-451 | 8 giờ crawl — crash không được mất progress |
| D-20 | Gate file: `output/phase0-approved.flag` | LEO-449/450 | Ngăn chạy Phase 2 trước khi Tech Lead LGTM |
| D-21 | URL filter: kết hợp sitemap `inax` + brand page crawl | LEO-449 | Filter `includes('inax')` bỏ sót slug không có "inax" |
| D-22 | Phase 0 checklist: verify SKU không conflict DB hiện tại | LEO-448 | 4 URL tự tìm có thể overwrite catalog đang active |

---

## File Structure

```
scripts/crawl-hita-inax/
├── utils.js                    # parseVND, sleep, withRetry, atomicWrite
├── category-map.js             # hita URL path → DPG category/subcategory
├── 1-discover-urls.js          # Phase 1: sitemap → inax-urls.json
├── 2-crawl-pdp.js              # Phase 2: PDP extraction, --sample-only, --resume
├── 3-upload-images.js          # Phase 3: Bunny CDN, --resume, atomic image-map
└── 4-import-db.js              # Phase 4: Supabase upsert + transaction

output/
├── inax-urls.json
├── sample-20.json              # Phase 0 (20 products)
├── crawled-products.json       # Phase 2 output
├── crawled-products-with-cdn.json
├── image-map.json              # CDN dedup (atomic write)
├── crawl-log.json
└── phase0-approved.flag        # Tech Lead tạo thủ công để unblock Phase 2
```

---

## Implementation Patterns

### utils.js

```js
import fs from 'fs';

// D-14: atomic write — tránh corrupt khi crash giữa writeFileSync
export function atomicWrite(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath); // atomic OS-level swap
}

// D-16: retry với exponential backoff
export async function withRetry(fn, maxRetries = 3, baseDelayMs = 1000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt);
      console.warn(`Retry ${attempt + 1}/${maxRetries} sau ${delay}ms: ${err.message}`);
      await sleep(delay);
    }
  }
}

export function parseVND(str) {
  if (!str) return null;
  const digits = str.replace(/[^\d]/g, '');
  return digits ? parseInt(digits) : null;
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
```

### 1-discover-urls.js

```js
// D-18: pageNum thay vì page để tránh shadow Playwright page object
for (let pageNum = 1; pageNum <= 20; pageNum++) {
  await page.goto(`https://hita.com.vn/product-sitemap.xml?page=${pageNum}`);
  const text = await page.locator('pre, body').innerText();
  const urls = text.match(/https:\/\/hita\.com\.vn\/[^\s<>]+\.html/g) || [];
  const inaxUrls = urls.filter(u => u.toLowerCase().includes('inax'));
  allUrls.push(...inaxUrls);
  await sleep(1000 + Math.random() * 500);
}

// D-21: crawl thêm brand page để bắt URL bị bỏ sót bởi filter 'inax'
// https://hita.com.vn/thiet-bi-ve-sinh-inax-97.html
// extract product links → merge + dedup với sitemap URLs
const deduped = [...new Set(allUrls)];
```

### 2-crawl-pdp.js — critical patterns

```js
// D-20: gate check
if (!fs.existsSync('output/phase0-approved.flag') && !args.includes('--sample-only')) {
  console.error('STOP: Phase 0 chưa được Tech Lead approve. Tạo output/phase0-approved.flag trước.');
  process.exit(1);
}

// D-02: data-slick-index chỉ có trên native slides, không có trên Slick clones
const slides = await page.locator('.item.slick-slide[data-slick-index]').all();
const seenUrls = new Set();
for (const slide of slides) {
  const img = slide.locator('img').first();
  const dataSrc = await img.getAttribute('data-src').catch(() => null);
  const src = await img.getAttribute('src').catch(() => null);
  const raw = dataSrc || src || '';
  const imgUrl = raw.startsWith('/') ? `https://hita.com.vn${raw}` : raw;
  if (!imgUrl || imgUrl.includes('ytimg') || imgUrl.includes('placeholder')) continue;
  if (!imgUrl.includes('/storage/')) continue; // D-06
  if (seenUrls.has(imgUrl)) continue;
  seenUrls.add(imgUrl);
  if (productImages.length >= 20) break; // D-02: hard cap
  productImages.push(imgUrl);
}

// D-03: không fallback SKU từ slug
const skuRaw = await page.locator('.product-code').innerText().catch(() => '');
const sku = skuRaw.replace(/^M[aã]\s*SP:\s*/i, '').trim();
if (!sku || !name || productImages.length === 0) {
  appendLog({ url, status: 'skip', reason: 'missing required fields' });
  continue; // D-11
}

// D-04: variant_group deterministic = slug của isActive variant
const activeVariant = variants.find(v => v.isActive);
const variantGroup = activeVariant
  ? new URL(activeVariant.url).pathname.replace(/^\/|\.html$/g, '')
  : slug;
```

### 4-import-db.js — is_active guard

```js
// D-15: IS TRUE cover cả NULL case
// Raw SQL vì Supabase client không hỗ trợ CASE WHEN trong upsert
const { error } = await supabase.rpc('upsert_inax_product', {
  p_sku: item.sku,
  p_name: item.name,
  p_price: item.price,
  // ... other fields
});

// SQL function phía Supabase (cần tạo migration):
// CREATE OR REPLACE FUNCTION upsert_inax_product(p_sku text, ...)
// ON CONFLICT (sku) DO UPDATE SET
//   is_active = CASE WHEN products.is_active IS TRUE THEN TRUE ELSE FALSE END,
//   ...

// D-13: atomic replace images qua RPC
await supabase.rpc('replace_product_images', {
  p_product_id: product.id,
  p_images: cdnUrls.map((url, i) => ({
    url, type: i === 0 ? 'main' : 'gallery', sort_order: i
  }))
});
// SQL function đảm bảo DELETE + INSERT trong 1 transaction
```

---

## Phase 0 Checklist (20 samples — cho Tech Lead review)

**URLs mẫu:**

| # | URL | Mục đích |
|---|-----|---------|
| 1 | bon-cau-1-khoi-inax-ac-1008vrn-543.html | Bồn cầu, variant, video |
| 2 | bon-cau-1-khoi-nap-dien-tu-inax-ac-1008r-cw-h17vn-7891.html | Variant của #1 |
| 3 | sen-tam-inax-bfv-113s-1886.html | Sen tắm, PDF |
| 4 | chau-rua-duong-vanh-inax-l-2397v-1515.html | Lavabo, variant |
| 5 | van-xa-bon-tieu-inax-uf-3vs-636.html | Phụ kiện nhỏ |
| 6 | tay-gat-inax-a-311v-1595.html | **404** — test error handling |
| 7-20 | (14 URLs phân bổ đều: không video, desc>2000, >5 ảnh, combo, phụ kiện...) | Tăng coverage |

**Checklist khi xong (paste vào LEO-448 comment):**

```
- [ ] output/sample-20.json tồn tại, đúng schema
- [ ] Không có "images/original.jpg" trong bất kỳ image field
- [ ] SP #1 và #2 có cùng variant_group_id
- [ ] URL #6 (404) skip gracefully, ghi crawl-log, không crash
- [ ] description là plain text, không HTML tags
- [ ] PDF URL trỏ đúng về file .pdf
- [ ] Tất cả images đã lên cdn.dongphugia.com.vn
- [ ] 20 records trong DB với is_active = false
- [ ] [D-22] Không có SKU nào trùng với product is_active=true trong DB
- [ ] crawl-log.json có đủ 8 fields: url, status, sku, imagesCount, hasVariants, hasPdf, error, durationMs
- [ ] Không có SKU nào được derive từ URL slug
```

**Tech Lead approve:**

```bash
touch scripts/crawl-hita-inax/output/phase0-approved.flag
# Comment LEO-448: LGTM
```

---

## Execution Order

```
LEO-448 (Phase 0 — 20 samples)   URGENT — chạy trước
LEO-449 (Phase 1 — discover)     Có thể song song với Phase 0
                                  nhưng Phase 2 bị GATE
LEO-450 (Phase 2 — crawl full)   Chỉ chạy sau phase0-approved.flag
LEO-451 (Phase 3 — CDN upload)   Sau Phase 2
LEO-452 (Phase 4 — import DB)    Sau Phase 3
```

---

## Objections không accept

| Objection | Lý do Reject |
|-----------|-------------|
| SKEPTIC2-5: filter `inax` bỏ sót | Recon confirmed hita dùng "inax" nhất quán. Brand page crawl (D-21) đủ catch edge cases. |
| GUARD2-5: is_active PM manual false | CASE WHEN IS TRUE đã đúng cho cả case này — OK |

---

*2 rounds, 5 agents, 22 decisions. APPROVED.*
*Tech Lead signature required trên Phase 0 output trước khi full run.*
