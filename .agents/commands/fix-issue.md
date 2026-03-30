# /fix-issue — Bug Fix Procedure

## Trigger
- Linear issue có label **Bug**
- Runtime error trên production hoặc local dev
- UI broken, form không submit, data hiển thị sai
- `npm run build` hoặc `npx tsc --noEmit` có errors

---

## Preconditions

```bash
□ Đã đọc toàn bộ Linear issue: description + steps to reproduce + screenshots
□ Đã đọc CLAUDE.md mục 10 (Gotchas & Lessons Learned)
□ git pull origin main  → code mới nhất
□ Có thể reproduce bug ở local → nếu không reproduce được, hỏi PM thêm thông tin
```

---

## Steps

### Step 1 — Reproduce
```bash
# Xác định EXACT steps to reproduce
1. Mở [URL]
2. Thực hiện [hành động]
3. Observe: [lỗi xảy ra]
Expected: [behavior đúng]
```

Nếu không reproduce được → **DỪNG**, comment hỏi PM mô tả thêm.

### Step 2 — Kiểm tra Lessons Learned
Trước khi debug, xem CLAUDE.md mục 10:
```
□ NEXT_REDIRECT error → redirect() trong server action programmatic call
□ Prisma types cũ → npx prisma generate + restart
□ P2002 sau seed → setval sequence reset
□ slugify("Đá") → "-" → dùng slugify() từ @/lib/utils
□ WASM build error → thiếu back-relations
□ params undefined → Next.js 15: await params
```

### Step 3 — Root Cause Analysis

**Cho runtime errors:**
```bash
# Check browser console → Network tab → Response
# Check server logs: npm run dev → terminal output
# Trace từ symptom → component → server action → DB
```

**Cho TypeScript/Build errors:**
```bash
npx tsc --noEmit 2>&1 | head -100
# Nhóm errors:
# - Import errors → fix trước (block compilation)
# - Type mismatch → fix types, không dùng 'any'
# - Missing props → fix component interface
# - Unknown property → check Prisma schema vs code
```

**Cho Prisma errors:**
```
P2002 → Unique constraint → báo user "slug đã tồn tại"
P2025 → Record not found → báo user "không tìm thấy"
P2003 → Foreign key → báo user "không thể xóa vì có dữ liệu liên quan"
```

### Step 4 — Fix
- Fix ở **1 chỗ duy nhất** — không lan rộng sang files khác nếu không cần
- Không dùng `any` hoặc `// @ts-ignore` để bypass
- Không thêm features ngoài scope bug fix

### Step 5 — Verify Fix
```bash
# Reproduce lại exact steps → lỗi không còn xảy ra
npx tsc --noEmit          # 0 errors
npm run lint              # no new errors
```

**Manual verify theo loại bug:**
```
□ Form bug: submit form → success/error đúng
□ Display bug: data hiển thị đúng ở mobile + desktop
□ Build bug: npm run build → "Compiled successfully"
□ Prisma bug: CRUD operation hoạt động end-to-end
```

### Step 6 — Commit
```bash
git add [chỉ files liên quan đến fix]
git commit -m "fix: [mô tả ngắn root cause] (LEO-XXX)"

# Ví dụ:
# fix: resolve NEXT_REDIRECT error in product server action (LEO-295)
# fix: await params in product detail page Next.js 15 (LEO-302)
# fix: reset sequence after seed causing P2002 on create (LEO-288)
```

---

## Verify

```bash
✅ Bug không còn reproduce được
✅ npx tsc --noEmit → 0 errors
✅ Không có regression: các feature liên quan vẫn hoạt động
✅ Commit message rõ ràng, có issue reference
```

---

## Output Template

Comment lên Linear issue sau khi fix:

```
✅ [Claude] Bug fixed

Root cause: [1-2 câu mô tả nguyên nhân gốc]
Fix: [thay đổi cụ thể ở đâu, dòng nào]
Commit: [hash] — [message]

Verify:
□ Reproduce steps → lỗi không còn: ✅
□ npx tsc --noEmit: ✅ (0 errors)
□ [Manual test cụ thể]: ✅

Notes: [Bất kỳ gotcha nào cần add vào CLAUDE.md mục 10?]
```

Nếu fix phức tạp hoặc cần thay đổi ngoài scope:
```
⚠️ [Claude] Fix cần thêm thông tin

Bug: [mô tả]
Root cause tìm được: [...]
Nhưng fix đúng cần: [thay đổi scope lớn hơn / cần PM decision]

Tôi đề xuất: [approach A] hoặc [approach B]
Cần PM confirm trước khi tiếp tục.
```
