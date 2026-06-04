# 🧠 Multi-Agent Brainstorming — LEO-447
## Crawl INAX từ hita.com.vn → Import DPG

> **Ngày:** 29/05/2026 | **Model:** Claude Sonnet 4.6 (Thinking)
> **Trạng thái cuối:** ✅ **APPROVED** (với 8 điều chỉnh bắt buộc)

---

## 📋 PHASE 1 — Understanding Lock (Primary Designer)

| Hạng mục | Xác nhận |
|---------|---------|
| Stack | Playwright + Node.js |
| Tổng sản phẩm | ~2,208 INAX URLs từ sitemap |
| Chiến lược DB | Upsert by SKU, không xóa cũ |
| Gate bắt buộc | Phase 0 (10 samples) → Tech Lead LGTM → mới full run |
| `is_active` default | `false` — PM review thủ công |
| Lưu trữ ảnh | Bunny CDN (`cdn.dongphugia.com.vn`) |
| Tài liệu đọc trước | `docs/crawl/hita-inax-recon.md` + `hita-inax-crawl-spec.md` |

**Context lịch sử quan trọng:**
- Lần crawl trước (Phiên 1–5) đã FAIL vì: slider loop → 15,000 ảnh rác, SKU dirty từ slug URL, variant grouping tốn cả sprint dọn
- Codebase cũ (`scripts/crawl-inax/phase2_main.ts`) có nhiều pattern sai → KHÔNG dùng làm template
- Đây là crawl lần 2 với Playwright thay vì requests thuần

---

## 🔴 PHASE 2 — Structured Review (3 Agents)

### 🗡️ Skeptic Agent — Điểm yếu kỹ thuật

| ID | Mức độ | Vấn đề |
|----|--------|--------|
| **SKEPTIC-1** | 🔴 Critical | Slick slider clone nodes → bộ ảnh bị nhân đôi 2-3x → ảnh rác (ĐÚNG là root cause của Phiên 5 FAIL) |
| **SKEPTIC-2** | 🟠 High | SKU fallback từ slug URL → tái tạo 1,473 SKU bẩn (`BON-CAU-1-KHOI-INAX-AC-939VN`) như lần trước |
| **SKEPTIC-3** | 🟠 High | `ON CONFLICT (sku)` vô dụng khi SKU input chưa normalize — bản ghi cũ sạch bị shadow bởi bản mới bẩn |
| **SKEPTIC-4** | 🟡 Medium | Filter `/storage/` trong spec mâu thuẫn với code thực tế (filter `FORBIDDEN_DOMAINS`) — chưa rõ bên nào đúng |
| **SKEPTIC-5** | 🟡 Medium | PDF selector: spec nói `#box-attachments` nhưng findings.md nói `#package-attachments` — cần validate |
| **SKEPTIC-6** | 🟠 High | Variant grouping: `visited_urls` set chỉ chống duplicate URL, không gán `is_master` tự động — lại tốn sprint dọn |
| **SKEPTIC-7** | 🟠 High | `innerText` cho description mâu thuẫn với pipeline `migrate_desc_images.ts` — phá vỡ toàn bộ flow ảnh mô tả |

### 🛡️ Constraint Guardian — Vi phạm ràng buộc

| ID | Trạng thái | Ràng buộc |
|----|-----------|-----------|
| GUARD-1 | ❌ VI PHẠM | `phase2_main.ts` cũ set `is_active: true` khi INSERT mới — sẽ publish ngay nếu copy template |
| GUARD-2 | ✅ OK | Upsert by SKU, không DELETE |
| GUARD-3 | ⚠️ WARN | Không có gate code ngăn Phase 2 chạy trước Phase 0 approved |
| GUARD-4 | ⚠️ WARN | Chưa exclude explicit gạch ốp lát (chỉ filter `inax` trong URL) |
| GUARD-6 | ⚠️ WARN | Không có validation gate sau Phase 2 (images>0, sku required) |
| GUARD-11 | ❌ VI PHẠM | Codebase lưu `descHtml` HTML, spec mới yêu cầu plain text `innerText` |
| GUARD-12 | ⚠️ WARN | `variant_group_id` không deterministic khi crawl concurrent (3 pages) |
| GUARD-13 | ❌ VI PHẠM | `crawl-log.json` cấu trúc đầy đủ chưa được implement trong bất kỳ script nào |
| GUARD-14 | ❌ VI PHẠM | Concurrency chưa được định nghĩa — không có semaphore/p-limit trong design |

### 🧑‍💼 User Advocate — Trải nghiệm người dùng

| ID | Mức | Người dùng | Vấn đề |
|----|-----|-----------|--------|
| **ADVOCATE-1** | 🟠 High | Tech Lead | 10 samples (0.45%) quá ít — có thể LGTM sai → full run sinh 200-300 lỗi |
| **ADVOCATE-2** | 🟡 Medium | Tech Lead | Log thiếu error detail → khó triage nguyên nhân fail cụ thể |
| **ADVOCATE-3** | 🟠 High | PM | Phải publish thủ công 2,208 sản phẩm không có batch tool |
| **ADVOCATE-4** | 🟠 High | PM | Không có signal nào cho biết sản phẩm nào thiếu data, cần review kỹ |
| **ADVOCATE-5** | 🟠 High | Khách hàng | Không rõ timing CDN upload vs DB import → nguy cơ ảnh broken khi xem |
| **ADVOCATE-6** | 🟡 Medium | Khách hàng | `variant_group` thiếu label/attribute để frontend render selector |

---

## ✅ PHASE 3 — Integration & Arbitration

### Decision Log

---

#### D-01: Description — plain text hay HTML?

**Skeptic-7 vs Spec**

- **Objection:** `innerText` phá vỡ `migrate_desc_images.ts` pipeline
- **Resolution:** ✅ **ACCEPT spec — Dùng `innerText`**
- **Rationale:** Crawl lần 2 này là "clean start". `migrate_desc_images.ts` là artifact của lần crawl cũ đã FAIL. Spec mới chọn `innerText` để tránh toàn bộ complexity hotlink/lazy-load. Đây là trade-off có chủ đích: mất HTML formatting đổi lấy pipeline đơn giản hơn. Description INAX không chứa table quan trọng — chủ yếu là paragraph text.

---

#### D-02: Slider dedup — chống ảnh rác

**Skeptic-1 (Critical)**

- **Objection:** Slick slider clone nodes nhân đôi slides → ảnh rác
- **Resolution:** ✅ **ACCEPT — Thêm 2 lớp bảo vệ:**
  1. Chỉ lấy slides có attribute `data-slick-index` ≥ 0 (native slides, không phải clones)
  2. Dedup URL sau khi collect (Set)
  3. Cap tối đa 20 ảnh/sản phẩm
- **Code pattern:**
```js
const slides = await page.locator('.item.slick-slide[data-slick-index]').all();
// data-slick-index chỉ có trên slides thật, không có trên Slick clones
```

---

#### D-03: SKU — không bao giờ fallback từ URL slug

**Skeptic-2 (High)**

- **Objection:** Slug URL chứa tiền tố SEO → SKU bẩn
- **Resolution:** ✅ **ACCEPT — Hard rule: không fallback SKU**
  - Nếu `.product-code` không có → `sku = null`
  - Nếu `sku = null` → log warning, **SKIP IMPORT** (không insert vào DB)
  - Không bao giờ derive SKU từ slug

---

#### D-04: Variant grouping — deterministic với concurrent

**Skeptic-6 + Guard-12**

- **Objection:** `visited_urls` set + concurrent 3 pages → variant_group không deterministic
- **Resolution:** ✅ **ACCEPT — Chiến lược:**
  1. `variant_group_id` = slug của trang hiện tại có `isActive: true`
  2. Nếu không có active → slug URL ngắn nhất trong nhóm
  3. `is_master`: variant có `isActive: true` VÀ không có "nắp điện tử"/"H17"/"H18"/"H20" trong tên

---

#### D-05: PDF selector — validate thực địa

**Skeptic-5 (Medium)**

- **Objection:** Spec nói `#box-attachments` nhưng findings nói `#package-attachments`
- **Resolution:** ✅ **ACCEPT — Dùng cả hai với fallback:**
```js
const pdfLinks = await page.locator('#box-attachments a[href$=".pdf"], #package-attachments a[href$=".pdf"]').all();
```
  - Log selector nào match để validate trong Phase 0

---

#### D-06: Gallery image filter strategy

**Skeptic-4 (Medium)**

- **Objection:** Filter `/storage/` mâu thuẫn với code thực tế
- **Resolution:** ✅ **ACCEPT Spec — Dùng `/storage/` filter**
  - Recon đã xác nhận ảnh hợp lệ đều có path `/storage/`
  - Codebase cũ sai → spec mới đúng
  - Pattern: `imgUrl.includes('/storage/') && !imgUrl.includes('ytimg')`

---

#### D-07: Phase 0 gate — tăng từ 10 lên 20 samples

**Advocate-1 (High)**

- **Objection:** 10 samples = 0.45% tổng số → Tech Lead không tự tin approve
- **Resolution:** ✅ **ACCEPT PARTIALLY — Tăng lên 20 samples**
  - Giữ 6 URLs mẫu từ spec (bồn cầu, lavabo, sen tắm, phụ kiện, 404)
  - Thêm: 1 sản phẩm không có PDF, 1 không có video, 1 không có variants, 1 combo, 1 có nhiều ảnh >8
  - Script có `--sample-only` flag để chạy Phase 0 riêng biệt
  - Gate code: nếu không có flag `--confirmed-by-lead`, script sẽ hỏi xác nhận trước khi crawl full

---

#### D-08: crawl-log.json — implement đầy đủ

**Guard-13 (Critical)**

- **Objection:** Chưa có implementation
- **Resolution:** ✅ **ACCEPT — Bắt buộc theo spec:**
```json
{ "url": "...", "status": "ok|404|error", "sku": "...",
  "imagesCount": 5, "hasVariants": true, "hasPdf": false,
  "error": null, "durationMs": 1234, "selector_pdf_source": "#box-attachments" }
```

---

#### D-09: concurrency — p-limit semaphore

**Guard-14 (Critical)**

- **Objection:** Không có semaphore → có thể vượt 3 pages hoặc quá chậm
- **Resolution:** ✅ **ACCEPT — Dùng `p-limit`:**
```js
import pLimit from 'p-limit';
const limit = pLimit(3); // max 3 Playwright pages concurrent
```

---

#### D-10: is_active — hard-coded false, không copy pattern cũ

**Guard-1 (Critical)**

- **Objection:** `phase2_main.ts` cũ set `is_active: true`
- **Resolution:** ✅ **ACCEPT — Rule bất biến trong script mới:**
  - `is_active: false` không phải option — là constant
  - Add eslint comment `// NEVER SET is_active: true — PM review required`

---

#### D-11: Validation gate sau Phase 2

**Guard-6 (Warn)**

- **Objection:** Thiếu validation bắt buộc (images>0, sku required)
- **Resolution:** ✅ **ACCEPT:**
```js
if (!sku) { log.warn('No SKU — SKIP'); continue; }
if (images.length === 0) { log.warn('No images — SKIP'); continue; }
if (!name) { log.warn('No name — SKIP'); continue; }
```

---

#### D-12: Thứ tự Phase 3 → 4 đảm bảo không broken images

**Advocate-5 (High)**

- **Objection:** Không rõ timing CDN upload vs DB import
- **Resolution:** ✅ **ACCEPT — Thứ tự bắt buộc:**
  1. Script `3-upload-images.js` chạy TRƯỚC, output `output/products-with-cdn-urls.json`
  2. Script `4-import-db.js` chỉ đọc CDN URLs từ file trên
  3. KHÔNG insert ảnh nào còn URL trỏ về hita vào DB

---

### Objections không được chấp nhận

| Objection | Lý do Reject |
|-----------|-------------|
| ADVOCATE-3 (Batch publish tool) | Ngoài scope LEO-447 — là PM tool riêng |
| ADVOCATE-4 (Data quality signal) | Có thể giải quyết qua `crawl-log.json` stats, không cần feature mới |
| ADVOCATE-6 (Frontend variant UI) | Frontend concern — không phải crawl concern |
| GUARD-4 (Gạch ốp lát filter) | Recon đã xác nhận: hita chỉ có thiết bị vệ sinh INAX, không có gạch |

---

## 🏁 Exit Check

- [x] Understanding Lock completed
- [x] All 3 reviewer agents invoked
- [x] All objections resolved or explicitly rejected
- [x] Decision Log complete (12 decisions)
- [x] Arbiter declared design acceptable

**Final Disposition: ✅ APPROVED**

---

## 📁 Kế hoạch triển khai chi tiết

### Cấu trúc files cần tạo

```
scripts/crawl-hita-inax/
├── utils.js              ← parseVND, resolveUrl, sleep, pLimit setup
├── category-map.js       ← hita URL path → DPG category/subcategory
├── 1-discover-urls.js    ← sitemap pages 1-20 → inax-urls.json
├── 2-crawl-pdp.js        ← PDP extraction (p-limit 3), --sample-only flag
├── 3-upload-images.js    ← Bunny CDN upload (p-limit 5)
├── 4-import-db.js        ← Supabase upsert is_active=false
output/
├── inax-urls.json        ← Phase 1 output
├── sample-20.json        ← Phase 0 output (20 products)
├── crawled-products.json ← Phase 2 output
├── products-with-cdn-urls.json ← Phase 3 output
└── crawl-log.json        ← Log mọi URL
```

### Điểm kỹ thuật cần implement (theo priority)

1. **🔴 P0 — Critical (phải làm trước khi chạy)**
   - Slider dedup: dùng `data-slick-index` attribute, cap 20 ảnh
   - SKU: không fallback từ slug, skip nếu null
   - `is_active: false` hard-coded
   - `crawl-log.json` đầy đủ fields
   - `p-limit(3)` cho Playwright pages

2. **🟠 P1 — High (phải có trước full run)**
   - Variant grouping deterministic (active variant slug làm group ID)
   - `is_master` logic
   - Validation gate (sku, images, name)
   - Phase 0 gate (`--sample-only` flag + confirmation prompt)

3. **🟡 P2 — Medium (nice to have)**
   - PDF selector fallback (cả `#box-attachments` và `#package-attachments`)
   - Log thêm `selector_pdf_source` để validate

### Acceptance Criteria (cập nhật)

- [ ] **Phase 0**: 20 sản phẩm mẫu, Tech Lead LGTM
- [ ] **Phase 1**: `inax-urls.json` có ~2,208 URLs
- [ ] **Phase 2**: mọi product có name, sku, price, images>0, description (plain text)
- [ ] **Phase 3**: ảnh trên CDN, không URL hita còn sót
- [ ] **Phase 4**: upsert `is_active=false`, không broken image trong DB
- [ ] URL 404 skip gracefully
- [ ] Không có `images/original.jpg` placeholder
- [ ] Không SKU rác từ slug URL
- [ ] `crawl-log.json` có đủ: url, status, sku, imagesCount, durationMs, error
- [ ] Variant cùng nhóm có cùng `variant_group` (deterministic)
- [ ] Max 20 ảnh/sản phẩm, không ảnh rác slider clone

---

*Tạo bởi Antigravity Multi-Agent Brainstorming — LEO-447*

---

## 🔵 TECH LEAD REVIEW — 29/05/2026

**Overall: ✅ APPROVED với 3 điều chỉnh nhỏ**

---

### ✅ Xác nhận các quyết định đúng

**D-02 (Slider clone) — CRITICAL, đây là root cause phiên trước fail.** Đúng hướng dùng `data-slick-index`. Tuy nhiên cần một correction:

> ⚠️ Slick clones **CÓ `data-slick-index`** nhưng giá trị là **âm** (ví dụ `-1`, `-2`). Nếu chỉ dùng `[data-slick-index]` selector sẽ vẫn bao gồm clones.

```js
// SAI — vẫn bao gồm clone slides (data-slick-index = -1, -2...)
const slides = await page.locator('.item.slick-slide[data-slick-index]').all();

// ĐÚNG — lọc chỉ lấy index >= 0
const slides = await page.locator('.item.slick-slide').all();
const realSlides = [];
for (const slide of slides) {
  const idx = parseInt(await slide.getAttribute('data-slick-index') ?? '-1');
  if (idx >= 0) realSlides.push(slide);
}
// Sau đó dedup URL + cap 20
```

**D-03 (SKU no fallback)** — ĐÚNG TUYỆT ĐỐI. Không bao giờ derive SKU từ slug. Skip + log nếu null.

**D-05 (PDF fallback selector)** — Chấp nhận. Để rõ ràng: từ recon thực tế, `#box-attachments` nằm BÊN TRONG `#package-attachments` (không phải song song). Nên cả 2 selector đều trả cùng 1 link. Giữ fallback để an toàn là đúng. Field `selector_pdf_source` trong log là hay — giúp validate ngay Phase 0.

**D-10 (is_active hard-coded false)** — Đồng ý. Comment `// NEVER SET is_active: true` là tốt.

**D-12 (Phase 3 trước Phase 4)** — Đúng. Thêm validation: trước khi insert vào DB, assert `images[0].startsWith('https://cdn.dongphugia.com.vn')`. Nếu fail → abort, không insert broken.

---

### ⚠️ 2 điểm cần clarify trước khi code

**C-01: `is_master` logic (D-04)**

Heuristic dựa trên keyword "nắp điện tử/H17/H18/H20" sẽ fail với sản phẩm không phải bồn cầu (lavabo, sen tắm không có concept "nắp"). Rule đơn giản hơn và đúng hơn:

```js
// is_master = true nếu:
// 1. Không có variants (sản phẩm standalone)
// 2. HOẶC đây là active variant (isActive: true) VÀ là variant đầu tiên gặp trong nhóm
const is_master = variants.length === 0 || variants.find(v => v.isActive)?.url === currentUrl;
```

**C-02: Upsert `is_active` — logic cần sửa**

SQL trong brainstorm đúng hướng nhưng Prisma không support `CASE WHEN` trực tiếp trong upsert. Dùng raw query:

```sql
INSERT INTO products (sku, name, ..., is_active)
VALUES ($1, $2, ..., false)
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  -- ... các fields khác
  is_active = CASE WHEN products.is_active = true THEN true ELSE false END,
  updated_at = NOW()
```

Chạy qua `supabase.rpc()` hoặc `prisma.$executeRaw()` — không dùng Prisma `upsert()` vì không support CASE WHEN.

---

### ✅ Acceptance Criteria — Final

List của Antigravity đã đầy đủ. Thêm 2 items:

- [ ] Gallery: không ảnh nào có `data-slick-index < 0` (clone slide)
- [ ] DB upsert: sản phẩm đã `is_active=true` từ trước → vẫn `true` sau khi re-crawl

---

### 📋 Action items cho Antigravity

1. Sửa slider filter: dùng `data-slick-index >= 0` (không chỉ `[data-slick-index]`)
2. Sửa `is_master` logic theo C-01
3. Upsert dùng raw SQL theo C-02
4. Bắt đầu implement Phase 0 (20 samples) — report lại khi xong

**GO.**
