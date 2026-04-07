# 🐛 Error Log - dongphugia

> Tập hợp tất cả lỗi xảy ra trong quá trình phát triển (Auto-generated).

---

## Thống kê nhanh
- **Tổng lỗi**: 1
- **Đã sửa**: 1

---

## [2026-04-03 18:21] — Wrong Domain TLD Assumption in Implementation Plan (LEO-363)

- **Type**: Agent (Hallucination / Misinterpretation)
- **Severity**: Medium
- **File**: `implementation_plan.md` (LEO-363 scope), `pm_report_legacy_domains.md`
- **Agent**: Antigravity Orchestrator
- **Root Cause**: Khi soạn plan CDN, Agent rút gọn domain `.com.vn` thành `.com` mà không verify domain thực tế của dự án. Agent giả định `cdn.dongphugia.com` nhưng domain thực là `dongphugia.com.vn` → subdomain đúng phải là `cdn.dongphugia.com.vn`.
- **Error Message**:
  ```
  Plan viết: cdn.dongphugia.com    ← không tồn tại / không thuộc dự án
  Đúng phải: cdn.dongphugia.com.vn ← TLD Việt Nam của domain chính
  ```
- **Fix Applied**: Cập nhật implementation plan LEO-363 với domain đúng `cdn.dongphugia.com.vn`. PM đã phát hiện trước khi implement nên không có code nào bị ảnh hưởng.
- **Prevention**:
  1. **Luôn đọc CLAUDE.md / PROJECT-STATUS.md** trước khi viết bất kỳ domain/URL nào vào plan
  2. **Không tự suy diễn TLD** — `.com.vn` ≠ `.com`, phải lấy từ source of truth (env var, DNS config, hoặc hỏi PM)
  3. **Checklist trước khi viết plan có domain**: Verify `NEXT_PUBLIC_SITE_URL` trong `.env.local`
- **Status**: Fixed ✅

---

<!-- Errors sẽ được agent tự động ghi vào đây -->
