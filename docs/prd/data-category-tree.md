# Cấu trúc Danh Mục — Đông Phú Gia V2
**Cập nhật:** 11/04/2026 | **Dành cho:** Designer
**Nguồn:** Database thực tế (production)

---

## Tổng quan

| # | Danh mục chính | Slug URL | Số danh mục con | Tổng sản phẩm |
|---|---------------|----------|----------------|---------------|
| 1 | 🚿 Thiết bị vệ sinh | `thiet-bi-ve-sinh` | 9 | 4.412 |
| 2 | 🍳 Thiết bị bếp | `thiet-bi-bep` | 8 | 570 |
| 3 | 💧 Vật liệu nước | `vat-lieu-nuoc` | 4 | 185 |
| 4 | 🪨 Gạch ốp lát | `gach-op-lat` | 5 | 111 |
| 5 | 🪵 Sàn gỗ | `san-go` | *(chưa có)* | 0 |
| | **Tổng cộng** | | **26** | **5.278** |

---

## 1. 🚿 Thiết bị vệ sinh
**Route:** `/thiet-bi-ve-sinh`
**Tổng:** 9 danh mục con — 4.412 sản phẩm

| # | Danh mục con | Slug URL | Số SP | Ghi chú |
|---|-------------|----------|-------|---------|
| 1 | Bồn Cầu | `bon-cau` | 957 | |
| 2 | Chậu Lavabo | `lavabo` | 827 | |
| 3 | Sen Tắm | `sen-tam` | **1.244** | Nhiều nhất |
| 4 | Bồn Tắm | `bon-tam` | 480 | |
| 5 | Phụ Kiện Phòng Tắm | `phu-kien-phong-tam` | 309 | |
| 6 | Vòi Chậu | `voi-chau` | 269 | |
| 7 | Bồn Tiểu | `bon-tieu` | 212 | |
| 8 | Vòi Nước | `voi-nuoc` | 97 | |
| 9 | Nắp Bồn Cầu | `nap-bon-cau` | 17 | Ít — cân nhắc hiển thị |

**Route subcategory:** `/thiet-bi-ve-sinh/{slug}`

> **Wireframe note:** 9 tabs — nên chia 2 row trên mobile hoặc horizontal scroll.

---

## 2. 🍳 Thiết bị bếp
**Route:** `/thiet-bi-bep`
**Tổng:** 8 danh mục con — 570 sản phẩm

| # | Danh mục con | Slug URL | Số SP | Ghi chú |
|---|-------------|----------|-------|---------|
| 1 | Vòi Rửa Chén | `voi-rua-chen` | **216** | Nhiều nhất |
| 2 | Thiết Bị Bếp Khác | `thiet-bi-bep-khac` | 123 | Label chung |
| 3 | Chậu Rửa Chén | `chau-rua-chen` | 114 | |
| 4 | Bếp Điện Từ | `bep-dien-tu` | 41 | |
| 5 | Máy Hút Mùi | `may-hut-mui` | 23 | |
| 6 | Máy Rửa Chén | `may-rua-chen` | 20 | |
| 7 | Bếp Gas | `bep-gas` | 17 | |
| 8 | Lò Nướng | `lo-nuong` | 16 | |

**Route subcategory:** `/thiet-bi-bep/{slug}`

> **Wireframe note:** 8 tabs — vừa 1 row trên desktop, scroll ngang trên mobile.

---

## 3. 💧 Vật liệu nước
**Route:** `/vat-lieu-nuoc`
**Tổng:** 4 danh mục con — 185 sản phẩm

| # | Danh mục con | Slug URL | Số SP |
|---|-------------|----------|-------|
| 1 | Máy Nước Nóng | `may-nuoc-nong` | 73 |
| 2 | Lọc Nước | `loc-nuoc` | 73 |
| 3 | Bồn Chứa Nước | `bon-chua-nuoc` | 20 |
| 4 | Máy Bơm Nước | `may-bom-nuoc` | 19 |

**Route subcategory:** `/vat-lieu-nuoc/{slug}`

> **Wireframe note:** 4 tabs — đơn giản, 1 row cả desktop lẫn mobile.

---

## 4. 🪨 Gạch ốp lát
**Route:** `/gach-op-lat`
**Tổng:** 5 danh mục con — 111 sản phẩm

| # | Danh mục con | Slug URL | Số SP |
|---|-------------|----------|-------|
| 1 | Gạch Vân Đá Marble | `gach-van-da-marble` | 26 |
| 2 | Gạch Vân Đá Tự Nhiên | `gach-van-da-tu-nhien` | 23 |
| 3 | Gạch Vân Gỗ | `gach-van-go` | 12 |
| 4 | Gạch Thiết Kế Xi Măng | `gach-thiet-ke-xi-mang` | 26 |
| 5 | Gạch Trang Trí | `gach-trang-tri` | 24 |

**Route subcategory:** `/gach-op-lat/{slug}`

---

## 5. 🪵 Sàn gỗ
**Route:** `/san-go`
**Tổng:** 0 danh mục con — 0 sản phẩm *(chưa import data)*

> **Wireframe note:** Ẩn subcategory tabs. PM cần xác nhận subcategory trước khi design.

---

## Summary cho Mega Menu / Navigation

```
Thiết bị vệ sinh (9)     Thiết bị bếp (8)      Vật liệu nước (4)
├ Bồn Cầu                ├ Vòi Rửa Chén         ├ Máy Nước Nóng
├ Chậu Lavabo            ├ Chậu Rửa Chén        ├ Lọc Nước
├ Sen Tắm                ├ Bếp Điện Từ          ├ Bồn Chứa Nước
├ Bồn Tắm                ├ Máy Hút Mùi          └ Máy Bơm Nước
├ Phụ Kiện Phòng Tắm     ├ Máy Rửa Chén
├ Vòi Chậu               ├ Bếp Gas              Gạch ốp lát (5)
├ Bồn Tiểu               ├ Lò Nướng             ├ Gạch Vân Đá Marble
├ Vòi Nước               └ Thiết Bị Bếp Khác    ├ Gạch Vân Đá Tự Nhiên
└ Nắp Bồn Cầu                                   ├ Gạch Vân Gỗ
                                                 ├ Gạch Thiết Kế Xi Măng
Sàn gỗ (chưa có data)                           └ Gạch Trang Trí
```

---

*Tất cả data lấy trực tiếp từ PostgreSQL — không phỏng đoán.*
*Số sản phẩm là `is_active = true` tính đến 11/04/2026.*
