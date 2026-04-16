# 🐛 Error Log - dongphugia

> Tập hợp tất cả lỗi xảy ra trong quá trình phát triển (Auto-generated).

---

## Thống kê nhanh
- **Tổng lỗi**: 4
- **Đã sửa**: 4

---

## [2026-04-15 09:18] — Blog: Ảnh không upload được + lỗi hiển thị ảnh

### Lỗi 1: Supabase key sai tên biến môi trường

- **Type**: Integration / Agent Error
- **Severity**: Critical
- **File**: `src/lib/supabase.ts`
- **Agent**: Antigravity Orchestrator
- **Root Cause**: Code gọi `NEXT_PUBLIC_SUPABASE_ANON_KEY` nhưng `.env.local` chỉ có `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (tên key mới của Supabase). Kết quả: client khởi tạo với `'placeholder-anon-key'` → mọi upload đều fail silently.
- **Error Message**:
  ```
  Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
  Upload fails with: invalid API key
  ```
- **Fix Applied**: `supabase.ts` fallback đọc cả `NEXT_PUBLIC_SUPABASE_ANON_KEY || NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- **Prevention**: Khi thêm Supabase vào dự án, luôn kiểm tra tên key trong Supabase dashboard → dự án mới dùng `PUBLISHABLE_DEFAULT_KEY` thay cho `ANON_KEY`
- **Status**: Fixed ✅

### Lỗi 2: Upload phía client không có permission (RLS/anon key)

- **Type**: Integration
- **Severity**: High
- **File**: `src/components/ui/image-uploader.tsx`, `src/components/ui/rich-text-editor.tsx`
- **Agent**: Antigravity Orchestrator
- **Root Cause**: Upload dùng anon key phía client. Supabase RLS policy trên bucket `images` không cho phép unauthenticated users upload → cần service role key (chỉ dùng được phía server).
- **Fix Applied**: Tạo API route server-side `/api/upload-image` dùng `SUPABASE_SERVICE_ROLE_KEY` để bypass RLS. `ImageUploader` và `RichTextEditor` refactor để `fetch('/api/upload-image')` thay vì gọi Supabase SDK trực tiếp.
- **Prevention**: Mọi thao tác mutate Supabase Storage từ admin phải đi qua server-side route với service key.
- **Status**: Fixed ✅

### Lỗi 3: Ảnh trong prose/blog content bị vỡ layout

- **Type**: Logic (CSS)
- **Severity**: Medium
- **File**: `src/app/globals.css`
- **Root Cause**: `.prose img` thiếu `max-width: 100%`, `width: 100%`, `height: auto`, `display: block` → ảnh chèn từ TipTap bị tràn container hoặc không responsive.
- **Fix Applied**: Thêm 4 properties trên vào `.prose img` rule.
- **Prevention**: Luôn include `max-width: 100%; height: auto` khi có custom prose styles.
- **Status**: Fixed ✅

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
