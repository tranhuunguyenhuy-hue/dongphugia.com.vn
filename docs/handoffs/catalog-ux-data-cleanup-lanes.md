# Catalog Cleanup Lanes

Updated: 2026-07-09

This report turns the remaining weak data lanes into execution-ready cleanup buckets.

## Vật liệu nước

- Candidate rows: 0
- Missing product_type: 0
- Missing primary taxon: 0
- Public PDP rows: 0
- Listing-visible rows: 0

### Breakdown by subcategory


### Breakdown by brand


### Notes

- Ưu tiên 1: fill product_type cho máy nước nóng, máy lọc nước, bồn chứa nước, máy bơm nước.
- Ưu tiên 2: sau khi có product_type, mới cân nhắc mở product-type UI hoặc spec filters.
- Hiện không nên bật spec filter runtime cho lane này.

### Sample rows


## Gạch ốp lát

- Candidate rows: 0
- Missing product_type: 0
- Missing primary taxon: 0
- Public PDP rows: 0
- Listing-visible rows: 0

### Breakdown by subcategory


### Breakdown by brand


### Notes

- Ưu tiên 1: backfill primary taxon cho toàn bộ rows còn thiếu.
- Ưu tiên 2: xác định có cần product_type riêng cho từng line gạch hay chỉ bám subcategory/taxon leaf.
- Hiện không nên bật spec filter UX sâu cho lane này dù đã có một vài spec candidate.

### Sample rows


