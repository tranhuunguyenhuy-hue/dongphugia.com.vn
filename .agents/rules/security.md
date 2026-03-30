# Security Rules — Đông Phú Gia

## Purpose
Chuẩn hóa quản lý secrets, auth pattern, và các blocked commands. Ngăn chặn security vulnerabilities phổ biến. Áp dụng cho Claude Code + Antigravity.

---

## Rules

### 1. Environment Variables — KHÔNG hardcode secrets
```typescript
// ✅ ĐÚNG — đọc từ env
const secret = process.env.AUTH_SECRET!
const dbUrl = process.env.DATABASE_URL!

// ❌ SAI — hardcode
const secret = 'my-secret-key-12345'
```

**Required env vars:**
```bash
DATABASE_URL=          # Supabase pooler (pgbouncer=true)
DIRECT_URL=            # Supabase direct (dùng cho prisma db pull)
AUTH_SECRET=           # Random secret cho HMAC
ADMIN_PASSWORD=        # Mật khẩu /admin login
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

**Rules:**
- `NEXT_PUBLIC_*` — safe để expose ra browser
- Không có prefix `NEXT_PUBLIC_` — server-only, KHÔNG truyền vào Client Components
- Env vars mới cần hỏi PM để set trên Vercel trước khi deploy

### 2. HMAC Auth Pattern
```typescript
// src/lib/admin-auth.ts — pattern đang dùng
import { createHmac } from 'crypto'

function generateToken(password: string, secret: string): string {
  return createHmac('sha256', secret).update(password).digest('hex')
}

// Cookie name: 'dpg-admin-session'
// Guard: verifyAdminSession() trong admin layout
```

- KHÔNG thay đổi auth flow mà không có PM approval
- KHÔNG expose `/admin/*` routes mà không có `verifyAdminSession()`

### 3. Supabase RLS Awareness
- Prisma dùng `DATABASE_URL` với service role → bypass RLS
- Public client (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) → subject to RLS
- Image uploads qua Supabase Storage: bucket `images` (public read)
- KHÔNG upload files nhạy cảm lên Supabase Storage

### 4. Image Upload — Chỉ Supabase Storage
```typescript
// ✅ ĐÚNG — Supabase Storage
// Domain: tygjmrhandbffjllxveu.supabase.co
// Component: src/components/ui/image-uploader.tsx

// ❌ SAI — public/uploads/ (broken trên Vercel)
// public/uploads/ không tồn tại sau deploy
```

### 5. SQL Injection Prevention
```typescript
// ✅ ĐÚNG — Prisma parameterized queries
const products = await prisma.product.findMany({
  where: { slug: userInput }  // Auto-escaped
})

// ✅ ĐÚNG — Raw query với parameters
await prisma.$executeRaw`
  SELECT setval('products_id_seq', ${maxId})
`

// ❌ SAI — String interpolation trong raw SQL
await prisma.$executeRawUnsafe(`SELECT * FROM products WHERE slug = '${userInput}'`)
```

### 6. XSS Prevention
- Không dùng `dangerouslySetInnerHTML` với user input
- TipTap editor output (blog): sanitize trước khi render
- Search params từ URL: validate với Zod trước khi dùng

```typescript
// ✅ ĐÚNG — Validate search params
const SearchSchema = z.object({
  collection: z.string().optional(),
  color: z.string().optional(),
})
const filters = SearchSchema.parse(searchParams)
```

### 7. Blocked Commands — KHÔNG BAO GIỜ tự ý chạy

```bash
# ❌ Xóa production data
DELETE FROM products;
DROP TABLE products;
TRUNCATE products CASCADE;

# ❌ Thay đổi auth
ALTER TABLE admin_users ...

# ❌ Expose secrets
console.log(process.env.AUTH_SECRET)
console.log(process.env.DATABASE_URL)
```

### 8. `.env` File
- KHÔNG commit `.env` hoặc `.env.local`
- `.gitignore` đã có `.env*` — kiểm tra trước khi `git add`
- Secrets chỉ qua Vercel Environment Variables (Dashboard) hoặc local `.env.local`

---

## Examples

### ✅ Đúng — Server-only env var
```typescript
// src/lib/admin-auth.ts (server-only)
const AUTH_SECRET = process.env.AUTH_SECRET
if (!AUTH_SECRET) throw new Error('AUTH_SECRET not configured')
```

### ✅ Đúng — Public env var
```typescript
// src/components/floating-contact.tsx (client component)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
// Safe — có prefix NEXT_PUBLIC_
```

### ❌ Sai
```typescript
// ❌ Server secret trong Client Component
'use client'
const secret = process.env.AUTH_SECRET  // undefined ở browser — nhưng nguy hiểm

// ❌ Raw SQL với interpolation
const results = await prisma.$queryRawUnsafe(
  `SELECT * FROM users WHERE name = '${req.body.name}'`
)
```

---

## Anti-patterns

- ❌ Hardcode API keys, passwords, connection strings trong code
- ❌ `console.log` env vars (có thể leak vào logs)
- ❌ `dangerouslySetInnerHTML` với content từ user input hoặc URL params
- ❌ Skip `verifyAdminSession()` trong bất kỳ admin route nào
- ❌ Commit `.env.local` vào git
- ❌ Thêm env var mới mà không báo PM để set trên Vercel
