# Gach Op Lat Product Type Cleanup Plan

Updated: 2026-07-09T08:40:22.713Z

- Source tag: `gach_op_lat_product_type_cleanup_v1`
- Total candidates: `330`

## Proposed product_type breakdown

- gach-ho-boi: 8
- gach-inax-ecocarat: 19
- gach-op-tuong: 181
- gach-thiet-ke-xi-mang: 26
- gach-trang-tri: 34
- gach-van-da-marble: 26
- gach-van-da-tu-nhien: 23
- gach-van-go: 12
- keo-dan-gach: 1

## Breakdown by subcategory

- gach-inax-ecocarat: 19
- gach-op-lat: 9
- gach-op-tuong: 181
- gach-thiet-ke-xi-mang: 26
- gach-trang-tri: 34
- gach-van-da-marble: 26
- gach-van-da-tu-nhien: 23
- gach-van-go: 12

## Product types to ensure

- gach-van-da-marble -> gach-van-da-marble | Gạch Vân Đá Marble
- gach-van-da-tu-nhien -> gach-van-da-tu-nhien | Gạch Vân Đá Tự Nhiên
- gach-van-go -> gach-van-go | Gạch Vân Gỗ
- gach-thiet-ke-xi-mang -> gach-thiet-ke-xi-mang | Gạch Thiết Kế Xi Măng
- gach-trang-tri -> gach-trang-tri | Gạch Trang Trí
- gach-op-tuong -> gach-op-tuong | Gạch Ốp Tường
- gach-inax-ecocarat -> gach-inax-ecocarat | Gạch Inax Ecocarat
- gach-op-lat -> gach-ho-boi | Gạch hồ bơi
- gach-op-lat -> keo-dan-gach | Keo dán gạch
- gach-op-lat -> gach-op-lat | Gạch ốp lát

## Guardrails

- Chỉ update các row hiện `product_type is null` trong `gach-op-lat`.
- Seed product_types theo kiểu additive; không sửa slug/type cũ.
- Rollback chỉ trả product rows về `null`; không xóa type seed additive.
- Với subcategory `gach-op-lat`, heuristic hiện chỉ chấp nhận `gach-ho-boi`, `keo-dan-gach`, hoặc fallback `gach-op-lat`.

