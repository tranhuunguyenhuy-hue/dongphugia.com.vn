# API Conventions — Đông Phú Gia

## Purpose
Chuẩn hóa Server Actions và Public API patterns. Đảm bảo nhất quán về data fetching, caching, error handling, và mutation flow. Áp dụng cho Claude Code.

---

## Rules

### 1. Server Actions — File Structure
```
src/lib/{entity}-actions.ts
```
- Zod schema + actions cùng 1 file
- `'use server'` directive ở đầu file
- Chỉ import Prisma từ `@/lib/prisma`

```typescript
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'

// Zod schema cùng file
const ProductSchema = z.object({
  name: z.string().min(1, 'Tên sản phẩm không được trống'),
  slug: z.string().min(1),
  price: z.number().positive().optional(),
})
```

### 2. Server Actions — Return Object Pattern
**KHÔNG dùng `redirect()` trong programmatic call** — gây `NEXT_REDIRECT` error khi được gọi từ client với try/catch.

```typescript
// ✅ ĐÚNG — return object
export async function createProduct(data: FormData) {
  try {
    const validated = ProductSchema.parse(Object.fromEntries(data))
    const product = await prisma.product.create({ data: validated })
    revalidatePath('/admin/products')
    return { success: true, id: product.id }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message }
    }
    return { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' }
  }
}

// ❌ SAI — redirect() trong programmatic call
export async function createProduct(data: FormData) {
  await prisma.product.create({ ... })
  redirect('/admin/products')  // Gây NEXT_REDIRECT error!
}
```

**Ngoại lệ:** `redirect()` OK trong `loginAction` và `logoutAction` vì chúng không được gọi programmatically.

### 3. Server Actions — Standard Signatures
```typescript
// Create
export async function create{Entity}(data: FormData): Promise<ActionResult>

// Update
export async function update{Entity}(id: number, data: FormData): Promise<ActionResult>

// Delete
export async function delete{Entity}(id: number): Promise<ActionResult>

// Toggle status
export async function update{Entity}Status(id: number, status: string): Promise<ActionResult>
```

```typescript
// ActionResult type
type ActionResult =
  | { success: true; id?: number }
  | { success: false; error: string }
```

### 4. Public API — File Structure
```
src/lib/public-api-{entity}.ts
```
- Tất cả functions wrap với `cache()` từ React
- `export const revalidate = 3600` ở file-level (ISR 1 giờ)

```typescript
import { cache } from 'react'
import { prisma } from '@/lib/prisma'

export const revalidate = 3600

// cache() cho deduplication + ISR
export const getProductList = cache(async (filters?: FilterParams) => {
  return prisma.product.findMany({
    where: buildWhereClause(filters),
    include: { collection: true, color: true },
    orderBy: { createdAt: 'desc' },
  })
})

export const getProductBySlug = cache(async (slug: string) => {
  return prisma.product.findUnique({
    where: { slug },
    include: { collection: true },
  })
})
```

### 5. Revalidation sau Mutation
```typescript
// Revalidate tất cả paths liên quan sau mutation
revalidatePath('/admin/products')          // Admin list
revalidatePath('/gach-op-lat')             // Public category
revalidatePath(`/gach-op-lat/${slug}`)     // Public product
```

### 6. Error Response Format
```typescript
// Server Action errors — user-facing (Tiếng Việt)
return { success: false, error: 'Tên sản phẩm không được trống' }
return { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' }
return { success: false, error: 'Sản phẩm không tồn tại.' }

// Không expose internal errors ra client
// ❌ return { success: false, error: error.message }  // Có thể expose DB info
```

### 7. API Route (nếu cần)
Ưu tiên Server Actions cho mutations. API Routes chỉ dùng khi:
- Cần webhook endpoint
- Cần file upload/download
- Cần response format không phải JSON action result

```typescript
// src/app/api/{resource}/route.ts
export async function POST(request: Request) {
  const body = await request.json()
  // validate + process
  return Response.json({ success: true })
}
```

---

## Examples

### ✅ Đúng — Client gọi Server Action
```typescript
'use client'

async function handleSubmit(formData: FormData) {
  const result = await createProduct(formData)
  if (result.success) {
    router.push('/admin/products')
  } else {
    setError(result.error)
  }
}
```

### ✅ Đúng — Server Component dùng Public API
```typescript
// Page Server Component
import { getProductList } from '@/lib/public-api-products'

export const revalidate = 3600

export default async function ProductsPage() {
  const products = await getProductList()
  return <ProductGrid products={products} />
}
```

---

## Anti-patterns

- ❌ `redirect()` trong server action được gọi programmatically
- ❌ Public API function không có `cache()` wrapper
- ❌ Mutation mà không có `revalidatePath()` sau đó
- ❌ Expose raw Prisma/DB error message ra client
- ❌ Tạo Prisma queries trực tiếp trong page components — dùng Public API
- ❌ `fetch()` tới `/api/*` từ Server Component — dùng Public API function trực tiếp
