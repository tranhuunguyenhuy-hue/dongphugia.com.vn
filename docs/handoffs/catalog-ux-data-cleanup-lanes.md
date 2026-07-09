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

- Candidate rows: 330
- Missing product_type: 330
- Missing primary taxon: 0
- Public PDP rows: 320
- Listing-visible rows: 320

### Breakdown by subcategory

- gach-op-tuong: 181
- gach-trang-tri: 34
- gach-thiet-ke-xi-mang: 26
- gach-van-da-marble: 26
- gach-van-da-tu-nhien: 23
- gach-inax-ecocarat: 19
- gach-van-go: 12
- gach-op-lat: 9

### Breakdown by brand

- INAX: 209
- KECH: 18
- BOOST NATURAL: 11
- BOOST BALANCE: 9
- MOTLEY: 6
- VARANA STONE: 6
- MIMESIS: 5
- ONYCE: 5
- PAPIER: 5
- MARVEL GALA: 4
- TELE DI MARMO LUMIA: 4
- VARANA: 4

### Notes

- Ưu tiên 1: backfill primary taxon cho toàn bộ rows còn thiếu.
- Ưu tiên 2: xác định có cần product_type riêng cho từng line gạch hay chỉ bám subcategory/taxon leaf.
- Hiện không nên bật spec filter UX sâu cho lane này dù đã có một vài spec candidate.

### Sample rows

- [39435] ECP-25NET-LUX-13 | gach-inax-ecocarat | INAX | type=(null) | primary_taxon=yes | Gạch nội thất ECOCARAT PLUS LUXURY MOSAIC INAX ECP-25NET/LUX
- [7824] ECP-25NET-LUX-12 | gach-inax-ecocarat | INAX | type=(null) | primary_taxon=yes | Gạch nội thất ECOCARAT PLUS LUXURY MOSAIC INAX ECP-25NET/LUX
- [39437] ECP-60NET/PMK12 | gach-inax-ecocarat | INAX | type=(null) | primary_taxon=yes | Gạch nội thất ECOCARAT PLUS PEARL MASK INAX ECP-60NET/PMK
- [7826] ECP-60NET/PMK11 | gach-inax-ecocarat | INAX | type=(null) | primary_taxon=yes | Gạch nội thất ECOCARAT PLUS PEARL MASK INAX ECP-60NET/PMK
- [12027] ECP-60NET/QLT1 | gach-inax-ecocarat | INAX | type=(null) | primary_taxon=yes | Gạch nội thất ECOCARAT PLUS QUILT INAX ECP-60NET/QLT
- [7827] ECP-60NET/QLT2 | gach-inax-ecocarat | INAX | type=(null) | primary_taxon=yes | Gạch nội thất ECOCARAT PLUS QUILT INAX ECP-60NET/QLT
- [12032] ECP-303/RBM1N | gach-inax-ecocarat | INAX | type=(null) | primary_taxon=yes | Gạch nội thất ECOCARAT PLUS RIBMIX INAX ECP-303/RBM
- [7822] ECP-303/RBM2N | gach-inax-ecocarat | INAX | type=(null) | primary_taxon=yes | Gạch nội thất ECOCARAT PLUS RIBMIX INAX ECP-303/RBM
- [39440] ECP-303/RBM3N | gach-inax-ecocarat | INAX | type=(null) | primary_taxon=yes | Gạch nội thất ECOCARAT PLUS RIBMIX INAX ECP-303/RBM
- [7829] ECP-375/RTZ1N | gach-inax-ecocarat | INAX | type=(null) | primary_taxon=yes | Gạch nội thất ECOCARAT PLUS ROUGH QUARTZ INAX ECP-375/RTZ
- [39439] ECP-375/RTZ2N | gach-inax-ecocarat | INAX | type=(null) | primary_taxon=yes | Gạch nội thất ECOCARAT PLUS ROUGH QUARTZ INAX ECP-375/RTZ
- [39438] ECP-375/RTZ3N | gach-inax-ecocarat | INAX | type=(null) | primary_taxon=yes | Gạch nội thất ECOCARAT PLUS ROUGH QUARTZ INAX ECP-375/RTZ

