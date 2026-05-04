# 03 — Quản lý Sản phẩm (V2)

---

## A. TRANG DANH SÁCH `/products` và `/products?category=X`

### Hành vi Routing
- `/products` → Hiển thị TẤT CẢ sản phẩm, brand section ẩn
- `/products?category=1` → Pre-filter theo "Thiết bị Vệ sinh", brand section hiện

### DB Contract
- Model: `products` (37 fields)
- Relations: `categories`, `subcategories`, `brands`, `colors`, `origins`, `materials`

### API Contract
```typescript
getAdminProducts(params: {
  search?: string           // Tìm theo name, SKU
  category?: number         // Pre-filter từ sidebar
  subcategory?: number      // Filter dropdown
  brand?: number            // Filter từ brand chips
  product_type?: string     // Filter dropdown
  stock_status?: string     // in_stock | out_of_stock | preorder
  is_active?: boolean
  page?: number
  pageSize?: number         // Default 25
}): Promise<{ products, total, page, pageSize, totalPages }>

// Brand management
getBrandsByCategory(categoryId: number): Promise<Brand[]>
toggleBrandVisibility(brandId: number, isActive: boolean): Promise<Result>
createBrand(data: { name, slug, logo_url?, origin_country? }): Promise<Result>

// Bulk operations
bulkDeleteProducts(ids: number[]): Promise<{ success, count }>
bulkToggleActive(ids: number[], value: boolean): Promise<{ success, count }>
bulkUpdateStockStatus(ids: number[], status: string): Promise<{ success, count }>
```

---

### Page Layout khi có category filter

Trang `/products?category=1` gồm 3 khu vực từ trên xuống:

#### KHU VỰC 1: Page Header
- Title: "Thiết bị Vệ sinh" (tên category)
- Subtitle: "1,847 sản phẩm"
- Button: `[+ Thêm sản phẩm]`

#### KHU VỰC 2: Brand Section (chỉ hiện khi có ?category=)
- Dạng: Hàng ngang các chip/badge
- Mỗi chip: `[Logo] Caesar (456) ✕`
- Click chip → Toggle filter DataTable theo brand đó (multi-select)
- Chip active = filled, chip inactive = outline
- Cuối hàng: nút `[⚙️ Quản lý]` mở Dialog quản lý thương hiệu
- Nút `[+ Thêm thương hiệu]` mở form tạo brand mới

**Dialog "Quản lý thương hiệu"**:

| Cột | Data | Component |
|-----|------|-----------|
| Logo | `brands.logo_url` | Avatar 32x32 |
| Tên | `brands.name` | Text |
| Xuất xứ | `brands.origin_country` | Text |
| Số SP | Count products by brand in category | Number |
| Hiển thị | `brands.is_active` | Switch (ẩn brand + tất cả SP của brand) |
| Xóa | — | Button 🗑 (chỉ khi 0 SP) |

#### KHU VỰC 3: Filter Bar + DataTable

**Filter Bar** (1 hàng ngang):

| Filter | Data | Component | Phụ thuộc |
|--------|------|-----------|-----------|
| Danh mục con | `subcategories` by category | `Select` dropdown | category |
| Loại SP | `product_type` distinct values | `Select` dropdown | subcategory (cascade) |
| Trạng thái kho | `stock_status` enum | `Select` dropdown | — |
| Tìm kiếm | `name`, `sku` | `Input` + debounce 300ms | — |

**Active filter chips**: Hiển thị bên dưới filter bar khi đang filter
- VD: `[Bồn cầu ✕] [1 khối ✕] [Còn hàng ✕]` `[Xóa tất cả]`

**DataTable Columns**:

| Column | Data Field | Width | Sortable | Component |
|--------|-----------|-------|:--------:|-----------|
| ☐ | selection | 40px | — | `Checkbox` |
| Ảnh | `image_main_url` | 60px | — | `Avatar` fallback icon |
| Tên / SKU | `name` + `sku` | flex | ✓ name | Text bold + muted SKU |
| Thương hiệu | `brands.name` | 120px | ✓ | Text |
| Giá | `price` / `price_display` | 120px | ✓ | VND format / "Liên hệ" |
| Tồn kho | `stock_status` | 100px | ✓ | Badge green/red/yellow |
| Hiển thị | `is_active` | 60px | — | Switch (inline toggle) |
| Nhãn | `is_featured`, `is_new` | 100px | — | Badge group |
| ••• | Actions menu | 50px | — | DropdownMenu |

**Actions Menu (••• dropdown)**:
- ✏️ Chỉnh sửa → `/products/[id]`
- 🔗 Xem trên web → mở tab mới tới frontend
- ⭐ Đánh dấu nổi bật → `toggleProductFeatured`
- 👁️ Ẩn/Hiện → `toggleProductActive`
- ───
- 🗑️ Xóa → ConfirmDialog

**Bulk Action Bar** (floating, hiện khi có selection):
- Text: "Đã chọn 12 sản phẩm"
- Actions: `[Hiển thị]` `[Ẩn]` `[Đổi trạng thái kho ▾]` `[🗑 Xóa]`
- "Đổi trạng thái kho" mở Select inline: Còn hàng / Hết hàng / Đặt trước

**Pagination**:
- "Showing 1-25 of 1,847"
- `[◀ Prev]` `[1]` `[2]` `[3]` `...` `[Next ▶]`
- Page size selector: `[25 ▾]` (10, 25, 50, 100)

---

### Trang `/products` (không có category)
- Brand section: **ẨN**
- Filter bar: Thêm dropdown "Danh mục" ở đầu (replace cho category pre-filter)
- Còn lại giữ nguyên

---

### States — List Page

| State | Hiển thị |
|-------|---------|
| Loading | Skeleton: brand chips (nếu có) + table 10 rows |
| Empty (no filter) | EmptyState: icon `Package`, "Chưa có sản phẩm nào", CTA "Thêm sản phẩm đầu tiên" |
| Empty (filtered) | EmptyState: icon `Search`, "Không tìm thấy sản phẩm", CTA "Xóa bộ lọc" |
| Bulk selected | Floating BulkActionBar phía trên table |
| Delete confirm | AlertDialog: "Bạn có chắc muốn xóa [name]?" |
| Bulk delete | AlertDialog: "Xóa 12 sản phẩm? Hành động không thể hoàn tác." |

---

## B. FORM SẢN PHẨM `/products/new` & `/products/[id]`

### Layout: 2-column với tabs (theo khuyến nghị từ IA Review)

**Cột trái (flex)**: Tabs content
**Cột phải (320px fixed)**: Sticky sidebar cards

### Tabs chính (cột trái)

```
[Cơ bản] [Mô tả] [Thông số] [Hình ảnh] [SEO]
```

#### Tab "Cơ bản"

| Field | DB | Type | Required | Component | Notes |
|-------|-----|------|:--------:|-----------|-------|
| Tên sản phẩm | `name` | string(500) | ✓ | `Input` | — |
| Tên hiển thị | `display_name` | string(500) | — | `Input` | Tên ngắn cho card |
| SKU | `sku` | string(100) | ✓ | `Input` | Unique, check duplicate |
| Slug | `slug` | string(500) | ✓ | `Input` + auto-gen | Từ name, nút ↻ regenerate |
| Danh mục | `category_id` | FK int | ✓ | `Select` | Pre-filled nếu từ category page |
| Phân loại con | `subcategory_id` | FK int | — | `Select` | Cascade từ category |
| Thương hiệu | `brand_id` | FK int | — | `Select` | — |
| Xuất xứ | `origin_id` | FK int | — | `Select` | — |
| Màu sắc | `color_id` | FK int | — | `Select` | Color swatch |
| Chất liệu | `material_id` | FK int | — | `Select` | — |
| Giá bán (VNĐ) | `price` | decimal | — | `Input` + VND format | null → "Liên hệ" |
| Giá gốc (VNĐ) | `original_price` | decimal | — | `Input` | Để tính discount |
| Hiển thị giá | `price_display` | string | — | `Input` | Default: "Liên hệ báo giá" |
| Bảo hành (tháng) | `warranty_months` | int | — | `Input` number | — |

#### Tab "Mô tả"
- **Mô tả sản phẩm** (`description`): Rich text editor (TipTap), min-height 200px
- **Đặc điểm nổi bật** (`features`): Rich text editor (TipTap), min-height 150px

#### Tab "Thông số"
- **Thông số kỹ thuật** (`specs` JSON): Dynamic key-value list
- Mỗi row: `[Tên thông số]` + `[Giá trị]` + `[🗑 Xóa]`
- Nút: `[+ Thêm thông số]`

#### Tab "Hình ảnh"
- **Ảnh chính** (`image_main_url`): ImageUploader drag & drop (required)
- **Ảnh hover** (`image_hover_url`): ImageUploader
- **Gallery** (`product_images[]`): Multi-image uploader, sortable grid, drag reorder

#### Tab "SEO"
- **SEO Title** (`seo_title`): Input + char counter (0/200)
- **SEO Description** (`seo_description`): Textarea + char counter (0/500)
- **Preview**: Google SERP preview card (tự render từ title + desc)

### Sidebar (cột phải, sticky)

**Card "Trạng thái"**:

| Field | DB | Component |
|-------|-----|-----------|
| Hiển thị | `is_active` | Switch |
| Nổi bật | `is_featured` | Switch |
| Hàng mới | `is_new` | Switch |
| Bán chạy | `is_bestseller` | Switch |
| Combo | `is_combo` | Switch |
| Tồn kho | `stock_status` | Select (3 options) |
| Thứ tự | `sort_order` | Input number |

**Card "Actions"**:
- `[Lưu nháp]` — variant outline
- `[Lưu & Hiển thị]` — variant default (primary)
- `[Hủy]` — variant ghost

### States — Form

| State | Hiển thị |
|-------|---------|
| New (create) | Form trống, title "Thêm sản phẩm mới" |
| Edit | Form filled, title "Sửa: [product name]" |
| Loading (edit) | Skeleton form |
| Submitting | Buttons disabled + spinner |
| Validation error | Red borders + error text dưới field |
| Duplicate SKU | Toast error "SKU đã tồn tại" |
| Success | Toast "Đã lưu" → redirect /products?category=X |
| Unsaved changes | UnsavedGuard dialog khi navigate away |
