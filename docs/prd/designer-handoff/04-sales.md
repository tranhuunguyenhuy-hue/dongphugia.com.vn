# 04 — Bán hàng: Báo giá + Đơn hàng

---

## A. BÁO GIÁ `/quotes`

### DB Contract
- Model: `quote_requests` + `quote_items`
- Status pipeline: `pending → processing → quoted → confirmed | rejected`

### API Contract
```typescript
getAdminQuotes({ status?, search?, page?, pageSize? })
updateQuoteRequestStatus(id, status): Promise<Result>
```

### Page Layout

#### Tabs filter (theo status)
`[Tất cả 48]` `[Chờ xử lý 🔴12]` `[Đang xử lý 8]` `[Đã báo giá 8]` `[Đã chốt 20]`

#### Search bar
- Input: Tìm theo mã báo giá, tên, SĐT

#### DataTable

| Column | Data | Component |
|--------|------|-----------|
| Mã | `quote_number` | Badge outline |
| Khách hàng | `name` | Text |
| SĐT | `phone` | Text + copy icon |
| Email | `email` | Truncated |
| Số SP | `quote_items.length` | Number |
| Tin nhắn | `message` | Truncated 50 chars |
| Thời gian | `created_at` | Relative |
| Trạng thái | `status` | Select inline (dropdown đổi status) |
| ••• | Actions | DropdownMenu |

#### Status Badges
| Status | Label | Color |
|--------|-------|-------|
| `pending` | Chờ xử lý | red |
| `processing` | Đang xử lý | yellow |
| `quoted` | Đã báo giá | blue |
| `confirmed` | Đã chốt | green |
| `rejected` | Từ chối | zinc/outline |

---

### Chi tiết Báo giá `/quotes/[id]`

**Layout 2 cột**:

**Cột trái**: Thông tin khách + Danh sách SP yêu cầu

| Info | Data |
|------|------|
| Tên | `name` |
| SĐT | `phone` + Copy button |
| Email | `email` |
| Lời nhắn | `message` (full) |

**Bảng SP yêu cầu**:

| Cột | Data |
|-----|------|
| Ảnh | product thumbnail |
| Tên / SKU | product name + sku |
| Số lượng | `quantity` |
| Giá niêm yết | `products.price` |
| Ghi chú KH | `note` |

**Cột phải (sidebar)**:
- Select "Trạng thái" → đổi status
- Button `[Chuyển → Đơn hàng]` (🔲 tương lai)
- Button `[Xuất PDF]` (🔲 tương lai)
- Textarea "Ghi chú nội bộ" (🔲 tương lai)

---

## B. ĐƠN HÀNG `/orders`

### DB Contract
- Model: `orders` + `order_items`
- Status: `pending → confirmed → processing → shipping → delivered | cancelled`
- Payment: `unpaid → paid → refunded`

### API Contract
```typescript
getAdminOrders({ status?, payment_status?, search?, page?, pageSize? })
updateOrderStatus(id, status): Promise<Result>
updatePaymentStatus(id, paymentStatus): Promise<Result>
```

### Page Layout

#### Tabs filter (theo order status)
`[Tất cả 156]` `[Chờ xác nhận 🔴8]` `[Đang xử lý 15]` `[Đang giao 10]` `[Đã giao 120]`

#### Filter bar
- Search: Tìm mã đơn, tên, SĐT
- Dropdown: Thanh toán (Tất cả / Chưa TT / Đã TT / Hoàn tiền)

#### DataTable

| Column | Data | Component |
|--------|------|-----------|
| Mã đơn + Ngày | `order_number` + `created_at` | Text + relative time |
| Khách hàng | `customer_name` | Text |
| SĐT | `customer_phone` | Text + copy |
| Sản phẩm | `order_items[0..2]` preview | Truncated + "+N SP khác" |
| Tổng | `total` | VND formatted |
| Trạng thái | `status` | Select inline |
| Thanh toán | `payment_status` | Badge colored |
| ••• | Actions | DropdownMenu |

#### Status Badges — Orders
| Status | Label | Color |
|--------|-------|-------|
| `pending` | Chờ xác nhận | zinc/outline |
| `confirmed` | Đã xác nhận | blue |
| `processing` | Đang xử lý | yellow |
| `shipping` | Đang giao | indigo |
| `delivered` | Đã giao | green |
| `cancelled` | Đã hủy | red |

#### Payment Badges
| Payment | Label | Color |
|---------|-------|-------|
| `unpaid` | Chưa TT | red/outline |
| `paid` | Đã TT | green |
| `refunded` | Hoàn tiền | yellow |

---

### Chi tiết Đơn hàng `/orders/[id]`

**Layout 2 cột**:

**Cột trái**:

Thông tin khách:
- 👤 Tên, 📱 SĐT (copy), ✉️ Email, 📍 Địa chỉ, 📝 Ghi chú

Bảng SP trong đơn:

| Cột | Data |
|-----|------|
| Ảnh | product thumbnail |
| Tên / SKU | `product_name` + `product_sku` (snapshot) |
| Số lượng | `quantity` |
| Đơn giá | `unit_price` |
| Thành tiền | `total_price` |

Summary:
- Tạm tính: `subtotal`
- Phí ship: `shipping_fee`
- **TỔNG**: `total`

**Cột phải (sidebar)**:
- Select "Trạng thái đơn hàng" → đổi status
- Select "Thanh toán" → đổi payment_status
- Text "Phương thức TT": `payment_method`
- Button `[🖨️ In phiếu]` (🔲 tương lai)

---

## States chung cho Sales

| State | Hiển thị |
|-------|---------|
| Loading | Skeleton table |
| Empty (no filter) | EmptyState tương ứng |
| Empty (filtered) | "Không tìm thấy" + CTA xóa filter |
| Status changed | Toast "Đã cập nhật trạng thái" |
| Not found | EmptyState: "Không tồn tại" |
