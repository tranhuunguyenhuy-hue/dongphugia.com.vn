# Báo cáo Gap Analysis: HITA vs Đông Phú Gia
**Ngày:** 04/06/2026 | **Tác giả:** Tech Lead (Claude Cowork)  
**Phạm vi:** Category structure, filter system, data completeness, product coverage

---

## Executive Summary

ĐPG hiện có **~4,953 sản phẩm active** trên 4 danh mục chính. So với HITA, hệ thống còn tồn tại **3 nhóm vấn đề lớn**:

1. **Critical data bug**: 1,027 sản phẩm INAX không có subcategory → **invisible** trên mọi trang listing
2. **Specs trống**: 3 brand lớn (MOEN ~600sp, ATMOR ~430sp, Viglacera ~360sp) = **0% specs** → filter không hoạt động
3. **Cấu trúc thiếu**: Gạch Ốp Lát, Vật liệu nước chưa có attribute filters; Bồn Cầu chưa có phân loại theo hình thức

Nếu fix hết Priority 1+2, ĐPG sẽ **vượt HITA về filter quality** do URL structure tốt hơn và data phong phú hơn sau crawl.

---

## Phần 1: So sánh tổng quan danh mục

### 1.1 Scale so sánh

| Dimension | HITA | ĐPG hiện tại | Gap |
|-----------|------|--------------|-----|
| Nhóm danh mục chính | 6 nhóm | 4 nhóm | ĐPG thiếu Đèn + Điện |
| Danh mục cấp 1 | 35+ | 22 | ĐPG thiếu 13 danh mục |
| Subcategories cấp 2 | 120+ | 22 | HITA chi tiết hơn nhiều |
| Sản phẩm active (ước tính) | ~15,000+ | 4,953 | ĐPG bé hơn |
| Filter dimensions/subcategory | 3–6 | 0–3 | ĐPG thưa hơn |

### 1.2 Danh mục ĐPG có — HITA cũng có

| Danh mục ĐPG | Tương đương HITA | Nhận xét |
|---|---|---|
| Bồn Cầu (788 sp) | Bồn Cầu, Nắp Bồn Cầu | ĐPG gộp; HITA tách riêng nắp, phụ kiện |
| Chậu Lavabo (441 sp) | Lavabo | Tương đương |
| Sen Tắm (1,360 sp) | Sen Tắm, Bồn Tắm | ĐPG tách bồn tắm riêng |
| Bồn Tắm (281 sp) | → trong Sen Tắm/Bồn Tắm | OK |
| Vòi Chậu (713 sp) | Vòi Lavabo | Tương đương |
| Phụ Kiện Phòng Tắm (558 sp) | Phụ Kiện Nhà Tắm, Tủ Kệ | ĐPG gộp |
| Bồn Tiểu (111 sp) | Bồn Tiểu, Khu Công Cộng | Tương đương |
| Nắp Bồn Cầu (53 sp) | → tách riêng trong Nắp BC | Tương đương |
| Thiết bị bếp (184 sp) | Thiết Bị Bếp, Điện Gia Dụng | ĐPG nhỏ hơn nhiều |
| Vật liệu nước (173 sp) | Thiết Bị Lọc Nước, Bồn Nước | Tương đương |
| Gạch Ốp Lát (111 sp) | Gạch, Chăm Sóc Nhà Cửa | ĐPG nhỏ hơn |

### 1.3 Danh mục HITA có — ĐPG KHÔNG có

| HITA Category | Lý do ĐPG không có | Khuyến nghị |
|---|---|---|
| Đèn LED, Đèn Trang Trí | Ngoài ngành nghề cốt lõi ĐPG | Không cần thêm — Phase 3+ |
| Công Tắc Ổ Cắm, Tủ Điện | Ngoài ngành nghề cốt lõi | Không cần thêm |
| Cầu Dao Điện, Dây Cáp | Ngoài ngành nghề cốt lõi | Không cần thêm |
| Tủ Chậu/Cabinet riêng | ĐPG gộp vào Phụ Kiện | Tách thành subcategory riêng — Medium priority |

---

## Phần 2: Phân tích dữ liệu sản phẩm hiện tại

### 2.1 Tổng quan product inventory

| Category | Subcategory | Tổng SP | Brands | Không có specs | % Specs OK |
|---|---|---|---|---|---|
| Thiết bị vệ sinh | **⚠️ NO SUBCATEGORY** | **1,057** | 4 | 30 | 97% specs có, nhưng invisible! |
| Thiết bị vệ sinh | Sen Tắm | 1,360 | 7 | 351 | 74% |
| Thiết bị vệ sinh | Bồn Cầu | 788 | 7 | 129 | 84% |
| Thiết bị vệ sinh | Vòi Chậu | 713 | 7 | 202 | 72% |
| Thiết bị vệ sinh | Phụ Kiện PT | 558 | 7 | 469 | **16%** |
| Thiết bị vệ sinh | Chậu Lavabo | 441 | 7 | 204 | 54% |
| Thiết bị vệ sinh | Bồn Tắm | 281 | 10 | 40 | 86% |
| Thiết bị vệ sinh | Bồn Tiểu | 111 | 5 | 50 | 55% |
| Thiết bị vệ sinh | Phụ Kiện Bồn Cầu | 87 | 6 | 20 | 77% |
| Thiết bị vệ sinh | Nắp Bồn Cầu | 53 | 3 | 2 | 96% |
| Thiết bị vệ sinh | Thân Bồn Cầu | 23 | 2 | 0 | 100% |
| Thiết bị bếp | Bếp Điện Từ | 41 | 4 | 4 | 90% |
| Thiết bị bếp | Vòi Rửa Chén | 35 | 3 | 2 | 94% |
| Thiết bị bếp | Chậu Rửa Chén | 28 | 1 | 14 | 50% |
| Thiết bị bếp | Thiết Bị Bếp Khác | 27 | 3 | 0 | 100% |
| Thiết bị bếp | Máy Hút Mùi | 23 | 2 | 0 | 100% |
| Thiết bị bếp | Máy Rửa Chén | 20 | 2 | 0 | 100% |
| Thiết bị bếp | Bếp Gas | 17 | 2 | 0 | 100% |
| Thiết bị bếp | Lò Nướng | 16 | 3 | 0 | 100% |
| Vật liệu nước | Lọc Nước | 73 | 5 | 0 | 100% |
| Vật liệu nước | Máy Nước Nóng | 61 | 5 | 0 | 100% |
| Vật liệu nước | Bồn Chứa Nước | 20 | 1 | 0 | 100% |
| Vật liệu nước | Máy Bơm Nước | 19 | 2 | 0 | 100% |
| Gạch Ốp Lát | Gạch Vân Đá Marble | 26 | 8 | 0 | 100%* |
| Gạch Ốp Lát | Gạch Thiết Kế Xi Măng | 26 | 5 | 0 | 100%* |
| Gạch Ốp Lát | Gạch Trang Trí | 24 | 8 | 0 | 100%* |
| Gạch Ốp Lát | Gạch Vân Đá Tự Nhiên | 23 | 6 | 0 | 100%* |
| Gạch Ốp Lát | Gạch Vân Gỗ | 12 | 5 | 0 | 100%* |

> *Gạch có specs nhưng **chưa có filter_definitions** → filter không hiển thị dù data có

### 2.2 🚨 Critical Bug: INAX không có subcategory

**1,027 sản phẩm INAX** thuộc Thiết bị vệ sinh nhưng `subcategory_id = NULL`.

- **Impact**: Toàn bộ INAX không xuất hiện trên trang listing Bồn Cầu, Lavabo, Sen Tắm, etc.
- **Root cause**: Crawl pipeline không assign subcategory_id khi import INAX
- **Fix**: Classify 1,027 INAX products vào đúng subcategory dựa trên product_type/tên sản phẩm
- **Effort**: 2–3 ngày (script classification bán tự động + manual review)

---

## Phần 3: Phân tích filter system

### 3.1 Filter coverage so sánh chi tiết

| Subcategory ĐPG | Filter | Coverage ĐPG | HITA có không | Gap |
|---|---|---|---|---|
| **Bồn Cầu** | Thương hiệu | 100% | ✅ | OK |
| | Khoảng giá | 89.8% | ✅ | OK |
| | Kiểu xả | 79.2% | ✅ | Cần crawl MOEN/ATMOR/Viglacera |
| | Kiểu thoát | 79.2% | ✅ | Cần crawl |
| | Loại nắp | 83.6% | ✅ | Cần crawl |
| | Lượng nước xả | 78.9% | ✅ | Cần crawl |
| | Loại thân cầu | 83.6% | ✅ | Cần crawl |
| | Màu sắc | 79.2% | ✅ | Cần crawl |
| | **Loại bồn cầu (1/2 khối, treo)** | **0% (chưa có)** | ✅ HITA có | **Thiếu dimension quan trọng** |
| **Chậu Lavabo** | Thương hiệu | 100% | ✅ | OK |
| | Khoảng giá | 92.5% | ✅ | OK |
| | Loại chậu | **4.1%** | ✅ HITA có | **Cực thiếu — cần enrichment** |
| | Hình dáng | 39.5% | ✅ HITA có | Cần enrichment |
| | Chất liệu | 40.4% | ✅ HITA có | Cần enrichment |
| | Xả tràn | 39.5% | Không rõ | Cần xem xét |
| | **Loại lắp (đặt bàn/treo/âm bàn)** | **0% (chưa có)** | ✅ HITA có | **Thiếu dimension quan trọng** |
| **Sen Tắm** | Thương hiệu | 100% | ✅ | OK |
| | Khoảng giá | 93.2% | ✅ | OK |
| | Chế độ nhiệt | 34.9% | ✅ HITA có | Cần crawl 351 sp thiếu |
| | Kiểu dáng | **17.7%** | ✅ HITA có | **Cần crawl** |
| | Chất liệu | 29.2% | ✅ HITA có | Cần crawl |
| | Thiết kế | **4.0%** | ✅ HITA có | **Cực thiếu** |
| **Bồn Tắm** | Thương hiệu | 100% | ✅ | OK |
| | Khoảng giá | 98.9% | ✅ | OK |
| | Chất liệu | 72.2% | ✅ | Khá OK |
| | Tính năng | 68.7% | ✅ | Khá OK |
| | Chiều dài | 68.7% | ✅ | Cần crawl |
| | Màu sắc | 68.7% | ✅ | Cần crawl |
| **Phụ Kiện PT** | Thương hiệu | 100% | ✅ | OK |
| | Khoảng giá | 98.4% | ✅ | OK |
| | Kiểu dáng | **1.1%** | ✅ HITA có | **Cực thiếu — 469sp không có specs** |
| **Vòi Chậu** | Thương hiệu | 100% | ✅ | OK |
| | Khoảng giá | 86.5% | ✅ | OK |
| | **Chế độ nước** | **0% (không có filter_def)** | ✅ HITA có | **Thiếu filter_definitions** |
| | **Kiểu điều khiển** | **0% (không có filter_def)** | ✅ HITA có | **Thiếu filter_definitions** |
| | **Chất liệu** | **0% (không có filter_def)** | ✅ HITA có | **Thiếu filter_definitions** |
| **Bồn Tiểu** | Thương hiệu | 100% | ✅ | OK |
| | Kiểu thoát | **18.9%** | ✅ | Cần crawl 50sp thiếu |
| | Vị trí lắp | **18.9%** | ✅ | Cần crawl |
| | Lượng nước xả | **19.8%** | ✅ | Cần crawl |
| **Nắp Bồn Cầu** | Thương hiệu | 100% | ✅ | OK |
| | Chất liệu | 71.7% | ✅ | Khá OK |
| | Chế độ rửa | **9.4%** | ✅ | Cần crawl |
| **Gạch Ốp Lát** | **Tất cả filters** | **0% (không có filter_def)** | ✅ HITA có đủ | **Chưa setup gì cả** |
| **Vật liệu nước** | Chỉ brand + giá | 100% | Brand/giá OK | Thiếu attribute filters |
| | **Kiểu gia nhiệt** | **0%** | ✅ HITA có | Cần filter_def + data |
| | **Công nghệ lọc** | **0%** | ✅ HITA có | Cần filter_def + data |

---

## Phần 4: Brand coverage analysis

### 4.1 Brands với specs = 0%

| Brand | Tổng SP | Subcategories bị ảnh hưởng | Impact lên filter |
|---|---|---|---|
| **MOEN** | ~600 sp | Phụ Kiện (184), Sen (243), Vòi (87), Lavabo (23), BồnTắm (32), BồnCầu (11), BồnTiểu (7), Nắp (2) | Không xuất hiện trong các filter attribute |
| **ATMOR** | ~430 sp | Phụ Kiện (229), Sen (82), Vòi (68), Lavabo (53), BồnCầu (44), BồnTiểu (17), BồnTắm (5) | Không xuất hiện trong các filter attribute |
| **Viglacera** | ~360 sp | Lavabo (124), BồnCầu (74), PhụKiện (56), Vòi (49), Sen (32), BồnTiểu (26), BồnTắm (3) | Không xuất hiện trong các filter attribute |
| **INAX** | ~1,027 sp (no subcat) | Toàn bộ | **INVISIBLE trên website** |

> Tổng: ~2,417 sản phẩm bị ảnh hưởng = **49% tổng inventory**

### 4.2 Nguồn crawl đề xuất cho từng brand

| Brand | Nguồn data đề xuất | Khó khăn | Ưu tiên |
|---|---|---|---|
| MOEN | moen.com.vn hoặc hita.com.vn (đã có data) | MOEN có thể cần đăng nhập | 🔴 P1 |
| ATMOR | atmor-vn.com hoặc nhà phân phối | ATMOR có ít tài liệu online | 🔴 P1 |
| Viglacera | viglacera.com.vn | Có website đầy đủ | 🔴 P1 |
| INAX | inax.com.vn | Dễ crawl, data tốt | 🔴 P1 (subcategory assignment) |

---

## Phần 5: Subcategory structure so sánh

### 5.1 Phân loại sản phẩm — ĐPG vs HITA

**Bồn Cầu:**

| HITA (subcategory riêng) | ĐPG hiện tại | Cách xử lý |
|---|---|---|
| Bồn cầu 1 khối | Filter "Loại thân cầu" (83.6%) | Cần chuẩn hóa giá trị → dùng làm filter |
| Bồn cầu 2 khối | Tương tự | |
| Bồn cầu treo tường | Chưa có | Cần thêm vào specs |
| Bồn cầu đặt sàn | Chưa có | Cần thêm |
| Bồn cầu xổm | Không có sản phẩm | Skip |
| Bồn cầu thông minh | Chưa có filter | Cần định nghĩa |
| Dưới 1 triệu | Price filter | Đã có price filter |

**Lavabo:**

| HITA | ĐPG | Cách xử lý |
|---|---|---|
| Đặt bàn / Treo tường / Âm bàn / Dương vành / Bán âm | "Loại chậu" (4.1%!) | Cần crawl 96% còn lại |
| Bằng sứ / Bằng đồng / Bằng đá | "Chất liệu" (40.4%) | Cần crawl 60% còn lại |
| TOTO / INAX / CAESAR riêng | Brand filter | Đã có |

**Vòi Lavabo (ĐPG: Vòi Chậu):**

| HITA | ĐPG | Cách xử lý |
|---|---|---|
| Lạnh / Nóng lạnh | Chưa có filter_def | Thêm filter_def + crawl |
| Cơ / Cảm ứng / Tự động | Chưa có filter_def | Thêm filter_def + crawl |

---

## Phần 6: Action Plan ưu tiên

### 🔴 Priority 1 — CRITICAL (Phase 0 · Tuần này)

| # | Action | Tác động | Effort | Assignee |
|---|---|---|---|---|
| P1.1 | **Assign subcategory_id cho 1,027 INAX products** | Toàn bộ INAX visible trên website | 3 ngày | Antigravity |
| P1.2 | **Crawl specs MOEN** (600+ sp) | Filter hoạt động cho MOEN products | 4 ngày | Antigravity |
| P1.3 | **Crawl specs ATMOR** (430+ sp) | Filter hoạt động cho ATMOR products | 3 ngày | Antigravity |
| P1.4 | **Crawl specs Viglacera** (360+ sp) | Filter hoạt động cho Viglacera products | 3 ngày | Antigravity |

**Tổng P1: ~13 ngày · Fix 2,417 sản phẩm bị ảnh hưởng**

### 🟡 Priority 2 — HIGH (Phase 0 · Tuần này, song song với crawl)

| # | Action | Tác động | Effort |
|---|---|---|---|
| P2.1 | **Thêm filter_definitions cho Gạch Ốp Lát** (kích thước, bề mặt, chất liệu, màu) | Enable filter cho 111sp gạch | 0.5 ngày |
| P2.2 | **Thêm filter_definitions cho Vòi Chậu** (chế độ nước, kiểu điều khiển, chất liệu) | 3 filter dimensions mới cho 713sp | 0.5 ngày |
| P2.3 | **Thêm filter_definitions cho Vật liệu nước** (kiểu gia nhiệt, công nghệ lọc, dung tích) | Attribute filters cho 173sp | 0.5 ngày |
| P2.4 | **Crawl/enrich Chậu Lavabo specs** (Loại chậu 4.1%, Hình dáng 39.5%) | Coverage từ ~44% lên ~90% | 3 ngày |
| P2.5 | **Crawl/enrich Phụ Kiện PT specs** (469 sp thiếu specs) | Coverage từ 16% lên ~70% | 3 ngày |
| P2.6 | **Chuẩn hóa "Loại thân cầu" → "Loại bồn cầu"** trong specs và filter_definitions | Thêm dimension quan trọng cho Bồn Cầu | 1 ngày |

**Tổng P2: ~8.5 ngày**

### 🟢 Priority 3 — MEDIUM (Phase 1–2 · Sau design handoff)

| # | Action | Tác động | Effort |
|---|---|---|---|
| P3.1 | Thêm "Loại lắp đặt" cho Lavabo (đặt bàn/treo/âm bàn) | Dimension mới HITA có | 2 ngày crawl |
| P3.2 | Crawl Vòi Chậu specs (chế độ nước, kiểu điều khiển) | Fill 3 filter dimensions mới | 2 ngày |
| P3.3 | Enrich Sen Tắm (Kiểu dáng 17.7%, Thiết kế 4%) | Coverage từ ~36% lên ~70% | 3 ngày |
| P3.4 | Enrich Bồn Tiểu (Kiểu thoát 18.9%, Vị trí 18.9%) | Coverage từ ~26% lên ~80% | 1 ngày |
| P3.5 | Tách "Tủ Chậu/Cabinet" thành subcategory riêng | Align với HITA | 1 ngày |
| P3.6 | Crawl Gạch specs (kích thước, bề mặt, chất liệu) | Enable filters vừa định nghĩa | 2 ngày |

**Tổng P3: ~11 ngày**

### ⚪ Priority 4 — LOW/FUTURE

| # | Action | Lý do defer |
|---|---|---|
| P4.1 | Thêm Đèn LED category | Ngoài ngành nghề cốt lõi |
| P4.2 | Thêm Công tắc/Điện | Ngoài ngành nghề cốt lõi |
| P4.3 | "Smart toilet" classification | Cần data enrichment phức tạp |
| P4.4 | Price-range subcategories ("Dưới 1 triệu") | Frontend logic đơn giản, không cần DB |

---

## Phần 7: UX features cần xây dựng trên new site

Đây là frontend tasks cho Phase 2–3, không phụ thuộc vào data crawl:

| Feature | HITA có | ĐPG mới | Priority |
|---|---|---|---|
| Spec tags trên Product Card | ✅ | Cần build | 🔴 High |
| Feature shortcuts trên Category page | ✅ | Cần build | 🔴 High |
| Brand logo showcase trên Category page | ✅ | Cần build | 🔴 High |
| Horizontal filter bar (mobile-first) | ✅ | Cần build | 🔴 High |
| Discount % badge trên Product Card | ✅ | Cần build | 🟡 Medium |
| Related categories horizontal tab | ✅ | Cần build | 🟡 Medium |
| Sort by "Xem Nhiều" + "Khuyến Mãi" | ✅ | Cần build | 🟡 Medium |
| Dual CTA: "Thêm giỏ" + "Mua ngay" | ✅ | Cần build | 🟡 Medium |
| Compare feature | ✅ | Phase 2 | 🟢 Low |
| Video trong product card | ✅ | Phase 2 | 🟢 Low |

---

## Phần 8: Lợi thế ĐPG so với HITA (cần giữ và phát huy)

| Dimension | ĐPG | HITA | Lợi thế |
|---|---|---|---|
| URL structure | `/thiet-bi-ve-sinh/bon-cau/toto-cs301` | `/bon-cau-toto-178-12345.html` | ĐPG — hierarchical, SEO-friendly |
| Subcategory architecture | Thuần loại sản phẩm | Mix type + brand + material | ĐPG — clean, dễ maintain |
| Mobile-first | Thiết kế mới | Desktop-first | ĐPG — bắt đầu đúng |
| Breadcrumb depth | 4 levels (cat/subcat/product) | 3 levels | ĐPG — đầy đủ hơn cho SEO |
| JSON-LD Schema | ✅ Đầy đủ | Không rõ | ĐPG — tốt hơn |
| Dynamic Sitemap | ✅ 2000sp/file | Không rõ | ĐPG — tốt hơn |

---

## Phần 9: Timeline thực thi

```
Tuần 1 (01–07/06): Phase 0 — Backend Lock-down
├── P1.1: Assign subcategory INAX (3 ngày)
├── P2.1-P2.3: Thêm filter_definitions (1.5 ngày)
└── P2.6: Chuẩn hóa Loại bồn cầu (1 ngày)

Tuần 1–2 (01–14/06): Crawl song song
├── P1.2: Crawl MOEN specs
├── P1.3: Crawl ATMOR specs
└── P1.4: Crawl Viglacera specs

Tuần 2–3 (08–21/06): Phase 1–2 — Data enrichment song song với frontend
├── P2.4: Enrich Chậu Lavabo
├── P2.5: Enrich Phụ Kiện PT
├── P3.1-P3.4: Remaining enrichments
└── Frontend: Build UX features trên new site

Tuần 4+ (22/06+): QA, integration testing
```

---

## Phần 10: Kết luận

### Kết quả kỳ vọng sau khi hoàn thành P1+P2:

- **4,953 → 5,980+ sản phẩm visible** (fix INAX no-subcat)
- **Filter coverage avg**: từ ~52% lên ~85%+ cho Thiết bị vệ sinh
- **Gạch Ốp Lát**: từ 0% filter lên full filter capability (111 sp)
- **Vật liệu nước**: từ brand-only lên 5+ filter dimensions
- **Vòi Chậu**: từ 0 attribute filter lên 3 filter dimensions (713 sp hưởng lợi)

### ĐPG vs HITA sau khi fix:

| Metric | Hiện tại | Sau fix | HITA |
|---|---|---|---|
| Sản phẩm có đủ filter data | ~2,200 (44%) | ~4,500 (90%) | N/A |
| Subcategories có attribute filter | 9/22 (41%) | 19/22 (86%) | 35+/35+ (100%) |
| Brand coverage (specs) | 60% | 95%+ | ~85% (ước tính) |
| URL quality | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Mobile-first | Chưa (production) | ✅ (new site) | ❌ |

---

> **Cập nhật tiếp theo**: Sau khi P1 hoàn thành, chạy lại query coverage để verify số liệu trước khi launch.
> **Tech Lead**: Tạo Linear issues cho P1.1–P1.4 và P2.1–P2.6 ngay sau khi PM approve.
