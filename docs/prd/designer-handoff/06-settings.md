# 06 — Cài đặt `/settings`

---

## Tổng quan
Trang cài đặt hệ thống dành cho Admin. Layout dạng sidebar tabs bên trái + content bên phải.

### Tabs

```
[Thông tin]  [Hiển thị]  [Bảo trì]  [Tích hợp]
```

---

## Tab "Thông tin công ty"

Quản lý thông tin hiển thị trên website (hiện đang hardcoded).

| Field | Giá trị hiện tại | Component | DB (🔲 tương lai) |
|-------|------------------|-----------|-------------------|
| Tên công ty | "Đông Phú Gia" | Input | `site_settings` key-value |
| Địa chỉ | Hardcoded footer | Textarea | — |
| Hotline | Hardcoded | Input | — |
| Email | Hardcoded | Input | — |
| Zalo | Hardcoded | Input URL | — |
| Facebook | Hardcoded | Input URL | — |
| Logo | Static file | ImageUploader | — |

Button: `[Lưu thay đổi]`

---

## Tab "Hiển thị"

| Setting | Component | Ghi chú |
|---------|-----------|---------|
| Dark Mode | Switch | Toggle theme cho admin CMS |
| Ngôn ngữ | Select (VI/EN) | 🔲 Tương lai |
| Items per page | Select (10/25/50/100) | Default DataTable page size |

---

## Tab "Bảo trì"

| Setting | Component | Ghi chú |
|---------|-----------|---------|
| Chế độ bảo trì | Switch ON/OFF | Bật → frontend hiện trang maintenance |
| Thông báo bảo trì | Textarea | Custom message hiển thị trên frontend |
| Xóa Cache | Button destructive | Gọi `/api/revalidate` → xóa ISR cache |

Warning: "Xóa cache sẽ tải lại toàn bộ dữ liệu từ database. Trang web có thể chậm trong vài phút."

---

## Tab "Tích hợp" (🔲 Tương lai)

### MISA Accounting

| Field | Component | Ghi chú |
|-------|-----------|---------|
| Trạng thái | Badge (Chưa kết nối / Đã kết nối) | — |
| API Key | Input masked | — |
| API Endpoint | Input URL | — |
| Đồng bộ tự động | Switch | — |
| Lần sync cuối | Text | Timestamp |
| Button | `[Kiểm tra kết nối]` `[Đồng bộ ngay]` | — |

### Google Analytics

| Field | Component |
|-------|-----------|
| Measurement ID | Input (G-XXXXXXXXXX) |
| Trạng thái | Badge |

### Các tích hợp khác (🔲 xa)
- Zalo OA (ZNS notifications)
- VNPay (Cổng thanh toán)
- GHN/GHTK (Vận chuyển)

---

## States

| State | Hiển thị |
|-------|---------|
| Loading | Skeleton form |
| Save success | Toast "Đã lưu cài đặt" |
| Cache cleared | Toast "Đã xóa cache thành công" |
| MISA connected | Badge chuyển sang "Đã kết nối" (green) |
| MISA error | Alert destructive "Không thể kết nối" |
