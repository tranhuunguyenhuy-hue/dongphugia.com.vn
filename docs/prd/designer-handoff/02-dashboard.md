# 02 — Dashboard `/`

---

## Tổng quan
Dashboard hiển thị đầu tiên sau login. Gồm 4 khu vực chính:
1. **Biểu đồ doanh thu** — theo ngày/tuần/tháng/năm
2. **Action Items** — Báo giá chờ duyệt + Đơn hàng chờ xác nhận
3. **Google Analytics** — Embed hoặc API (🔲 tương lai)
4. **Quick Lists** — Chương trình KM + SP bán chạy

---

## DB Contract

```sql
-- Revenue chart
SELECT DATE(created_at) as date, SUM(total) as revenue
FROM orders WHERE status = 'delivered' AND payment_status = 'paid'
GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30;

-- Pending quotes count
SELECT COUNT(*) FROM quote_requests WHERE status = 'pending';

-- Pending orders count
SELECT COUNT(*) FROM orders WHERE status = 'pending';

-- Top products (by quote frequency)
SELECT p.name, p.sku, COUNT(qi.id) as quote_count
FROM quote_items qi JOIN products p ON qi.product_id = p.id
GROUP BY p.id ORDER BY quote_count DESC LIMIT 10;

-- Bestsellers (by order frequency)
SELECT p.name, p.sku, SUM(oi.quantity) as sold
FROM order_items oi JOIN products p ON oi.product_id = p.id
JOIN orders o ON oi.order_id = o.id WHERE o.status = 'delivered'
GROUP BY p.id ORDER BY sold DESC LIMIT 10;
```

---

## Wireframe — Desktop Layout

Trang chia thành grid 2 cột:

### Khu vực 1: Biểu đồ Doanh thu (full width)
- **Component**: Area/Bar chart (Recharts hoặc Chart.js)
- **Tabs filter**: `[Ngày]` `[Tuần]` `[Tháng]` `[Năm]`
- **Hiển thị**: Tổng doanh thu + so sánh kỳ trước (% tăng/giảm)
- **Trạng thái**: Skeleton chart khi loading, "Chưa có dữ liệu" nếu empty

### Khu vực 2: Action Items (2 cards ngang)

**Card "Báo giá chờ duyệt"**:

| Cột | Data | Width |
|-----|------|-------|
| Mã | `quote_number` | 140px |
| Khách | `name` | flex |
| SĐT | `phone` | 120px |
| Số SP | `quote_items.length` | 60px |
| Thời gian | `created_at` (relative) | 100px |

- Footer: `[Xem tất cả →]` link to `/quotes?status=pending`
- Max 5 rows

**Card "Đơn hàng chờ xác nhận"**:

| Cột | Data | Width |
|-----|------|-------|
| Mã đơn | `order_number` | 140px |
| Khách | `customer_name` | flex |
| Tổng | `total` (VND) | 100px |
| Thanh toán | `payment_status` | 90px |
| Thời gian | `created_at` (relative) | 100px |

- Footer: `[Xem tất cả →]` link to `/orders?status=pending`
- Max 5 rows

### Khu vực 3: Quick Stats (2 cards ngang)

**Card "SP bán chạy"**:
- Top 5 sản phẩm by số lượng bán
- Hiển thị: Ảnh mini + Tên + SKU + Số lượng đã bán

**Card "Chương trình KM"** (🔲 tương lai):
- Placeholder: "Chưa có chương trình khuyến mãi nào"
- CTA: "Tạo chương trình đầu tiên" (disabled, tooltip "Đang phát triển")

### Khu vực 4: Google Analytics (🔲 tương lai)
- Placeholder card: "Kết nối Google Analytics"
- Mô tả: "Theo dõi lượt truy cập, nguồn traffic, hành vi người dùng"
- CTA: "Cài đặt → Tích hợp" link to `/settings/integrations`

---

## States

| State | Hiển thị |
|-------|---------|
| Loading | Skeleton chart + skeleton tables |
| Empty (no orders) | EmptyState cards thay bảng |
| Data loaded | Charts + tables đầy đủ |
| GA not connected | Placeholder card với CTA kết nối |
