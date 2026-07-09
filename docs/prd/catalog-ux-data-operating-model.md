# Catalog UX + Data Operating Model

Status: Draft for execution
Owner: Codex + team
Updated: 2026-07-09

## 1. Muc tieu

Tai lieu nay chot mot nguon su that chung cho 4 viec:

1. San pham nao hien o dau
2. Listing/search/PDP van hanh theo logic nao
3. Filter nao hop le cho tung nhom san pham
4. Thu tu trien khai backend -> data -> UI -> SEO QA

Muc tieu cuoi cung:

- UI listing gon hon, de duyet hon
- Search tim ra dung san pham sau
- PDP giu du du lieu va URL on dinh
- SEO khong bi rach giua canonical, sitemap, listing va search

## 2. Nguyen tac tong

### 2.1 Khong lam UI truoc data

Thu tu dung:

1. Chot operating model
2. Dinh nghia data model
3. Lam query/read model
4. Moi doi listing UI
5. Cuoi cung moi QA SEO + runtime

Khong di nguoc lai, vi neu lam UI truoc thi se phai sua lai nhieu lan.

### 2.2 Taxonomy khong chi de route URL

Taxonomy con quyet dinh:

- leaf nao co filter nao
- leaf nao co use case nao
- san pham nao duoc list
- thu tu hien thi
- logic canonical URL

### 2.3 Listing va search la hai lane khac nhau

- Listing = lane browse, can sach, co thu tu, khong roi
- Search = lane truy cap sau, cho phep tim SKU va cac san pham khong can dung o listing

## 3. 4 lop data can co cho moi product

### 3.1 Lop 1 - Taxonomy dieu huong

Bat buoc:

- category
- subcategory
- product_type

Co the co them neu can:

- product_sub_type
- primary taxonomy leaf

Vai tro:

- tao URL
- xac dinh context cua listing
- xac dinh bo filter chinh

### 3.2 Lop 2 - Attributes ky thuat

Day la nhom du lieu de "hieu san pham" va "loc san pham".

Vi du:

- brand
- loai nap
- kieu xa
- luong nuoc xa
- mau
- tam xa
- kieu thoat
- kich thuoc
- chat lieu

Luu y:

- khong co mot bo attribute chung cho toan bo catalog
- moi taxonomy leaf co attribute profile rieng

### 3.3 Lop 3 - Use case / intent

Day la lop du lieu phuc vu UX va nhu cau mua hang, khong phai thong so ky thuat.

Vi du:

- phong-tam-cao-cap
- tiet-kiem-nuoc
- co-nap-rua
- nha-bep-hien-dai
- gach-chong-tron

Vai tro:

- quick chips
- landing theo nhu cau
- merchandising

### 3.4 Lop 4 - Visibility + commerce

Day la lop quyet dinh san pham xuat hien o dau va trong trang thai nao.

Field hien co / can tiep tuc su dung:

- publication_status
- pdp_visibility
- listing_visibility
- search_visibility
- sale_status
- price_state
- seo_indexing
- sitemap_include

## 4. Visibility matrix

### 4.1 default

Hien o:

- listing
- search
- PDP
- sitemap/index neu SEO hop le

Dung cho:

- san pham chinh
- san pham chien luoc
- row dai dien cho mot nhom mua hang ro rang

### 4.2 low_priority

Hien o:

- listing, nhung o duoi
- search
- PDP

Dung cho:

- san pham hop le nhung khong uu tien
- model dai duoi
- row can cong khai nhung khong nen chen vao top listing

### 4.3 search_only

Hien o:

- search
- PDP
- co the hien trong related products neu lien quan manh

Khong hien o:

- listing category/subcategory

Dung cho:

- bien the phu
- SKU sau
- combo phu
- row khong phu hop browse discovery

### 4.4 hidden

Khong hien o:

- listing
- search
- sitemap

PDP:

- giu hay khong tuy business rule

### 4.5 discontinued

Nen:

- giu PDP
- co badge trang thai
- khong noi o listing chinh

SEO:

- can giu can nhac theo gia tri traffic cu

## 5. Pattern UX can dung

### 5.1 Listing

Listing chia thanh 3 tang:

1. Featured / strategic zone
2. Main results zone (`default`)
3. Expanded choices zone (`low_priority`)

`search_only` khong vao listing.

### 5.2 Search

Search la lane rieng:

- duoc dung `search_visibility`
- co the tra ra `search_only`
- khong dung logic cua sitemap/index de quyet dinh search

### 5.3 PDP

PDP la noi giu coverage rong nhat:

- related products uu tien `default`
- `low_priority` hien sau
- `search_only` chi hien neu co quan he manh

## 6. Attribute profile theo nhom dai dien

Khong can define tat ca leaf ngay lap tuc. Bat dau tu 4 nhom dai dien.

### 6.1 Bon cau

Core attributes:

- brand
- loai nap
- kieu xa
- luong nuoc xa
- tam xa
- kieu thoat
- mau
- khoang gia

Use cases:

- phong-tam-cao-cap
- tiet-kiem-nuoc
- co-nap-rua
- de-ve-sinh

### 6.2 Lavabo

Core attributes:

- brand
- kieu lap
- kich thuoc
- mau
- chat lieu
- co lo voi / khong lo voi

Use cases:

- phong-tam-toi-gian
- khong-gian-nho
- phong-tam-cao-cap

### 6.3 Sen voi

Core attributes:

- brand
- kieu lap
- nong-lanh / lanh
- mau hoan thien
- chat lieu
- co nhiet do / khong

Use cases:

- tam-thu-gian
- phong-tam-khach-san
- mau-den-cao-cap

### 6.4 Gach op lat

Core attributes:

- brand
- kich thuoc
- be mat
- tong mau
- khong gian su dung
- chat lieu / dong gach

Use cases:

- phong-khach-sang
- nha-tam-chong-tron
- ho-boi-ngoai-troi

## 7. Rule van hanh cho listing/filter

### 7.1 Moi leaf co bo filter rieng

Khong co "mot sidebar filter dung cho toan site".

Moi leaf can co:

- core filters
- optional filters
- PDP-only attributes
- use case chips neu co

### 7.2 Filter count phai dua tren tap san pham duoc list

Counts cua filter phai tinh tren tap:

- publication_status = public
- pdp_visibility = public
- listing_visibility in (`default`, `low_priority`)

Khong nen de search-only lam ban filter count cua listing.

### 7.3 Search phai dua tren tap san pham duoc search

Search phai tinh tren tap:

- publication_status = public
- pdp_visibility = public
- search_visibility = visible

Khong duoc dung gate cua sitemap/index de thay cho search.

## 8. SEO rule can giu dong bo

### 8.1 Canonical

- Moi PDP phai co canonical URL ro rang
- Search page khong tro canonical ve homepage mot cach mo ho

### 8.2 Sitemap

Sitemap chi lay cac PDP:

- public
- indexable
- duoc phep vao sitemap

Sitemap khong thay mat listing, va listing khong thay mat search.

### 8.3 URL cu

- URL cu phai redirect 301 ve URL chuan
- Tuyet doi tranh de URL cu chet neu do la URL san pham that

## 9. Thu tu trien khai de xuat

### Phase A - Operating model + spec

Output:

- tai lieu nay
- chot 4 nhom dai dien
- chot visibility matrix

### Phase B - Data audit + mapping

Viec can lam:

- audit data hien co theo 4 nhom dai dien
- xac dinh field nao da du, field nao thieu
- xac dinh leaf nao co the chay theo model moi ngay

Output:

- bang mapping taxonomy -> attributes -> use cases
- danh sach data gaps

### Phase C - Backend/read model

Viec can lam:

- helper cho listing visibility
- helper cho search visibility
- read model cho leaf filters
- count logic dung theo lane listing/search

Output:

- query model on dinh
- khong doi UI lon

### Phase D - UI integration

Viec can lam:

- listing sidebar/filter theo leaf
- product cards uu tien canonical URL
- zone featured/default/low_priority

Output:

- listing UX sach hon

### Phase E - SEO + runtime QA

Viec can lam:

- canonical
- sitemap
- redirects
- search vs listing behavior
- PDP related products

## 10. Definition of done

Mot nhom san pham duoc xem la "done" khi:

1. Listing khong bi roi boi bien the phu
2. Search tim ra SKU sau can thiet
3. Filter dung va co y nghia voi leaf do
4. PDP giu canonical va related products hop ly
5. Sitemap/index khong xung dot voi listing/search

## 11. Viec se lam tiep ngay sau blueprint nay

Sau tai lieu nay, thu tu thuc thi de xuat la:

1. Chot 4 nhom dai dien:
   - bon-cau
   - lavabo
   - sen-voi
   - gach-op-lat
2. Tao bang inventory data cho tung nhom:
   - taxonomy
   - attributes
   - use cases
   - visibility
3. Audit listing/search/filter helpers dang con dung `is_active` o sai lane
4. Refactor backend helper truoc
5. Moi tinh den UI listing refinement

## 12. Ngoai pham vi hien tai

Chua lam ngay trong phase nay:

- redesign visual day du cho moi category
- mo rong toan bo use case taxonomy cho tat ca brand
- thay doi sau vao crawler/import
- rewrite toan bo admin CMS

Muc tieu hien tai la tao mot nen van hanh ro rang de tu day moi thay doi deu di cung huong.
