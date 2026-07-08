# Catalog Cleanup Lanes

Updated: 2026-07-09

This report turns the remaining weak data lanes into execution-ready cleanup buckets.

## Vật liệu nước

- Candidate rows: 61
- Missing product_type: 61
- Missing primary taxon: 0
- Public PDP rows: 61
- Listing-visible rows: 61

### Breakdown by subcategory

- may-nuoc-nong: 61

### Breakdown by brand

- Ferroli: 24
- Ariston: 17
- PANASONIC: 14
- Rheem: 3
- Toshiba: 3

### Notes

- Ưu tiên 1: fill product_type cho máy nước nóng, máy lọc nước, bồn chứa nước, máy bơm nước.
- Ưu tiên 2: sau khi có product_type, mới cân nhắc mở product-type UI hoặc spec filters.
- Hiện không nên bật spec filter runtime cho lane này.

### Sample rows

- [5320] PC-3-E | may-nuoc-nong | Ariston | type=(null) | primary_taxon=yes | Bộ hỗ trợ nhiệt cho máy nước nóng năng lượng mặt trời dạng ống Ariston PC-3-E
- [5312] AN2 15 LUX-D | may-nuoc-nong | Ariston | type=(null) | primary_taxon=yes | Máy nước nóng gián tiếp Andris Lux-D Ariston AN2 LUX-D AN2 15 LUX-D
- [421] AN2 R 15 | may-nuoc-nong | Ariston | type=(null) | primary_taxon=yes | Máy nước nóng gián tiếp Andris2 R Ariston AN2 R 15
- [420] AN2 RS 15 | may-nuoc-nong | Ariston | type=(null) | primary_taxon=yes | Máy nước nóng gián tiếp Andris2 Rs Ariston AN2 RS 15
- [5311] PRO R 100L H | may-nuoc-nong | Ariston | type=(null) | primary_taxon=yes | Máy nước nóng gián tiếp Pro R Ariston ngang/ đứng PRO R 100L H
- [5317] SL3 20 LUX | may-nuoc-nong | Ariston | type=(null) | primary_taxon=yes | Máy nước nóng gián tiếp Slim3 LUX Ariston SL3 20 LUX
- [5315] SL3 20 R | may-nuoc-nong | Ariston | type=(null) | primary_taxon=yes | Máy nước nóng gián tiếp Slim3 R Ariston SL3 20 R
- [5316] SL3 15 RS | may-nuoc-nong | Ariston | type=(null) | primary_taxon=yes | Máy nước nóng gián tiếp Slim3 RS Ariston SL3 15 RS
- [5318] SL3 20 TOP WIFI | may-nuoc-nong | Ariston | type=(null) | primary_taxon=yes | Máy nước nóng gián tiếp Slim3 TOP WIFI Ariston SL3 20 TOP WIFI
- [5293] VITALY 15 | may-nuoc-nong | Ariston | type=(null) | primary_taxon=yes | Máy nước nóng gián tiếp Vitaly Ariston
- [5313] ECO2 1810 25 | may-nuoc-nong | Ariston | type=(null) | primary_taxon=yes | Máy nước nóng năng lượng mặt trời dạng ống Ariston ECO TUBE ECO2 1810 25
- [5314] KAIROS THERMO DR-2 150-1 N TT | may-nuoc-nong | Ariston | type=(null) | primary_taxon=yes | Máy nước nóng năng lượng mặt trời tấm phẳng Ariston KAIROS THERMO DR-2

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

