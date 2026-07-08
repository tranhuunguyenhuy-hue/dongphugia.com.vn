# Phase B Audit Checklist - Catalog UX + Data

Status: Ready to execute
Scope: Read-only audit before backend refactor

## 1. Muc tieu phase nay

Truoc khi sua backend/UI, can tra loi duoc 4 cau hoi cho moi nhom dai dien:

1. Taxonomy hien tai da du de dieu huong chua?
2. Attributes hien tai da du de loc chua?
3. Visibility hien tai co dang mau thuan giua listing/search/PDP khong?
4. Data gaps nam o DB, query helper, hay import pipeline?

## 2. Nhom uu tien audit

Thu tu:

1. bon-cau
2. lavabo
3. sen-voi
4. gach-op-lat

## 3. Output bat buoc cho moi nhom

Moi nhom phai co 1 bang inventory voi 4 phan:

### A. Taxonomy inventory

- category
- subcategory
- product_type
- product_sub_type (neu co)
- primary taxonomy leaf (neu co)
- so san pham public
- so san pham listing
- so san pham search_only

### B. Attribute inventory

Bat buoc thong ke:

- field nao da co o DB
- field nao da co o specs nhung chua normalize
- field nao chua co
- field nao coverage thap
- field nao khong on dinh giua cac brand

Ket qua can chia 3 nhom:

- filter-ready
- PDP-only
- chua du dieu kien

### C. Visibility inventory

Thong ke theo:

- publication_status
- pdp_visibility
- listing_visibility
- search_visibility
- seo_indexing
- sitemap_include
- is_active

Muc tieu:

- tim cac mau thuan lane
- tim nhom san pham dang bi list sai
- tim nhom san pham dang search miss

### D. UX impact inventory

Can chot:

- filter nao nen hien
- filter nao nen an
- chips nhu cau nao hop ly
- san pham nao nen la `default`
- san pham nao nen la `low_priority`
- san pham nao nen la `search_only`

## 4. Mau bang audit toi thieu

```txt
Group: bon-cau

Taxonomy
- category:
- subcategory:
- product_type set:
- product_sub_type set:
- taxonomy leaf coverage:

Attributes
- filter-ready:
- PDP-only:
- missing:
- unstable:

Visibility
- default count:
- low_priority count:
- search_only count:
- hidden count:
- discontinued count:
- listing/search mismatch:

UX decision
- quick chips:
- primary filters:
- secondary filters:
- listing rule:
- search rule:
```

## 5. Rule de danh gia data gap

### 5.1 Filter-ready

Chi duoc xem la filter-ready neu:

- y nghia ro voi nguoi dung
- coverage dat muc chap nhan
- gia tri khong qua phan manh
- co the dung on dinh tren nhieu brand trong cung nhom

### 5.2 PDP-only

Day la field nen hien trong thong so, nhung chua nen dua len filter vi:

- qua ky thuat
- coverage thap
- gia tri khong dong nhat
- khong giup ra quyet dinh som

### 5.3 Chua du dieu kien

Neu field:

- chi nam trong raw specs
- mapping chua on
- ten goi chua thong nhat
- import chua normalize duoc

thi danh dau la chua du dieu kien

## 6. Cac dau hieu can dung lai truoc khi sua UI

Neu xuat hien mot trong cac dau hieu sau, chua sua UI:

- cung mot nhom ma brand A va brand B dung ten field khac nghia
- filter count khong on dinh
- search lane va listing lane mau thuan nang
- query helper van dua qua nhieu vao `is_active`
- category leaf chua map xong sang taxonomy operating model

## 7. Quy tac ket luan cho moi nhom

Moi nhom phai ket luan 1 trong 3 trang thai:

### Ready for backend refactor

Khi:

- taxonomy du ro
- filter-ready fields da du
- visibility conflict da hieu nguyen nhan

### Data cleanup first

Khi:

- specs/raw import con qua ban
- field chua normalize du
- coverage attributes qua thap

### Policy decision first

Khi:

- van con mo ho ve `default / low_priority / search_only`
- team chua chot duoc nhu cau kinh doanh

## 8. Viec tiep theo sau phase nay

Khi 4 nhom dai dien co audit xong:

1. Tao backend helper checklist
2. Chot listing/read model moi
3. Chot filter payload shape cho UI
4. Moi bat dau sua listing runtime
