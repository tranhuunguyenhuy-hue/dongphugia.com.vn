# Monitoring Rules — Đông Phú Gia

## Purpose
Conventions cho logging, error reporting, và performance monitoring. Phù hợp với Vercel + Supabase stack — không over-engineer. Áp dụng cho Claude Code + Antigravity.

---

## Rules

### 1. Console Error Format

**Pattern:** `[ACTION][ENTITY][ERROR_TYPE]: message`

```typescript
// Format chuẩn — tất cả server-side errors
console.error('[CREATE][PRODUCT][ZOD_ERROR]: Validation failed', {
  action: 'createProduct',
  input: { name: data.get('name'), slug: data.get('slug') },  // KHÔNG log passwords/tokens
  error: error.errors,
})

console.error('[UPDATE][COLLECTION][DB_ERROR]: Prisma update failed', {
  action: 'updateCollection',
  id: collectionId,
  error: error.message,   // OK: Prisma error message không chứa sensitive data
  code: error.code,       // P2002, P2025, etc.
})

console.error('[FETCH][PUBLIC_API][CACHE_MISS]: Product not found', {
  slug,
  timestamp: new Date().toISOString(),
})
```

**Action tokens:** `CREATE` | `UPDATE` | `DELETE` | `FETCH` | `AUTH` | `UPLOAD` | `CRAWL`

**Entity tokens:** `PRODUCT` | `COLLECTION` | `BLOG_POST` | `QUOTE_REQUEST` | `USER` | `PUBLIC_API`

**Error type tokens:** `ZOD_ERROR` | `DB_ERROR` | `AUTH_ERROR` | `NOT_FOUND` | `NETWORK_ERROR` | `VALIDATION_ERROR`

### 2. Không Log Sensitive Data

```typescript
// ✅ ĐÚNG — log action context, bỏ sensitive fields
console.error('[AUTH][USER][AUTH_ERROR]: Login failed', {
  action: 'loginAction',
  // password: data.password  ← KHÔNG BAO GIỜ log
})

// ✅ ĐÚNG — log DB error code, không log connection string
console.error('[CREATE][PRODUCT][DB_ERROR]: Failed', {
  code: error.code,          // P2002
  // url: process.env.DATABASE_URL  ← KHÔNG BAO GIỜ
})
```

**Không được log:**
- Passwords, tokens, cookies, session values
- `process.env.DATABASE_URL`, `AUTH_SECRET`, `ADMIN_PASSWORD`
- Full request body (có thể chứa PII)
- Supabase service role key

### 3. Server Action Error Pattern

```typescript
// src/lib/{entity}-actions.ts
export async function createProduct(data: FormData) {
  try {
    const validated = ProductSchema.parse(Object.fromEntries(data))
    const product = await prisma.product.create({ data: validated })
    revalidatePath('/admin/products')
    return { success: true, id: product.id }
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Validation errors: không cần log (user input error)
      return { success: false, error: error.errors[0].message }
    }
    // System errors: log để debug production issues
    console.error('[CREATE][PRODUCT][DB_ERROR]: Create failed', {
      action: 'createProduct',
      name: data.get('name'),    // OK: tên sản phẩm không sensitive
      prismaCode: (error as any)?.code,
    })
    return { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' }
  }
}
```

### 4. Performance — Web Vitals Targets

| Metric | Target | Đo bằng |
|--------|--------|---------|
| LCP (Largest Contentful Paint) | < 2.5s | Vercel Analytics, Lighthouse |
| CLS (Cumulative Layout Shift) | < 0.1 | Vercel Analytics, Lighthouse |
| FID / INP (Input responsiveness) | < 100ms | Vercel Analytics |
| TTFB (Time to First Byte) | < 800ms | Vercel dashboard |

**Nguyên nhân thường gặp và fix:**
```
LCP cao  → Thêm priority={true} cho hero Image, preload fonts
CLS cao  → Thêm width/height cho Image, tránh layout shift khi load
FID cao  → Tách large Client Components, lazy load heavy UI
TTFB cao → Check ISR cache hit, check Supabase query performance
```

### 5. Vercel Analytics

Đã setup trong `src/app/layout.tsx` — kiểm tra data tại Vercel Dashboard → Analytics tab.
Nếu chưa có: thêm `<Analytics />` từ `@vercel/analytics/react` và `<SpeedInsights />` từ `@vercel/speed-insights/next`.

### 6. Supabase Connection Health

```typescript
// Pattern kiểm tra DB connection (dùng trong health check hoặc startup)
export async function checkDbConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('[FETCH][DB][NETWORK_ERROR]: Supabase connection failed', {
      timestamp: new Date().toISOString(),
      // Không log DATABASE_URL
    })
    return false
  }
}
```

### 7. Khi nào cần báo PM

| Severity | Trigger | Action |
|----------|---------|--------|
| 🔴 Ngay | Vercel build fail, auth bypass, DB connection fail | Comment Linear + tag PM |
| 🟡 Trong ngày | LCP > 4s trên trang chính, P2024 pool timeout nhiều lần | Tạo Linear issue High |
| 🟢 Track | CLS > 0.1 trên 1 route, console.error mới trong dev | Tạo Linear issue Medium |

---

## Examples

### ✅ Copy-paste — Server Action với đầy đủ logging

```typescript
export async function deleteProduct(id: number) {
  try {
    await prisma.product.delete({ where: { id } })
    revalidatePath('/admin/products')
    revalidatePath('/gach-op-lat')
    return { success: true }
  } catch (error) {
    if ((error as any)?.code === 'P2025') {
      return { success: false, error: 'Sản phẩm không tồn tại.' }
    }
    console.error('[DELETE][PRODUCT][DB_ERROR]: Delete failed', {
      productId: id,
      prismaCode: (error as any)?.code,
    })
    return { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' }
  }
}
```

### ✅ Copy-paste — Public API với not-found logging

```typescript
export const getProductBySlug = cache(async (slug: string) => {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: { collection: true },
  })
  if (!product) {
    // Info level — not an error, just 404
    console.info('[FETCH][PRODUCT][NOT_FOUND]: Product not found', { slug })
  }
  return product
})
```

---

## Anti-patterns

- ❌ `console.log(process.env.AUTH_SECRET)` — secrets trong logs leak vào Vercel log drain
- ❌ `console.error(error)` không có context — không biết lỗi từ đâu khi debug production
- ❌ `console.log(JSON.stringify(requestBody))` — có thể chứa passwords, PII
- ❌ Ignore P2024 Prisma errors (connection pool timeout) — symptom của load vấn đề cần fix
- ❌ Không check Vercel Analytics sau deploy lớn — có thể CLS/LCP tăng mà không biết
- ❌ `console.error` trong Client Components mà không có error boundary — lỗi silent trên production
