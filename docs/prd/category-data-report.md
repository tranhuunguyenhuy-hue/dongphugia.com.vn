# Data Report — 4 Danh Muc San Pham
**Cap nhat:** 13/04/2026 | **Danh cho:** Designer — Wireframe & UI Planning
**Nguon:** PostgreSQL production database

---

## Tong quan nhanh

| # | Danh muc | Route | Sub | Tong SP | Brands | Filters |
|---|---------|-------|-----|---------|--------|---------|
| 1 | Thiet bi ve sinh | `/thiet-bi-ve-sinh` | 9 | **4.412** | 15+ | 15 bo loc |
| 2 | Thiet bi bep | `/thiet-bi-bep` | 8 | **570** | 20 | 10 bo loc |
| 3 | Vat lieu nuoc | `/vat-lieu-nuoc` | 4 | **185** | 13 | 2 bo loc |
| 4 | Gach op lat | `/gach-op-lat` | 5 | **111** | 20+ | 2 bo loc |
| | **Tong** | | **26** | **5.278** | | |

---

## 1. Thiet Bi Ve Sinh — 4.412 san pham

### Danh muc con (9 sub)
| # | Ten | Slug | SP | Note |
|---|-----|------|----|------|
| 1 | Bon Cau | `bon-cau` | 957 | |
| 2 | Chau Lavabo | `lavabo` | 827 | |
| 3 | Sen Tam | `sen-tam` | 1.244 | Gop 4 loai sen |
| 4 | Bon Tam | `bon-tam` | 480 | |
| 5 | Phu Kien Phong Tam | `phu-kien-phong-tam` | 309 | Gop: pheu thoat, ke, guong |
| 6 | Voi Chau | `voi-chau` | 269 | = Voi Lavabo(Hita) |
| 7 | Bon Tieu | `bon-tieu` | 212 | |
| 8 | Voi Nuoc | `voi-nuoc` | 97 | = Voi xit ve sinh |
| 9 | Nap Bon Cau | `nap-bon-cau` | 17 | It SP - can nhac an |

### Top brands
TOTO(184) | INAX(149) | American Standard(123) | CAESAR(115) | COTTO(103) | GROHE(101)

### Bo loc (15 filters — nhieu nhat)
Thuong hieu | Khoang gia | Kieu xa | Kieu thoat | Loai nap | Luong nuoc xa | Loai than cau | Mau sac | Loai chau | Lo xa tran | Vi tri lap | Thiet ke | Tinh nang bon tam | Lop ma | Loai voi

### Gia (thuc te)
- Min: ~3.000d (WARNING: data loi crawl)
- Max: 156.126.540d (~156 trieu)
- Avg: ~9.700.000d
- 97% san pham co gia

### Wireframe Notes
- Tabs: 9 tabs — horizontal scroll tren mobile
- Filter sidebar: 15 bo loc — accordion theo subcategory
- "Phu Kien Phong Tam" la catch-all (pheu, ke, guong, voi bon tam)
- "Nap Bon Cau" (17 SP) — xem xet an khoi tab chinh

---

## 2. Thiet Bi Bep — 570 san pham

### Danh muc con (8 sub)
| # | Ten | Slug | SP |
|---|-----|------|----|
| 1 | Voi Rua Chen | `voi-rua-chen` | 216 |
| 2 | Thiet Bi Bep Khac | `thiet-bi-bep-khac` | 123 |
| 3 | Chau Rua Chen | `chau-rua-chen` | 114 |
| 4 | Bep Dien Tu | `bep-dien-tu` | 41 |
| 5 | May Hut Mui | `may-hut-mui` | 23 |
| 6 | May Rua Chen | `may-rua-chen` | 20 |
| 7 | Bep Gas | `bep-gas` | 17 |
| 8 | Lo Nuong | `lo-nuong` | 16 |

### Top brands
Kaff(84) | Kluger(54) | Elica(43) | MOEN(42) | GROHE(40) | INAX(36) | ATMOR(36)

### Bo loc (10 filters)
Thuong hieu | Khoang gia | Loai bep | So vung nau | Loai voi | Loai hoc | So hoc | Chat lieu | Che do | Mau sac

### Gia (thuc te)
- Min: 4.000d (WARNING: data loi)
- Max: 140.250.000d
- Avg: ~9.884.000d
- 100% co gia

### FLAGS CANH BAO
- is_new = 0 -- Chua danh dau
- is_bestseller = 0 -- Chua danh dau
- is_featured = 0 -- San pham FEATURED SECTION se TRONG

### Wireframe Notes
- Tabs: 8 tabs — vua du 1 row desktop, scroll nhe mobile
- is_featured = 0 => featured section RONG => can thiet ke empty state
- Filter sidebar: 10 loc, vua phai, khong can accordion

---

## 3. Vat Lieu Nuoc — 185 san pham

### Danh muc con (4 sub)
| # | Ten | Slug | SP |
|---|-----|------|----|
| 1 | May Nuoc Nong | `may-nuoc-nong` | 73 |
| 2 | Loc Nuoc | `loc-nuoc` | 73 |
| 3 | Bon Chua Nuoc | `bon-chua-nuoc` | 20 |
| 4 | May Bom Nuoc | `may-bom-nuoc` | 19 |

### Brands
PANASONIC(24) | Ferroli(24) | Karofi(21) | Mitsubishi Cleansui(21) | Dai Thanh(20) | Ariston(17)

### Bo loc (2 filters — Don gian nhat)
Thuong hieu | Khoang gia

### Gia (thuc te)
- Min: 370.000d
- Max: 233.673.000d (~234 trieu — bon chua lon)
- Avg: ~15.500.000d
- 100% co gia

### FLAGS CANH BAO
- is_new = 0 / is_featured = 0

### Wireframe Notes
- Tabs: 4 tabs — 1 row moi device
- Chi 2 filters — nen dung inline filter thay vi sidebar day du
- Gia range rong (370K -> 234M): mix may nuoc nong nho + bon chua cong nghiep

---

## 4. Gach Op Lat — 111 san pham

### Danh muc con (5 sub)
| # | Ten | Slug | SP |
|---|-----|------|----|
| 1 | Gach Van Da Marble | `gach-van-da-marble` | 26 |
| 2 | Gach Van Da Tu Nhien | `gach-van-da-tu-nhien` | 23 |
| 3 | Gach Van Go | `gach-van-go` | 12 |
| 4 | Gach Thiet Ke Xi Mang | `gach-thiet-ke-xi-mang` | 26 |
| 5 | Gach Trang Tri | `gach-trang-tri` | 24 |

### Brands/Collection (Vietceramics — Italia/Portugal)
BOOST NATURAL(11) | BOOST BALANCE(9) | KECH(8) | VARANA STONE(6) | MOTLEY(6) + 15 khac

### Bo loc (2 filters)
Thuong hieu | Khoang gia

### Gia (thuc te)
- PRICE = 0 CHO TAT CA 111 SP
- Tat ca hien thi "Lien he bao gia"

### FLAGS
- is_new = 111 (toan bo — import moi)
- is_featured = 0

### Wireframe Notes
- QUAN TRONG: "Brand" nen doi label -> "Bo suu tap" (Collection-based product)
- Tabs: 5 tabs chip-style
- 2 filters: dung inline filter
- Grid 3 cot (thay vi 4) vi anh pattern quan trong hon
- Price filter: khong tac dung (gia = 0) — co the an filter gia cho tab nay

---

## CANH BAO CHUNG

| Van de | Anh huong | Danh muc |
|--------|-----------|---------|
| is_featured = 0 | Featured section trong | TB Bep, Vat lieu nuoc, Gach |
| is_new/bestseller = 0 | Khong co badge | TB Bep, Vat lieu nuoc |
| Gia loi (3.000d-4.000d) | Filter gia sai | TBVS, TB Bep |
| Gach gia = 0 | Filter gia vo dung | Gach Op Lat |

=> Designer PHAI thiet ke empty state cho moi section co the trong

---

## NAVIGATION STRUCTURE (Mega Menu)

TBVS (9, 4412 SP)        TB Bep (8, 570 SP)       Vat Lieu Nuoc (4, 185 SP)
- Bon Cau         957    - Voi Rua Chen    216     - May Nuoc Nong    73
- Chau Lavabo     827    - TB Bep Khac     123     - Loc Nuoc         73
- Sen Tam        1244    - Chau Rua Chen   114     - Bon Chua Nuoc    20
- Bon Tam         480    - Bep Dien Tu      41     - May Bom Nuoc     19
- Phu Kien        309    - May Hut Mui      23
- Voi Chau        269    - May Rua Chen     20     Gach Op Lat (5, 111 SP)
- Bon Tieu        212    - Bep Gas          17     - Gach Van Da Marble   26
- Voi Nuoc         97    - Lo Nuong         16     - Gach Van Da TN       23
- Nap Bon Cau      17                              - Gach Van Go          12
                                                   - Gach TK Xi Mang      26
San Go: CHUA CO DATA — an subcategory tabs         - Gach Trang Tri       24

---
Data tu PostgreSQL production 13/04/2026. Khong phong doan.
