# /new-entity — Prisma Model + CRUD Scaffold

## Trigger
- Tạo bảng DB mới + đầy đủ CRUD (Admin CMS + Server Actions + Public API)
- Linear issue có pattern: "Thêm [entity] vào hệ thống"
- Workflow 7.1 trong CLAUDE.md

---

## Preconditions

```bash
□ Đã đọc Linear issue: biết rõ entity cần tạo, fields, relations
□ Đã đọc prisma/schema.prisma để hiểu patterns hiện tại (53 models)
□ Đã đọc rules: database.md, api-conventions.md, naming-conventions.md
□ PM đã xác nhận scope (không tự thêm entity ngoài issue)
□ Biết entity có cần image field không → cần ImageUploader
□ Biết entity có public page không → cần public-api-*.ts
```

---

## Steps

### Step 1 — Thiết kế Schema
```sql
-- Tham khảo database.md cho naming conventions
-- Model: PascalCase singular → Prisma
-- Table: snake_case plural → @map
-- Fields: camelCase → Prisma, snake_case → @map

-- Template SQL:
CREATE TABLE {table_name} (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  status      VARCHAR(50)  NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_{table}_slug ON {table_name}(slug);
CREATE INDEX idx_{table}_status ON {table_name}(status);
```

Checklist schema:
```
□ id SERIAL PRIMARY KEY
□ slug UNIQUE + index
□ status field ('active' | 'inactive') nếu cần soft delete
□ created_at + updated_at
□ Foreign keys có index
□ Back-relations đủ (quan trọng — thiếu → WASM build error)
```

### Step 2 — Tạo bảng trong DB
```bash
# 1. Lưu SQL vào file
# scripts/db/migration-{YYYY-MM-DD}-add-{entity}.sql

# 2. Chạy trong Supabase Dashboard → SQL Editor
# 3. Verify trong Supabase Table Editor → bảng xuất hiện
```

⚠️ KHÔNG dùng `npx prisma migrate`

### Step 3 — Sync Prisma
```bash
npx prisma db pull     # Sync schema từ DB
npx prisma generate    # Regenerate client (BẮT BUỘC)
# Restart dev server để clear Turbopack cache
```

Kiểm tra `prisma/schema.prisma`:
```
□ Model mới xuất hiện với đúng tên PascalCase
□ Có @@map("{table_name}")
□ Fields có @map("snake_case") đúng
□ Back-relations đã có
```

### Step 4 — Server Actions
Tạo `src/lib/{entity}-actions.ts`:

```typescript
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'

// Zod schema — error messages Tiếng Việt
const {Entity}Schema = z.object({
  name: z.string().min(1, 'Tên không được trống'),
  slug: z.string().min(1, 'Slug không được trống')
    .regex(/^[a-z0-9-]+$/, 'Slug chỉ dùng chữ thường, số, dấu gạch ngang'),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
})

export async function create{Entity}(data: FormData) {
  try {
    const validated = {Entity}Schema.parse(Object.fromEntries(data))
    const item = await prisma.{entity}.create({ data: validated })
    revalidatePath('/admin/{entities}')
    return { success: true, id: item.id }
  } catch (error) {
    if (error instanceof z.ZodError)
      return { success: false, error: error.errors[0].message }
    return { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' }
  }
}

export async function update{Entity}(id: number, data: FormData) { ... }
export async function delete{Entity}(id: number) { ... }
```

### Step 5 — Public API (nếu cần public page)
Tạo `src/lib/public-api-{entities}.ts`:

```typescript
import { cache } from 'react'
import { prisma } from '@/lib/prisma'

export const revalidate = 3600

export const get{Entity}List = cache(async () => {
  return prisma.{entity}.findMany({
    where: { status: 'active' },
    orderBy: { createdAt: 'desc' },
  })
})

export const get{Entity}BySlug = cache(async (slug: string) => {
  return prisma.{entity}.findUnique({ where: { slug } })
})
```

### Step 6 — Admin CMS
Tạo theo Admin CRUD Pattern:

```
src/app/admin/(dashboard)/{entities}/
  page.tsx                  # Server component — list
  {entity}-form.tsx         # Client component — create + edit
  {entity}-delete-button.tsx # Two-click delete
  new/page.tsx              # Create page
  [id]/page.tsx             # Edit page
```

Checklist:
```
□ page.tsx: await params/searchParams (Next.js 15)
□ {entity}-form.tsx: 'use client' + Zod client-side validation
□ ImageUploader nếu entity có image field
□ Update sidebar-nav.tsx nếu cần link mới
```

### Step 7 — Verify
```bash
npx tsc --noEmit          # 0 errors

# Manual test CRUD:
□ /admin/{entities} → list hiển thị
□ /admin/{entities}/new → tạo mới → thành công
□ /admin/{entities}/[id] → edit → lưu đúng
□ Delete button → confirm → xóa → không còn trong list
□ Validation: form trống → error Tiếng Việt
□ Slug trùng → "Slug đã tồn tại"
```

### Step 8 — Reset Sequence (nếu seed data)
```sql
-- Nếu đã seed data với explicit IDs:
SELECT setval('{table}_id_seq', (SELECT MAX(id) FROM {table_name}));
```

### Step 9 — Commit
```bash
git add [files cụ thể]
git commit -m "feat: add {entity} CRUD — DB + actions + admin CMS (LEO-XXX)"
```

---

## Verify

```bash
✅ npx tsc --noEmit → 0 errors
✅ CRUD hoạt động đầy đủ trong /admin
✅ Zod validation hiển thị đúng error Tiếng Việt
✅ Không có P2002 sequence error khi tạo record mới
✅ Back-relations đủ trong prisma/schema.prisma
```

---

## Output Template

Sau khi xong, nếu cần Antigravity làm frontend:

```
✅ [Claude] Backend ready cho Antigravity — LEO-XXX

Entity: {Entity}

Server Actions: src/lib/{entity}-actions.ts
  - create{Entity}(data: FormData) → { success: true, id }
  - update{Entity}(id, data: FormData) → { success: true }
  - delete{Entity}(id) → { success: true }

Public API: src/lib/public-api-{entities}.ts
  - get{Entity}List() → {Entity}[]
  - get{Entity}BySlug(slug) → {Entity} | null

Prisma type: import type { {Entity} } from '@prisma/client'

Admin CMS: /admin/{entities} (đã hoạt động)

📌 Notes:
  - Slug pattern: /^[a-z0-9-]+$/
  - Status: 'active' | 'inactive'
  - [Ghi chú đặc biệt]
```

Nếu không cần frontend (chỉ admin):
```
✅ [Claude] {Entity} CRUD hoàn thành — LEO-XXX
Admin CMS: /admin/{entities}
npx tsc --noEmit: ✅ (0 errors)
```
