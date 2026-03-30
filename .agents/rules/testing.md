# Testing Rules — Đông Phú Gia

## Purpose
Chuẩn hóa quy trình verify code trước khi commit: TypeScript check, build verify, và manual testing checklist. Áp dụng cho Claude Code + Antigravity.

---

## Rules

### 1. TypeScript Check — BẮT BUỘC trước mỗi commit

```bash
npx tsc --noEmit
```

- **Zero errors** mới được phép commit
- KHÔNG dùng `any` hoặc `@ts-ignore` để bypass
- Chạy sau mỗi batch thay đổi để track tiến độ

```bash
# Workflow chuẩn
npx tsc --noEmit          # Phải pass (0 errors)
git diff --staged          # Review changes
git commit -m "..."
```

### 2. Build Verify (trước khi deploy)

```bash
npm run build
```

- Cần có DB connection (env vars)
- Phải pass trước khi deploy lên Vercel
- Nếu fail do WASM/Prisma → check back-relations trong schema

```bash
# Kiểm tra errors
npx tsc --noEmit 2>&1 | head -100

# Full build
npm run build 2>&1 | tail -50
```

### 3. Lint Check

```bash
npm run lint
```

- Chạy trước commit để catch unused imports, missing deps
- Fix warnings nếu chúng liên quan đến code đang sửa

### 4. Pre-commit Checklist (bắt buộc)

```bash
# Chạy theo thứ tự
npx tsc --noEmit       # ✅ Zero TypeScript errors
npm run lint           # ✅ No lint errors
git status             # ✅ Chỉ có files liên quan đến task
git diff --staged      # ✅ Review lần cuối trước commit
```

### 5. Manual Testing — Admin CMS

Sau khi implement Admin CRUD feature:

```
□ Tạo mới record → form submit → redirect/thông báo thành công
□ List page hiển thị record vừa tạo
□ Edit record → form load đúng data hiện tại
□ Edit record → submit → data cập nhật đúng
□ Delete record → confirm dialog → xóa thành công → không còn trong list
□ Validation: submit form trống → hiện error message Tiếng Việt
□ Validation: slug trùng → hiện "Slug đã tồn tại"
□ Image upload (nếu có) → preview hiển thị đúng
```

### 6. Manual Testing — Public Pages

Sau khi implement public page:

```
□ Desktop (1280px+): layout đúng, không bị overflow
□ Tablet (768px): layout responsive, không có horizontal scroll
□ Mobile (375px): layout mobile-first, buttons đủ touch target
□ Loading state: không có layout shift (CLS)
□ Empty state: hiển thị message phù hợp khi không có data
□ Filter/Search (nếu có): URL params update đúng, kết quả đúng
□ Breadcrumbs/Navigation: active state đúng
```

### 7. Manual Testing — Server Actions

Sau khi implement/sửa Server Actions:

```
□ Happy path: data hợp lệ → success response → UI update
□ Validation error: data thiếu/sai → error message hiển thị đúng
□ Duplicate slug: P2002 → thông báo slug đã tồn tại
□ Not found: update/delete id không tồn tại → error message
□ Revalidation: public page hiển thị data mới sau mutation
```

### 8. Regression Check

Khi sửa code liên quan đến:
- `src/lib/utils.ts` → test `slugify()` với các trường hợp Tiếng Việt
- `src/lib/prisma.ts` → verify connection không bị duplicate instances
- Auth flow → test login/logout cycle đầy đủ
- Tailwind globals.css → check các component khác không bị ảnh hưởng

### 9. TypeScript Error Triage

```bash
# Xem toàn bộ errors theo file
npx tsc --noEmit 2>&1

# Nhóm errors theo loại để fix theo batch
# Thứ tự ưu tiên:
# 1. Import errors (block compilation)
# 2. Type mismatch (thường nhất)
# 3. Missing properties
# 4. Unused variables/imports (warning → error với strict)
```

---

## Examples

### ✅ Đúng — Quy trình commit chuẩn
```bash
# 1. Implement xong
npx tsc --noEmit          # 0 errors ✅

# 2. Lint
npm run lint              # No errors ✅

# 3. Review staged
git add src/lib/product-actions.ts
git diff --staged

# 4. Commit
git commit -m "feat: add product CRUD server actions (LEO-XXX)"
```

### ✅ Đúng — Fix TypeScript errors theo batch
```bash
npx tsc --noEmit 2>&1 | head -50
# Found 12 errors in 3 files

# Fix file 1
# ...edit...
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
# 8 errors remaining

# Fix file 2
# ...edit...
npx tsc --noEmit
# 0 errors ✅
```

### ❌ Sai
```bash
# Commit khi có TypeScript errors
npx tsc --noEmit   # 5 errors
git commit -m "feat: new feature"   # ❌ Vi phạm

# Dùng any để bypass
const data: any = await prisma.product.findMany()  # ❌
```

---

## Anti-patterns

- ❌ Commit khi `npx tsc --noEmit` có errors
- ❌ Dùng `any` hoặc `// @ts-ignore` để bypass TypeScript errors
- ❌ `npm run build` fail mà vẫn deploy
- ❌ Chỉ test happy path, bỏ qua validation và error cases
- ❌ Skip manual testing khi thay đổi form submit logic
- ❌ Không test mobile layout cho public pages
