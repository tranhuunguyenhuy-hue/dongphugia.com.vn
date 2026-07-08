# Catalog Cleanup High-Confidence Plan

Updated: 2026-07-08T19:29:41.938Z

- Source tag: `catalog_cleanup_high_confidence_v1`
- Vật liệu nước high-confidence product_type backfill: `112`
- Gạch ốp lát high-confidence primary taxon backfill: `165`
- Total write candidates: `277`

## Vật liệu nước

- Scope: chỉ các sản phẩm `product_type is null` và subcategory nằm trong `loc-nuoc`, `bon-chua-nuoc`, `may-bom-nuoc`.
- Không đụng `may-nuoc-nong` vì hiện vẫn là lane low-confidence/manual.

- loc-nuoc: 73
- bon-chua-nuoc: 20
- may-bom-nuoc: 19

## Gạch ốp lát

- Scope: chỉ các sản phẩm `gach-op-lat` chưa có primary taxon và subcategory nằm trong 4 leaf high-confidence.
- Không đổi `product_type`, không đổi `category_id/subcategory_id`, chỉ thêm `product_taxon_assignments` primary.

- gach-op-tuong: 144 -> taxon_id=32 (gach-op-lat/gach-op-tuong)
- gach-trang-tri: 10 -> taxon_id=34 (gach-op-lat/gach-trang-tri)
- gach-inax-ecocarat: 9 -> taxon_id=35 (gach-op-lat/gach-inax-ecocarat)
- gach-op-lat: 2 -> taxon_id=31 (gach-op-lat/gach-op-lat)

## Guardrails

- Chỉ execute nếu preflight xác nhận exact scope count vẫn khớp.
- Rollback lane `vat-lieu-nuoc`: trả `product_type` về `null` đúng cho scope đã cập nhật.
- Rollback lane `gạch ốp lát`: chỉ xóa assignment được tạo bởi source tag này.

