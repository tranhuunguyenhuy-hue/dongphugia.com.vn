# 🐛 Error Log - dongphugia

> Tập hợp tất cả lỗi xảy ra trong quá trình phát triển (Auto-generated).

---

## Thống kê nhanh
- **Tổng lỗi**: 1
- **Đã sửa**: 0

---

<!-- Errors sẽ được agent tự động ghi vào đây -->

## [2026-03-03 05:22] - Hình ảnh Public bị lỗi 400 (vietceramics.com)

- **Type**: Integration/Runtime
- **Severity**: Medium
- **File**: `src/components/ui/product-card.tsx`
- **Agent**: frontend-specialist, devops-engineer
- **Root Cause**: Firewall chống spam/hotlink của Vietceramics.com block request load ảnh từ referer/user-agent không hợp lệ (trả về mã 400 Bad Request). Next.js Native `<img src>` vẫn bị chặn do thiếu proxy logic tải ẩn.
- **Error Message**: `Failed to load resource: the server responded with a status of 400 ()`
- **Fix Applied**: Deferred dựa theo chỉ thị của Sếp (sẽ nghiên cứu giải pháp Cào Ảnh Lưu Trữ Ngang Hàng thay vì Truy Cập Trực Tiếp). 
- **Prevention**: Tránh sử dụng hotlink tài nguyên từ các website có quy tắc WAF/CloudFlare quá gắt.
- **Status**: Pending
