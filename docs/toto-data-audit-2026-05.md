# TOTO Product Data Audit — Đông Phú Gia
**Ngày:** 27/05/2026 | **Tác giả:** Tech Lead (Claude)

---

## TÓM TẮT ĐIỀU HÀNH

TOTO là thương hiệu duy nhất có dữ liệu đầy đủ trên hệ thống — **2,091 sản phẩm**, phân bổ trên 12 subcategories. Hệ thống variant hiện tại hoạt động đúng cho ~26% sản phẩm (các nhóm thực sự có biến thể màu sắc/combo), nhưng có **3 vấn đề cấu trúc lớn** cần giải quyết trước khi scale sang INAX/Caesar. Về SEO, đang bỏ lỡ cơ hội lớn ở L3 landing pages và product name pattern.

---

## 1. TỔNG QUAN DỮ LIỆU TOTO

### 1.1 Phân bổ theo danh mục

| Danh mục Cấp 2 | Số SP | Phân loại Cấp 3 (product_type) |
|----------------|-------|-------------------------------|
| **Sen Tắm** | **945** | Sen tắm nóng lạnh (367), Nhiệt độ (142), Âm tường (135), Phụ kiện (89), Sen cây (67), Củ sen/van sen (45), Vòi xả bồn tắm (41), Bát sen cầm tay (35), Bát sen trần (14) |
| **Bồn Cầu** | **366** | 2 khối (127), 1 khối (112), Treo tường (106), Thông minh (18), Đặt sàn (2) |
| **Vòi Chậu** | **208** | Nóng lạnh (123), Cảm ứng (57), Phụ kiện (20), Cổ trung (4), Khác (4) |
| **Chậu Lavabo** | **156** | Đặt bàn (111), Treo tường (21), Âm bàn (14), Dương vành (5), Khác (5) |
| **Bồn Tắm** | **153** | Xây (52), Đặt sàn (44), Có yếm (24), Massage (21), Phụ kiện (12) |
| **Phụ Kiện PT** | **79** | Phụ kiện (24), Treo khăn (21), Lô giấy (10), Vòi xịt (8), Gương (6), Móc (6) |
| **Phụ Kiện BC** | **78** | Phụ kiện bồn cầu (48), Két nước (20), Nắp két (5), Nắp BC (5) |
| **Bồn Tiểu** | **43** | Nam (23), Phụ kiện (20) |
| **Nắp Bồn Cầu** | **24** | Điện tử (14), Đóng êm (7), Rửa cơ (3) |
| **Thân Bồn Cầu** | **23** | Thân bồn cầu (23) |
| **Vòi Rửa Chén** | **12** | (bếp) |
| **Vòi Chậu (bếp)** | **4** | (bếp) |
| **TỔNG** | **2,091** | |

### 1.2 Variant Groups

| Metric | Số lượng |
|--------|---------|
| Tổng variant groups | 890 |
| Groups có nhiều hơn 1 sản phẩm (thực sự là variant) | **245** |
| Groups chỉ có 1 sản phẩm (không phải variant) | **645** |
| Groups lớn nhất | CW812 (34 SP), CW822 (33 SP), TBG01302VA (28 SP) |

---

## 2. GIẢI MÃ LOGIC SKU TOTO

TOTO dùng một cấu trúc SKU nhất quán mà chúng ta cần decode đúng để build variant system:

### 2.1 Cấu trúc SKU cơ bản

```
[MODEL_CODE][#COLOR][/COMPONENT1][#COLOR][/COMPONENT2]...
```

**Ví dụ:**
- `CS302DE2#W` → Model CS302DE2, màu White (#W)
- `CW812RA#W/TC811SJ#W/WH172A/MB174P#SS` → Bồn cầu CW812RA (white) + Nắp TC811SJ (white) + Két WH172A + Nút xả MB174P (SS)
- `TBG01302VA/TBW01008A` → Củ sen TBG01302VA + Bát sen TBW01008A
- `LT1705#MBL` → Lavabo LT1705, màu Matte Blue

### 2.2 Color Suffix Mapping (sau dấu `#`)

| Suffix | Màu | Áp dụng nhiều cho |
|--------|-----|-------------------|
| `#W` | Trắng bóng (White) | Bồn cầu, Bồn tắm |
| `#XW` | Bone/Ivory (TOTO standard off-white) | Bồn cầu cao cấp |
| `#NW1` | New White | Nắp rửa điện tử |
| `#SC1` | Cotton | Nắp rửa điện tử |
| `#MBE` | Matte Beige | Lavabo, Bồn tắm |
| `#MBL` | Matte Blue | Lavabo |
| `#MGR` | Matte Green | Lavabo |
| `#MW` | Matte White | Lavabo, Bồn tắm |
| `#GW` | Glossy White | Bồn tắm |
| `#SS` | Stainless Steel | Nút xả, phụ kiện |
| `#ASB`, `#FRG`, `#MDR`, `#SCR` | Các màu đặc biệt | Lavabo LW896 series |

### 2.3 Combo Separator `/`

Dấu `/` phân tách các component trong một combo:
- **Bồn cầu combo**: `[THÂN BC]/[NẮP]/[KÉT NƯỚC]/[NÚT XẢ]`
- **Sen tắm bundle**: `[CỦ SEN]/[BÁT SEN]/[TAY SEN]`
- **Vòi chậu set**: `[VÒI]/[CẦU XẢ]/[PHỤ KIỆN]`

### 2.4 Model Code Prefix → Product Type

| Prefix | Loại sản phẩm |
|--------|---------------|
| `CS` | Bồn cầu (Closed tank toilet) |
| `CW` | Bồn cầu wall-hung/combined |
| `TC`, `TCF` | Nắp bồn cầu (thường/điện tử) |
| `WH` | Két nước |
| `LT`, `LW`, `L` | Lavabo |
| `TBG`, `TBS` | Củ sen/van sen |
| `TBW` | Bát sen/tay sen |
| `DGH` | Đầu sen trần |
| `TLE` | Vòi chậu |
| `PJY` | Bồn tắm |
| `DB`, `TVBF` | Phụ kiện bồn tắm |
| `A` (A361, A511...) | Phụ kiện phòng tắm (thanh vắt khăn, etc.) |
| `HHF`, `HW` | Phụ kiện bồn tiểu |
| `MS`, `HB` | Thân bồn cầu |

---

## 3. VẤN ĐỀ HIỆN TẠI — PHÂN TÍCH

### ⚠️ Vấn đề #1: Sen Tắm — Variant Logic Sai Hoàn Toàn

**Hiện tại:** TBG01302VA (củ sen) được nhóm với 27 SKU khác nhau trong cùng một variant group. Tất cả là dạng `TBG01302VA/TBW01008A`, `TBG01302VA/TBW01010A`... — các bundle khác nhau.

**Vấn đề:** Đây **không phải** biến thể màu sắc — đây là các **sản phẩm combo khác nhau** (cùng củ sen, ghép với các bát sen khác nhau). Mỗi combo nên là một sản phẩm riêng (is_combo=true), không phải variant của nhau.

**Tác động:** 
- Frontend hiển thị sai: user thấy "28 màu sắc" nhưng thực ra là 28 cấu hình combo khác nhau
- SEO: không có trang riêng cho mỗi combo → mất organic traffic
- Con số: **945 sản phẩm Sen Tắm** — phần lớn bị affected

**Fix:** Sen tắm bundle (SKU chứa `/`) → `is_combo=true`, `variant_group=NULL` (trừ khi thực sự có biến thể màu sắc)

---

### ⚠️ Vấn đề #2: 645 Single-Item Variant Groups

**Hiện tại:** 645/890 variant groups chỉ có 1 sản phẩm — product có `variant_group = 'DL102'` nhưng không có sản phẩm nào khác trong group đó.

**Vấn đề:** `variant_group` được set nhưng không có ý nghĩa gì — đây thực chất là `product_code` (mã gốc của TOTO), không phải variant group.

**Tác động:**
- Frontend VariantSelector component hiển thị nhưng không có gì để chọn
- Query DB chậm hơn cần thiết (join không cần thiết)
- Misleading cho developer/data analyst

**Fix:** Với single-item groups → `variant_group = NULL`. Chỉ set variant_group khi có ≥2 sản phẩm trong group.

---

### ⚠️ Vấn đề #3: Thiếu Dimension Tracking cho Variants

**Hiện tại:** DB có `color_id` (FK → colors table) nhưng không track được **loại biến thể** (dimension) — màu sắc vs. kích thước vs. loại nắp vs. loại xả.

**Ví dụ thực tế:**
- Lavabo `LT1705` có 5 biến thể màu (`#MBE`, `#MBL`, `#MGR`, `#MW`, `#XW`) → nên dùng `color_id`
- Bồn cầu `CS767CRW` có 18 biến thể theo nắp rửa (`12`, `15`, `17`, `23`, `24`, `25`) → không phải màu sắc, là **loại nắp**
- Bồn tắm `PJY1724WHPWEN` có biến thể theo màu + có/không van xả → 2 dimensions

**Fix:** Cần field `variant_dimension` trên products table hoặc dùng specs JSONB để track `variant_type: "color" | "seat_type" | "flush_type" | "size"`.

---

## 4. SO SÁNH VỚI COMPETITOR

### 4.1 Hita.com.vn

| Aspect | Hita | Đông Phú Gia (hiện tại) | Gap |
|--------|------|------------------------|-----|
| L3 Category URL | `/bon-cau-toto-178.html` — brand landing trong category | Không có brand-specific L3 | ❌ Thiếu |
| Variant display | Tất cả màu/loại trên 1 trang product, chọn bằng attribute | Mỗi variant là trang riêng | ⚠️ Khác biệt |
| Filters | Brand + Loại lắp đặt + Tech feature + Giá | Brand + Danh mục | ⚠️ Thiếu filters |
| Product name pattern | `[Loại] [Config] [Brand] [Model] [Tính năng]` | Đang tương tự | ✅ OK |
| Nắp bồn cầu granularity | Tách 3 trang: Điện tử / Đóng êm / Rửa cơ | Có 3 product_type riêng | ✅ Tốt |

### 4.2 TDM.vn

| Aspect | TDM | Đông Phú Gia | Gap |
|--------|-----|-------------|-----|
| Bồn Cầu L3 | 1 khối / 2 khối / Thông minh / Treo tường | ✅ Đã có product_type | ✅ Ngang |
| Vòi Lavabo L3 | Nóng lạnh / Lạnh / Âm tường / Cảm ứng | ✅ Đã có | ✅ Ngang |
| Sen Tắm L3 | Nóng lạnh / Nhiệt độ / Lạnh / Âm tường | ✅ Đã có | ✅ Ngang |
| Brand sub-nav | `/thiet-bi-ve-sinh-toto` brand page | Không có dedicated TOTO page | ❌ Thiếu |

### 4.3 TOTO Vietnam Official (toto.com.vn)

TOTO tổ chức catalog theo **dòng sản phẩm (series)** thay vì loại lắp đặt — ví dụ dòng "NEOREST", "RG", "GG". Đây không phù hợp cho distributor (khách hàng search theo loại SP, không theo dòng).

**Nhận xét:** Cách tổ chức của Hita/TDM phù hợp với distributor hơn TOTO official.

---

## 5. RECOMMENDATIONS — ƯU TIÊN

### 🔴 P1 — Fix ngay (ảnh hưởng đến UX + data integrity)

**R1. Fix variant_group cho Sen Tắm bundles**
- Logic: SKU chứa `/` + không có `#` color suffix → `is_combo=true`, `variant_group=NULL`
- Script: Query tất cả TOTO products với SKU pattern `X/Y`, set `is_combo=true`, clear `variant_group`
- Files: `scripts/` hoặc Prisma Studio SQL

**R2. Clean up single-item variant groups**
- Query: `WHERE variant_group IS NOT NULL GROUP BY variant_group HAVING COUNT(*) = 1`
- Action: SET `variant_group = NULL` cho tất cả single-item groups
- Ước tính: ~645 products cần update

**R3. Chuẩn hóa variant_group = NULL vs SET**
- Rule rõ ràng: `variant_group IS NOT NULL` chỉ khi có ≥2 products với cùng group value
- `is_master = true` chỉ khi có variant siblings

### 🟠 P2 — Thêm vào M2 Variant System Spec (LEO-423)

**R4. Thêm variant_dimension tracking**

Cách đơn giản nhất: thêm vào `specs` JSONB field:
```json
{
  "variant_dimension": "color",
  "variant_label": "Màu sắc",
  "variant_options": [
    {"sku": "LT1705#MBE", "label": "Matte Beige", "color_hex": "#C4B49A"},
    {"sku": "LT1705#MBL", "label": "Matte Blue", "color_hex": "#6B8EAD"}
  ]
}
```

Hoặc thêm column `variant_type VARCHAR(50)` với enum: `color | seat | flush | size | configuration`

**R5. SEO: Brand landing pages trong category**

Tạo filter URL pattern: `/thiet-bi-ve-sinh/bon-cau?brand=toto`
Hoặc dedicated slugs: `/thiet-bi-ve-sinh/bon-cau/toto` (route riêng với brand-specific meta title/description)

Hita làm cách này rất tốt — mỗi brand trong mỗi category có URL và SEO riêng → đây là **organic traffic goldmine** cho long-tail keywords "bồn cầu toto giá rẻ", "bồn cầu toto đà lạt".

### 🟡 P3 — Cải thiện data quality

**R6. Product name standardization**

Pattern chuẩn theo category:

| Category | Pattern |
|----------|---------|
| Bồn Cầu | `Bồn cầu [1 khối/2 khối/treo tường] TOTO [MODEL] [nắp loại X]` |
| Chậu Lavabo | `Chậu Lavabo [đặt bàn/treo tường] TOTO [MODEL] màu [TÊN MÀU]` |
| Sen Tắm | `[Củ sen/Bộ sen cây/Sen tắm] TOTO [MODEL] [nóng lạnh/nhiệt độ/âm tường]` |
| Vòi Chậu | `Vòi lavabo [nóng lạnh/cảm ứng] TOTO [MODEL] [tính năng đặc biệt]` |

**R7. Filter definitions — bổ sung**

Hiện tại filter definitions chưa đủ cho TOTO. Cần thêm:
- Bồn Cầu: filter theo Loại lắp đặt (1 khối/2 khối/treo tường), Loại nắp, Tính năng đặc biệt (thông minh)
- Sen Tắm: filter theo Loại (nóng lạnh/nhiệt độ/âm tường), Vật liệu (đồng/inox)
- Vòi Chậu: filter theo Loại (cảm ứng/nóng lạnh), Số lỗ gắn (1 lỗ/2 lỗ)
- Lavabo: filter theo Màu sắc, Kiểu gắn (đặt bàn/treo tường/âm bàn)

---

## 6. VARIANT SYSTEM DESIGN — ĐỀ XUẤT CHO LEO-423

Dựa trên audit này, đây là input cho LEO-423 spec:

### 6.1 Ba loại "biến thể" cần phân biệt

```
TYPE A — Color Variant (màu sắc)
  → Cùng model, khác màu
  → Hiển thị: color swatch selector
  → Ví dụ: LT1705#MBE | LT1705#MBL | LT1705#MGR | LT1705#MW | LT1705#XW
  → is_master: sản phẩm màu trắng (#W hoặc #XW)

TYPE B — Configuration Variant (cấu hình)
  → Cùng model bồn cầu, khác loại nắp/két nước
  → Hiển thị: dropdown "Chọn loại nắp"
  → Ví dụ: CS767CRW12#XW ... CS767CRW25#XW (18 nắp khác nhau)
  → Hoặc: CW812 + các combo nắp điện tử khác nhau

TYPE C — Combo/Bundle (sản phẩm bán kèm)
  → Không phải variant — là sản phẩm độc lập có nhiều thành phần
  → is_combo=true, is_master=true, component_skus=[...]
  → product_relationships chứa component links
  → KHÔNG có variant_group
  → Ví dụ: TBG01302VA/TBW01008A (củ sen + bát sen)
```

### 6.2 Decision tree để classify SKU khi import

```
SKU chứa `/` ?
  └─ YES → Là combo
           └─ Có # trong bất kỳ phần nào? → vẫn là combo (màu sắc của từng component)
  └─ NO → Sản phẩm đơn
           └─ Cùng base code (trước #) với SP khác trong cùng subcategory?
              └─ YES → Color variant (Type A)
              └─ NO → Check suffix pattern của base code
                       └─ Suffix 2-chữ-số (12, 15, 17...) → Configuration variant (Type B)
                       └─ Không có suffix → Standalone product
```

### 6.3 Master product rule

- Type A: Master = variant màu `#W` hoặc `#XW` (white)
- Type B: Master = model code gốc (thường là variant có nắp cơ bản nhất)
- Type C: Master = sản phẩm combo (is_combo=true, is_master=true luôn)

---

## 7. SEO OPPORTUNITY MAP

| Keyword nhóm | Volume ước tính | Đang có page? | Cần làm |
|-------------|-----------------|---------------|---------|
| "bồn cầu toto" | Cao | ✅ Có (filter brand) | Brand landing page riêng |
| "bồn cầu toto 1 khối" | Trung bình-cao | ✅ product_type | Dedicated L3 page + content |
| "lavabo toto màu matte" | Thấp-trung | ❌ | Color variant pages |
| "sen tắm toto nóng lạnh" | Trung bình | ✅ product_type | Tối ưu title/desc |
| "bồn tắm toto massage" | Thấp | ✅ product_type | Content page |
| "vòi lavabo toto cảm ứng" | Thấp-trung | ✅ product_type | Tối ưu meta |
| "nắp rửa điện tử toto" | Trung bình | ✅ Nắp Bồn Cầu | Dedicated landing page |
| "phụ kiện bồn cầu toto" | Thấp | ✅ | OK |

**Biggest SEO gap:** Không có **brand-within-category landing page** (ví dụ: `/thiet-bi-ve-sinh/bon-cau?brand=toto`). Hita và TDM đều có, và đây là trang rank cao nhất cho các từ khóa thương mại cao.

---

## 8. ACTION ITEMS TÓM TẮT

| Priority | Action | Owner | Issue |
|----------|--------|-------|-------|
| 🔴 P1 | Fix Sen Tắm bundle → is_combo=true, clear variant_group | Antigravity | Cần tạo issue mới |
| 🔴 P1 | Clean 645 single-item variant_groups → NULL | Antigravity | Cần tạo issue mới |
| 🟠 P2 | Design variant_dimension system | Tech Lead | LEO-423 |
| 🟠 P2 | Brand landing pages (SEO) | Antigravity | M4 |
| 🟡 P3 | Product name standardization (batch update) | Antigravity | M3 |
| 🟡 P3 | Bổ sung filter_definitions cho TOTO categories | Antigravity | M4 |

---

*Audit này là input chính cho LEO-423 (Variant System Spec). Đọc kỹ Section 6 trước khi viết spec.*
