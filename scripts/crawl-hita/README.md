# Shared Hita Crawl Pipeline

Crawl sản phẩm từ hita.com.vn cho tất cả brands vào DPG database.

## Brands được hỗ trợ

| Brand | DB slug | Status |
|---|---|---|
| CAESAR | `caesar` | Todo |
| GROHE | `grohe` | Todo |
| COTTO | `cotto` | Todo |
| Viglacera | `viglacera` | Todo |
| American Standard | `american-standard` | Todo |
| ATMOR | `atmor` | Todo |
| MOEN | `moen` | Todo |
| INAX | `inax` | ✅ Done (Phase 5 retroactive only) |
| TOTO | `toto` | ✅ Done (Phase 5 retroactive only) |

## Quy trình cho từng brand mới

```bash
# 1. Discover URLs
node 1-discover-urls.js --brand=caesar
# → output/caesar/urls.json

# 2a. Phase 0: Sample 20 PDPs (Tech Lead review trước khi full crawl)
node 2-crawl-pdp.js --brand=caesar --sample-only
# → output/caesar/sample-20.json
# ⚠️  Comment sample-20.json lên Linear, đợi Tech Lead approve

# 2b. Tech Lead approve → tạo flag file
touch output/caesar/phase0-approved.flag

# 2c. Full crawl
node 2-crawl-pdp.js --brand=caesar
# → output/caesar/crawled-products.json

# Resume nếu bị interrupt
node 2-crawl-pdp.js --brand=caesar --resume

# 3. Upload images lên Bunny CDN
node 3-upload-images.js --brand=caesar
# → output/caesar/crawled-products-with-cdn.json

# 4. Import vào Supabase (is_active=false)
node 4-import-db.js --brand=caesar

# 5. Crawl upsell relationships
node 5-crawl-upsell.js --brand=caesar
# → upsert vào product_relationships table

# 6. Comment summary lên Linear issue LEO-454
```

## Retroactive INAX + TOTO (Phase 5 upsell)

```bash
node 5-crawl-upsell.js --brand=inax --urls-from=../crawl-hita-inax/output/inax-urls.json
node 5-crawl-upsell.js --brand=toto --urls-from=../crawl-toto/output/toto-urls.json
```

> Chạy sau khi đã import xong tất cả brands để maximize complement resolution.

## Output files (per brand)

```
output/<brand>/
├── urls.json                      # Phase 1: danh sách PDPs discovered
├── sample-20.json                 # Phase 0: 20 sample products
├── phase0-approved.flag           # Gate file — tạo thủ công sau khi Tech Lead approve
├── crawl-progress.json            # Resume checkpoint
├── crawled-products.json          # Phase 2: raw PDP data
├── crawled-products-with-cdn.json # Phase 3: CDN URLs replaced
├── image-map.json                 # Phase 3: source→CDN URL mapping
├── crawl-log.json                 # Phase 2: per-URL log
├── upsell-progress.json           # Phase 5: resume checkpoint
└── upsell-log.json                # Phase 5: per-URL log
```

## Thứ tự ưu tiên brand

CAESAR → GROHE → COTTO → Viglacera → American Standard → ATMOR → MOEN

## Lessons learned / Gotchas

| Vấn đề | Fix |
|---|---|
| Cloudflare throttle | Giữ `p-limit(3)`, delay 1-1.8s. KHÔNG tăng concurrency |
| Gallery template 2 loại | Script tự detect: `/storage/` (new) → `/public/upload/` (legacy) |
| SKU null | D-03: skip sản phẩm, không fallback sang slug |
| Interrupt giữa chừng | `--resume` flag đọc `crawl-progress.json` |
| Complement chưa import | Phase 5 skip + log. Re-run sau khi import đủ brands |
| `--brand` thiếu | Error rõ ràng + danh sách valid brands |
| Category chưa map | Warning trong console + null. Bổ sung vào `category-map.js` |

## Category map

Nếu thấy warning `No mapping for: "/some-path.html"` trong crawl log:
1. Inspect breadcrumb URL đó trên hita.com.vn
2. Map sang subcategory_id + product_type tương ứng trong DPG
3. Thêm vào `category-map.js`
4. Re-run Phase 2 (với `--resume` nếu chỉ fix một phần)

## Environment variables (`.env` ở root)

```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
BUNNY_STORAGE_API_KEY=...
BUNNY_STORAGE_ZONE_NAME=...
BUNNY_CDN_HOSTNAME=cdn.dongphugia.com.vn
```
