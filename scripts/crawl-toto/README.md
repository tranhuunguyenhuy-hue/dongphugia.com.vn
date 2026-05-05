# TOTO Crawl Pipeline

Crawl & import dữ liệu sản phẩm TOTO từ Hita vào Đông Phú Gia.

## Pipeline Flow

```
1. category-lister.mjs    → output/toto-listing.json       (259 URLs từ SSR)
2. merge-sources.mjs      → output/toto-master-urls.json   (merge với DB)
3. crawl-toto-pdp.mjs     → output/toto-enriched.json      (PDP chi tiết)
4. variant-expander.mjs   → output/toto-expanded.json      (mở rộng biến thể)
5. mirror-toto-images.mjs → output/toto-image-map.json     (ảnh → CDN DPG)
6. import-toto.mjs        → DB updated                     (upsert vào DB)
7. audit-toto.mjs         → audit report                   (kiểm tra toàn vẹn)
```

## Usage

```bash
# Phase 1: Chuẩn bị
node scripts/crawl-toto/backup-toto.mjs                     # Backup trước
node scripts/crawl-toto/category-lister.mjs                  # Lấy URLs
node scripts/crawl-toto/merge-sources.mjs                    # Merge với DB

# Phase 2: Crawl
node scripts/crawl-toto/crawl-toto-pdp.mjs                   # Crawl PDP
node scripts/crawl-toto/crawl-toto-pdp.mjs --resume          # Resume nếu crash
node scripts/crawl-toto/variant-expander.mjs                  # Mở rộng biến thể

# Phase 3: Import
node scripts/crawl-toto/mirror-toto-images.mjs               # Mirror ảnh CDN
node scripts/crawl-toto/import-toto.mjs                       # Import vào DB
node scripts/crawl-toto/import-toto.mjs --dry-run            # Test trước

# Audit
node scripts/crawl-toto/audit-toto.mjs                       # Kiểm tra

# Rollback
node scripts/crawl-toto/backup-toto.mjs --restore <file>     # Rollback
```

## Rate Limiting

- Category: 2-3.5s delay
- PDP: 3-4s delay
- Images: 3 concurrent downloads

## Env Required

```env
DATABASE_URL=...
BUNNY_STORAGE_ZONE_NAME=dpg-products
BUNNY_STORAGE_API_KEY=...
BUNNY_STORAGE_HOSTNAME=storage.bunnycdn.com
BUNNY_CDN_HOSTNAME=cdn.dongphugia.com.vn
```
