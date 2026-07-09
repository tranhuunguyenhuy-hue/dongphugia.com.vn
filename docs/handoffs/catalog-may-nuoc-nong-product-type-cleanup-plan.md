# May Nuoc Nong Product Type Cleanup Plan

Updated: 2026-07-09T07:48:18.387Z

- Source tag: `may_nuoc_nong_product_type_cleanup_v1`
- Total candidates: `61`

## Proposed product_type breakdown

- may-nuoc-nong-gian-tiep: 26
- may-nuoc-nong-nang-luong-mat-troi: 2
- may-nuoc-nong-truc-tiep: 31
- phu-kien-may-nuoc-nong: 2

## Product types to ensure

- may-nuoc-nong-truc-tiep | Máy nước nóng trực tiếp
- may-nuoc-nong-gian-tiep | Máy nước nóng gián tiếp
- may-nuoc-nong-nang-luong-mat-troi | Máy nước nóng năng lượng mặt trời
- phu-kien-may-nuoc-nong | Phụ kiện máy nước nóng

## Guardrails

- Chỉ update các row hiện `product_type is null` trong `vat-lieu-nuoc/may-nuoc-nong`.
- Seed product_types theo kiểu additive; không sửa slug/type cũ.
- Rollback chỉ trả product rows về `null`; không xóa type seed additive.

