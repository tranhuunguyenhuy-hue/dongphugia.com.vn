# Scripts

Các script tiện ích phục vụ phát triển dự án Đông Phú Gia.

## Cấu trúc

| Thư mục | Mục đích |
|---|---|
| `brands/` | Scrape, download logo/icon, kiểm tra brands từ nguồn bên ngoài |
| `db/` | Reset DB, drop data, kiểm tra categories/filters, schema SQL |
| `seed/` | Seed dữ liệu mẫu (banners, sản phẩm sàn gỗ, migrate hex colors) |
| `tdm-import/` | Import dữ liệu sản phẩm từ TDM.vn |
| `utils/` | Tiện ích khác (getcats) |

## Cách chạy

```bash
# Ví dụ chạy script bằng tsx
npx tsx scripts/db/reset-db.ts
npx tsx scripts/seed/seed-banners.ts
```

> **Lưu ý**: Đảm bảo file `.env` đã được cấu hình đúng trước khi chạy bất kỳ script nào.
