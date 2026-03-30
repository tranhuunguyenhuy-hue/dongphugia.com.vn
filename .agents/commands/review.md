# /review — Code Review Checklist

## Trigger
- Trước khi mark Linear issue là Done
- Khi PM yêu cầu review PR / code change
- Tự review code của mình trước khi commit (self-review)
- Khi review code của Antigravity

---

## Preconditions

```bash
□ Có code diff để review (git diff, PR, hoặc file list)
□ Biết context: đây là feature / bug fix / refactor / gì?
□ Đã đọc Linear issue để hiểu acceptance criteria
```

---

## Review Checklist

### 🔴 Critical — Blocks deploy nếu có

```bash
□ npx tsc --noEmit → 0 errors
   → Không dùng 'any', không có '@ts-ignore' không giải thích

□ npm run lint → no errors
   → Không có unused imports, missing dependencies

□ Không có secrets hardcoded
   → Không có API key, password, connection string trong code
   → Env vars đọc từ process.env.*

□ Không có 'redirect()' trong server action được gọi programmatically
   → Chỉ return { success: true/false }

□ Không có Prisma query trực tiếp trong page components
   → Phải qua public-api-*.ts

□ Không commit .env hoặc .env.local
```

### 🟡 Major — Cần fix trước khi Done

```bash
□ Server Actions có Zod validation
   → Mọi input từ FormData phải qua z.object({...}).parse()
   → Error messages Tiếng Việt

□ Public API có cache() + revalidate = 3600
   → Không query DB trực tiếp trong Server Component mà không cache

□ revalidatePath() sau mỗi mutation
   → Cả admin path và public path

□ Error handling đúng pattern
   → return { success: false, error: "..." } — không throw
   → Không expose error.message raw ra client

□ Prisma model có back-relations đủ
   → Thiếu back-relation → WASM build error trên Vercel

□ params được await trong Next.js 15+
   → const { slug } = await params  (không phải params.slug trực tiếp)

□ Image upload qua Supabase Storage
   → Không save vào public/uploads/
```

### 🔵 Minor — Fix nếu có thể, note nếu không

```bash
□ File naming đúng convention
   → kebab-case.tsx cho components, kebab-case.ts cho utils

□ Import order đúng (external → internal → types)

□ Slugify dùng slugify() từ @/lib/utils
   → Không tự implement slug logic

□ Tailwind không có tailwind.config.js
   → Config trong globals.css @theme {}

□ Admin CRUD có đủ 4 files: page.tsx, form.tsx, delete-button.tsx, new/page.tsx, [id]/page.tsx

□ Responsive check: mobile (375px) + tablet (768px) + desktop (1280px)
   → Dùng browser devtools resize
```

### 💡 Suggestion — Không bắt buộc

```bash
□ Comment cho logic phức tạp (Tiếng Anh)
□ Type tường minh hơn thay vì inference
□ Tách component nhỏ hơn nếu > 150 dòng
□ Extract magic number thành named constant
```

---

## Severity Decision Tree

```
Lỗi TypeScript / lint error?
  → 🔴 Critical — fix trước khi commit

Secrets trong code?
  → 🔴 Critical — fix ngay, KHÔNG commit

redirect() trong server action programmatic?
  → 🔴 Critical — gây NEXT_REDIRECT crash

Thiếu Zod validation?
  → 🟡 Major — security risk

Thiếu cache() trong public API?
  → 🟡 Major — performance issue + ISR không hoạt động

Sai naming convention?
  → 🔵 Minor — note nhưng không block

Suggestion về style/readability?
  → 💡 Suggestion — optional
```

---

## Verify

```bash
npx tsc --noEmit          # ✅ 0 errors
npm run lint              # ✅ no errors
git diff --staged         # ✅ chỉ files liên quan đến task
```

Manual:
```bash
□ Happy path: feature hoạt động đúng
□ Error path: validation error hiển thị đúng
□ Mobile layout (nếu có UI changes)
```

---

## Output Template

**Self-review (trước commit):**
```
Self-review LEO-XXX:
□ tsc: ✅
□ lint: ✅
□ No secrets: ✅
□ Zod validation: ✅
□ cache() on public APIs: ✅
□ revalidatePath() after mutations: ✅
→ Ready to commit
```

**Review code của người khác (comment trên Linear):**
```
🔍 [Claude] Code Review — LEO-XXX

🔴 Critical (cần fix trước deploy):
- [issue] tại [file:line]

🟡 Major (cần fix trước Done):
- [issue] tại [file:line]

🔵 Minor (nên fix):
- [issue] tại [file:line]

💡 Suggestions:
- [gợi ý]

Tổng: X critical, Y major, Z minor
→ [Approved / Request changes]
```
