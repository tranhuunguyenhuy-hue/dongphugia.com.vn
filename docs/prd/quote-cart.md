# PRD — Giỏ Báo Giá & Gửi Yêu Cầu (Quote Cart & Checkout)
**Dự án:** Đông Phú Gia V2
**Route:** `/bao-gia` (hoặc slide-in drawer từ bất kỳ trang nào)
**Phiên bản:** 1.0 — 09/04/2026
**Dành cho:** Designer + Frontend Dev

---

## 1. Mục tiêu trang/feature

1. **Giỏ báo giá** — khách chọn nhiều SP rồi gửi 1 yêu cầu duy nhất
2. **Giảm friction** — không cần tạo tài khoản, không cần điền giá
3. **Thu thập lead** — tên, số điện thoại, email (optional), ghi chú
4. **Xác nhận** — hiển thị quote number sau khi submit thành công

---

## 2. Cấu trúc (2 views)

```
[A] Quote Cart Drawer (slide-in từ phải)
    [1] Header "Báo giá của bạn (N sản phẩm)"
    [2] Product List
    [3] Nút "Gửi yêu cầu báo giá"

[B] Quote Form (modal hoặc trang /bao-gia)
    [1] Danh sách SP đã chọn (read-only)
    [2] Form thông tin liên hệ
    [3] Submit + Confirmation
```

---

## 3. Sections Chi Tiết

---

### [A1] Quote Cart Drawer — Header

**Mô tả:** Tiêu đề drawer với số lượng SP đã thêm.

#### 📦 DB Contract

Không có DB — dữ liệu lưu ở **localStorage** (client-side state).

| UI Element | Nguồn | Ghi chú |
|-----------|-------|---------|
| "Báo giá của bạn" | Static text | |
| "(N sản phẩm)" | `cartItems.length` | từ localStorage/Zustand |
| Nút đóng | — | |

#### 📝 Wireframe Notes

- Drawer slide từ phải, width 400px desktop / full-screen mobile
- Overlay backdrop khi mở

---

### [A2] Quote Cart Drawer — Product List

**Mô tả:** Danh sách sản phẩm đã thêm vào báo giá.

#### 📦 DB Contract

**Lưu ý:** Cart là client-side state. Chỉ lưu `product_id` + `quantity` + `note` trong localStorage.
Dữ liệu hiển thị (tên, ảnh, giá) được lấy từ product đã fetch trước đó hoặc re-fetch theo `product_id`.

**Model hiển thị từ `products`:**
| Field | Type | Dùng để làm gì |
|-------|------|----------------|
| `id` | `Int` | Identifier |
| `name` | `String` | Tên SP trong cart row |
| `sku` | `String` | Mã SP |
| `image_main_url` | `String?` | Ảnh thumbnail nhỏ |
| `price_display` | `String?` | Giá — "Liên hệ báo giá" |
| `categories.name` | `String` | Category label |

**Client-side cart item:**
```typescript
type CartItem = {
  product_id: number
  quantity: number         // default 1, min 1
  note: string             // ghi chú riêng cho SP này
  // Denormalized (cached từ product detail):
  name: string
  sku: string
  image_main_url: string | null
  price_display: string | null
  category_name: string
}
```

#### 🎨 UI → Data Mapping

| UI Element | Data field | Ghi chú |
|-----------|------------|---------|
| Thumbnail | `image_main_url` | 64×64px, placeholder nếu null |
| Tên SP | `name` | Max 2 dòng |
| Mã SKU | `sku` | Muted text |
| Giá | `price_display` | |
| Số lượng | `quantity` | Input number, min=1 |
| Ghi chú | `note` | Text input nhỏ, optional |
| Nút xóa | — | Remove khỏi cart |

#### �� Wireframe Notes

- Mỗi cart row: ảnh trái + info giữa + xóa phải
- Số lượng: stepper `- N +` nhỏ
- Ghi chú: collapsible text field
- **Empty cart:** Illustration + "Chưa có sản phẩm nào. Khám phá ngay →"

---

### [B1] Quote Form — Danh sách SP (read-only)

**Mô tả:** Tóm tắt SP đã chọn trước khi điền form.

#### 📝 Wireframe Notes

- Compact list: thumbnail nhỏ + tên + số lượng
- Không cho edit ở đây — có link "Quay lại sửa"
- Số lượng SP: badge số tổng

---

### [B2] Quote Form — Thông tin liên hệ

**Mô tả:** Form thu thập thông tin người dùng để gửi báo giá.

#### 📦 DB Contract

**Model:** `quote_requests` + `quote_items`

**quote_requests — input fields:**
| Field | Type | Bắt buộc | Validation |
|-------|------|----------|-----------|
| `name` | `String` (max 100) | ✅ | min 2 ký tự |
| `phone` | `String` (max 20) | ✅ | Vietnam phone format |
| `email` | `String?` (max 200) | ❌ | Email format nếu nhập |
| `message` | `String?` | ❌ | Max 500 ký tự |

**quote_requests — auto-generated (không hiển thị on form):**
| Field | Value | Ghi chú |
|-------|-------|---------|
| `quote_number` | Auto: `DPG-{YYYY}{MM}{DD}-{random4}` | |
| `status` | `"pending"` | Default |
| `created_at` | `now()` | Auto |

**quote_items — per cart item:**
| Field | Nguồn | Ghi chú |
|-------|-------|---------|
| `product_id` | CartItem.product_id | |
| `quantity` | CartItem.quantity | |
| `note` | CartItem.note | |

#### 🔌 API Contract

```typescript
// POST /api/quote-requests
type QuoteRequestPayload = {
  name: string
  phone: string
  email?: string
  message?: string
  items: Array<{
    product_id: number
    quantity: number
    note?: string
  }>
}

// Response success:
type QuoteResponse = {
  success: true
  quote_number: string    // "DPG-20260409-A3F2"
  message: string
}

// Response error (rate limited, validation):
type ErrorResponse = {
  success: false
  error: string
  code: "VALIDATION_ERROR" | "RATE_LIMITED" | "SERVER_ERROR"
  details?: Array<{ field: string; message: string }>
}
```

#### 🎨 UI → Data Mapping

| UI Element | DB Field | Validation message |
|-----------|----------|--------------------|
| Input "Họ và tên" | `name` | "Vui lòng nhập tên của bạn" |
| Input "Số điện thoại" | `phone` | "Số điện thoại không hợp lệ" |
| Input "Email" | `email` | "Email không hợp lệ" (optional) |
| Textarea "Ghi chú" | `message` | max 500 ký tự counter |
| Button "Gửi yêu cầu" | — | Disabled khi đang submit |

#### 📝 Wireframe Notes

- **Layout:** Single column, card style
- **Phone field:** Prefix "+84" hoặc "0" auto
- **Submit button:** Full-width, primary color
- **Loading state:** Button disabled + spinner
- **Error state:** Inline error bên dưới field (red text)
- **Rate limit error:** Toast "Vui lòng chờ trước khi gửi yêu cầu mới"

---

### [B3] Confirmation

**Mô tả:** Màn hình sau khi submit thành công.

#### 📦 DB Contract

Dùng `quote_number` từ API response.

#### 🎨 UI → Data Mapping

| UI Element | Data | Ghi chú |
|-----------|------|---------|
| Quote number | `quote_number` | "DPG-20260409-A3F2" |
| "Cảm ơn {name}" | `name` từ form | |
| "Chúng tôi sẽ liên hệ trong 24h" | Static | |

#### 📝 Wireframe Notes

- **Success screen:** Checkmark animation + quote number + message
- **Actions:** "Về trang chủ" + "Xem thêm sản phẩm"
- **Cart clear:** Auto clear localStorage sau khi submit thành công

---

## 4. State Management (Client-side)

Cart state lưu trong `localStorage` key `dpg_quote_cart`:
```typescript
type QuoteCart = {
  items: CartItem[]
  last_updated: string  // ISO timestamp
}
```

**Recommended:** Zustand store với persist middleware → localStorage.

---

## 5. States cần Design

| State | Khi nào | Xử lý |
|-------|---------|-------|
| Empty cart | Chưa thêm SP nào | Illustration + CTA |
| Cart với 1 SP | Item đơn | Không có divider |
| Cart nhiều SP | N > 1 | Scroll nếu > 4 items |
| Form submitting | Đang gửi | Button disabled + spinner |
| Form error | Validation fail | Inline error per field |
| Rate limited | Gửi quá nhanh | Toast error |
| Success | Submit OK | Confirmation screen |
| Network error | Mất mạng | Toast "Không thể gửi. Thử lại?" |

---

## 6. Open Questions (cho PM)

| # | Câu hỏi | Deadline |
|---|---------|---------|
| 1 | Quote Cart: Drawer slide-in hay trang riêng `/bao-gia`? | 14/04 |
| 2 | Sau khi submit: gửi email xác nhận cho khách không? (cần email service) | 14/04 |
| 3 | Admin nhận thông báo real-time khi có quote mới không? (cần websocket/email) | 14/04 |
| 4 | Cho phép khách lưu cart (cross-session) hay chỉ session hiện tại? | 14/04 |

---
*PRD này là Design Contract — mọi field trong UI đều có data source rõ ràng từ DB.*
