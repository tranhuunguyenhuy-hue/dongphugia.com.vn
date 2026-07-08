# Phase B Audit - Catalog UX + Data

Updated: 2026-07-09

Scope: bon-cau, lavabo, sen-voi, gach-op-lat, thiet-bi-bep, vat-lieu-nuoc

## Bon cau

- Category: `thiet-bi-ve-sinh`
- Subcategories: `bon-cau`
- Status: `ready-for-backend-refactor`
- Note: Du du lieu nen de bat dau refactor helper listing/search/filter.

### Totals

- Total rows: 2872
- Public PDP: 2872
- Listing eligible: 2092
- Search visible: 2872
- Search-only gap: 780

### Taxonomy inventory

- Primary taxon coverage: yes=2092, no=780
- Product types (top): phu-kien-bon-cau=1470, bon-cau-1-khoi=678, bon-cau-2-khoi=503, bon-cau-treo-tuong=172, bon-cau-dat-san=38, bon-cau-xom=11
- Product sub-types (top): linh-kien-bon-cau=1084, nap-dien-tu=580, nap-dong-em=539, nap-rua-co=194, ket-nuoc=107, van-xa-bon-cau=91, (null)=89, bo-xa-bon-cau=88

### Visibility inventory

- listing_visibility: low_priority=1308, default=784, search_only=780
- search_visibility: visible=2872
- stock_status: in_stock=2453, discontinued=419
- seo states: index/true=2188, canonical_to_parent/false=684

### Attribute inventory

- Relation coverage: brand=2872 (100%), origin=0 (0%), color=697 (24.3%), material=0 (0%)
- Filter-ready spec candidates: Bảo hành (100% / 6 values); Loại thân cầu (48.2% / 10 values); Loại nắp (47.8% / 5 values); Kiểu thoát (45.4% / 3 values); Kiểu xả (45.2% / 6 values); Màu sắc (45.2% / 6 values); Hệ thống xả (45% / 4 values); Thiết kế (38.9% / 3 values)
- PDP-only spec candidates: Nơi sản xuất (100% / 66 values); Thương hiệu (100% / 14 values); Lượng nước xả (45.3% / 36 values); Kích thước (DxRxC) (45.2% / 449 values); Tâm xả (44.6% / 40 values); Thân cầu (38.6% / 333 values); Mẫu nắp (37.2% / 205 values); Công nghệ (35.7% / 144 values)
- Not-ready specs: Vành (18.7% / 1 values)
- Existing filter definitions: Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Khoảng giá[price]
- Top brands: TOTO=984, INAX=861, CAESAR=290, COTTO=224, American Standard=191, GROHE=135, Viglacera=85, ATMOR=49

### Use-case layer

- Modeled: no
- Note: Chua co field use-case/intent normalized trong DB hien tai. Can them o phase sau neu muon dung quick chips va merchandising theo nhu cau.

## Lavabo

- Category: `thiet-bi-ve-sinh`
- Subcategories: `lavabo`
- Status: `ready-for-backend-refactor`
- Note: Du du lieu nen de bat dau refactor helper listing/search/filter.

### Totals

- Total rows: 1464
- Public PDP: 1464
- Listing eligible: 1036
- Search visible: 1464
- Search-only gap: 428

### Taxonomy inventory

- Primary taxon coverage: yes=1000, no=464
- Product types (top): lavabo-dat-ban=556, tu-chau=349, lavabo-treo-tuong=220, lavabo-am-ban=127, lavabo-duong-vanh=69, chan-chau-lavabo=64, lavabo-ban-am=43, phu-kien-lavabo=36
- Product sub-types (top): (null)=1464

### Visibility inventory

- listing_visibility: default=1018, search_only=428, low_priority=18
- search_visibility: visible=1464
- stock_status: in_stock=1303, discontinued=161
- seo states: index/true=1147, canonical_to_parent/false=317

### Attribute inventory

- Relation coverage: brand=1464 (100%), origin=0 (0%), color=536 (36.6%), material=0 (0%)
- Filter-ready spec candidates: Bảo hành (99% / 8 values); Hình dáng (64.1% / 10 values); Lỗ bắt vòi (64.1% / 3 values); Lỗ xả tràn nước (64.1% / 2 values)
- PDP-only spec candidates: Nơi sản xuất (99% / 16 values); Thương hiệu (99% / 13 values); Chất liệu (91% / 13 values); Kích thước (DxRxC) (70.1% / 572 values); Màu sắc (67.9% / 20 values); Số lỗ bắt vòi (27.3% / 3 values); Đường kính lỗ bắt vòi (24.9% / 1 values); Vị trí lắp (22.9% / 2 values)
- Not-ready specs: Loại chậu rửa mặt (17.8% / 4 values); Bộ sưu tập (15.1% / 88 values); Công nghệ (13.6% / 9 values); Nguyên hộp (1.8% / 26 values)
- Existing filter definitions: Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Khoảng giá[price]
- Top brands: CAESAR=406, Kanly=278, COTTO=171, Viglacera=133, TOTO=114, INAX=89, American Standard=83, GROHE=69

### Use-case layer

- Modeled: no
- Note: Chua co field use-case/intent normalized trong DB hien tai. Can them o phase sau neu muon dung quick chips va merchandising theo nhu cau.

## Sen voi

- Category: `thiet-bi-ve-sinh`
- Subcategories: `sen-tam`, `voi-chau`
- Status: `ready-for-backend-refactor`
- Note: Du du lieu nen de bat dau refactor helper listing/search/filter.

### Totals

- Total rows: 7991
- Public PDP: 7991
- Listing eligible: 5734
- Search visible: 7991
- Search-only gap: 2257

### Taxonomy inventory

- Primary taxon coverage: yes=5730, no=2261
- Product types (top): phu-kien-sen-voi=2251, voi-nong-lanh=1455, cu-sen=1030, phu-kien-voi=729, bo-sen-cay=696, tay-sen=517, voi-gan-tuong=452, sen-am-tuong=385
- Product sub-types (top): (null)=4736, linh-kien-sen=995, bat-sen=638, sen-nhiet-do=448, sen-am-tuong=294, voi-cam-ung=226, van-dieu-chinh=216, gac-sen-cut-noi=127

### Visibility inventory

- listing_visibility: default=4343, search_only=2257, low_priority=1391
- search_visibility: visible=7991
- stock_status: in_stock=7377, discontinued=614
- seo states: index/true=5574, canonical_to_parent/false=2417

### Attribute inventory

- Relation coverage: brand=7991 (100%), origin=0 (0%), color=1259 (15.8%), material=0 (0%)
- Filter-ready spec candidates: Bảo hành (100% / 8 values); Chế độ (48.2% / 5 values); Chất liệu (44.4% / 11 values)
- PDP-only spec candidates: Nơi sản xuất (100% / 33 values); Thương hiệu (100% / 13 values); Lớp mạ (màu) (51.8% / 112 values); Điều khiển (33.2% / 9 values); Áp lực nước (32.7% / 39 values); Bộ sưu tập (28.5% / 182 values); Vị trí lắp vòi (27.8% / 3 values); Loại vòi (27.8% / 3 values)
- Not-ready specs: Kiểu dáng (16.7% / 5 values); Chế độ phun nước tay sen (13.1% / 5 values); Chế độ phun nước bát sen (10.5% / 5 values); Đường kính lỗ chờ (9.1% / 5 values)
- Existing filter definitions: Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Khoảng giá[price]
- Top brands: TOTO=2458, GROHE=2074, INAX=752, COTTO=735, CAESAR=412, American Standard=395, MOEN=339, Kanly=252

### Use-case layer

- Modeled: no
- Note: Chua co field use-case/intent normalized trong DB hien tai. Can them o phase sau neu muon dung quick chips va merchandising theo nhu cau.

## Gach op lat

- Category: `gach-op-lat`
- Subcategories: `gach-op-lat`, `gach-op-tuong`, `gach-inax-ecocarat`, `gach-trang-tri`, `gach-thiet-ke-xi-mang`, `gach-van-da-marble`, `gach-van-da-tu-nhien`, `gach-van-go`
- Status: `data-cleanup-first`
- Note: Can don data/mapping truoc khi sua UI listing de tranh filter vo nghia.

### Totals

- Total rows: 330
- Public PDP: 320
- Listing eligible: 320
- Search visible: 320
- Search-only gap: 0

### Taxonomy inventory

- Primary taxon coverage: no=165, yes=165
- Product types (top): (null)=330
- Product sub-types (top): (null)=330

### Visibility inventory

- listing_visibility: default=319, low_priority=1
- search_visibility: visible=320
- stock_status: in_stock=320
- seo states: index/true=320

### Attribute inventory

- Relation coverage: brand=330 (100%), origin=0 (0%), color=0 (0%), material=0 (0%)
- Filter-ready spec candidates: Nơi sản xuất (65.3% / 3 values); don_vi_tinh (37.8% / 2 values)
- PDP-only spec candidates: Bảo hành (65.3% / 1 values); Thương hiệu (65.3% / 1 values); bo_suu_tap (37.8% / 32 values); be_mat (34.7% / 3 values); do_chong_truot (34.7% / 3 values); gach_cat_canh (34.7% / 2 values); khu_vuc_op_lat (34.7% / 1 values); kich_thuoc_mo_phong (34.7% / 13 values)
- Not-ready specs: cong_nghe (10.6% / 6 values)
- Existing filter definitions: Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Khoảng giá[price], Khoảng giá[price], Khoảng giá[price], Khoảng giá[price], Khoảng giá[price]
- Top brands: INAX=209, KECH=18, BOOST NATURAL=11, BOOST BALANCE=9, MOTLEY=6, VARANA STONE=6, MIMESIS=5, ONYCE=5

### Use-case layer

- Modeled: no
- Note: Chua co field use-case/intent normalized trong DB hien tai. Can them o phase sau neu muon dung quick chips va merchandising theo nhu cau.

## Thiet bi bep

- Category: `thiet-bi-bep`
- Subcategories: `chau-rua-chen`, `voi-rua-chen`, `bep-dien-tu`, `bep-gas`, `may-hut-mui`, `may-rua-chen`, `lo-nuong`, `phu-kien-bep`, `phu-kien-chau-rua-chen`, `thiet-bi-bep-khac`
- Status: `ready-for-backend-refactor`
- Note: Du du lieu nen de bat dau refactor helper listing/search/filter.

### Totals

- Total rows: 790
- Public PDP: 790
- Listing eligible: 712
- Search visible: 790
- Search-only gap: 78

### Taxonomy inventory

- Primary taxon coverage: yes=712, no=78
- Product types (top): voi-rua-chen=349, (null)=247, phu-kien-voi-rua-chen=95, chau-rua-chen=60, tu-bep=39
- Product sub-types (top): (null)=790

### Visibility inventory

- listing_visibility: default=615, low_priority=97, search_only=78
- search_visibility: visible=790
- stock_status: in_stock=760, discontinued=30
- seo states: index/true=734, canonical_to_parent/false=56

### Attribute inventory

- Relation coverage: brand=790 (100%), origin=0 (0%), color=85 (10.8%), material=0 (0%)
- Filter-ready spec candidates: Bảo hành (91% / 8 values); Chất liệu (39.1% / 10 values); Loại vòi (35.7% / 3 values)
- PDP-only spec candidates: Nơi sản xuất (91% / 24 values); Thương hiệu (91% / 18 values); Chế độ (33.8% / 2 values); Vị trí lắp vòi (33.5% / 3 values); Chế độ xả nước đầu vòi (30.3% / 4 values); Chiều cao đầu vòi (26.6% / 102 values); Kích thước (DxRxC) (24.4% / 154 values); Kích thước đầu vòi (24.4% / 68 values)
- Not-ready specs: Tiện ích (15.6% / 14 values); Áp lực nước (11.1% / 14 values); Bộ sưu tập (10.3% / 45 values); Điều khiển (5.7% / 5 values); Nguồn điện (4.9% / 3 values); Chất liệu mặt bếp (4.7% / 8 values)
- Existing filter definitions: Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Khoảng giá[price], Khoảng giá[price]
- Top brands: GROHE=169, CAESAR=94, Kaff=84, INAX=82, MOEN=62, Kluger=54, COTTO=43, Elica=43

### Use-case layer

- Modeled: no
- Note: Chua co field use-case/intent normalized trong DB hien tai. Can them o phase sau neu muon dung quick chips va merchandising theo nhu cau.

## Vat lieu nuoc

- Category: `vat-lieu-nuoc`
- Subcategories: `loc-nuoc`, `may-nuoc-nong`, `bon-chua-nuoc`, `may-bom-nuoc`
- Status: `data-cleanup-first`
- Note: Can don data/mapping truoc khi sua UI listing de tranh filter vo nghia.

### Totals

- Total rows: 185
- Public PDP: 185
- Listing eligible: 185
- Search visible: 185
- Search-only gap: 0

### Taxonomy inventory

- Primary taxon coverage: yes=185
- Product types (top): (null)=173, may-nuoc-nong-truc-tiep=7, may-nuoc-nong-gian-tiep=5
- Product sub-types (top): (null)=185

### Visibility inventory

- listing_visibility: default=185
- search_visibility: visible=185
- stock_status: in_stock=185
- seo states: index/true=185

### Attribute inventory

- Relation coverage: brand=185 (100%), origin=0 (0%), color=0 (0%), material=0 (0%)
- Filter-ready spec candidates: none
- PDP-only spec candidates: capacity_liters (22.7% / 21 values)
- Not-ready specs: power_watts (17.3% / 9 values)
- Existing filter definitions: Khoảng giá[price], Thương hiệu[brand], Thương hiệu[brand], Thương hiệu[brand], Khoảng giá[price], Khoảng giá[price], Khoảng giá[price]
- Top brands: Ferroli=24, PANASONIC=24, Karofi=21, Mitsubishi Cleansui=21, Đại Thành=20, Ariston=17, Unilever Pureit=14, ATMOR=12

### Use-case layer

- Modeled: no
- Note: Chua co field use-case/intent normalized trong DB hien tai. Can them o phase sau neu muon dung quick chips va merchandising theo nhu cau.

