# Error Handling Rules — Đông Phú Gia

## Purpose
Chuẩn hóa cách xử lý và hiển thị lỗi: server errors, validation errors, user-facing messages. Áp dụng cho Claude Code + Antigravity.

---

## Rules

### 1. Error Categories

| Loại | Xử lý ở đâu | Hiển thị cho user |
|------|------------|-------------------|
| Zod validation | Server Action | Tiếng Việt, field-level |
| Prisma DB error | Server Action | Generic message |
| Network error | Client component | Retry prompt |
| Not found (404) | Page component | `notFound()` |
| Auth error | Middleware/Layout | Redirect to login |
| Unexpected error | Server Action | "Lỗi hệ thống" |

### 2. Server Action Error Pattern
```typescript
export async function createProduct(data: FormData): Promise<ActionResult> {
  try {
    // 1. Validate
    const validated = ProductSchema.safeParse(Object.fromEntries(data))
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0].message,  // First error, Tiếng Việt
      }
    }

    // 2. DB operation
    const product = await prisma.product.create({ data: validated.data })
    revalidatePath('/admin/products')
    return { success: true, id: product.id }

  } catch (error) {
    // 3. Prisma unique constraint
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return { success: false, error: 'Slug đã tồn tại. Vui lòng chọn tên khác.' }
      }
    }

    // 4. Unexpected — log server-side, generic message cho user
    console.error('[createProduct]', error)
    return { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' }
  }
}
```

### 3. Zod Schema — Vietnamese Error Messages
```typescript
const ProductSchema = z.object({
  name: z.string().min(1, 'Tên sản phẩm không được trống'),
  slug: z.string()
    .min(1, 'Slug không được trống')
    .regex(/^[a-z0-9-]+$/, 'Slug chỉ được chứa chữ thường, số và dấu gạch ngang'),
  price: z.number({ invalid_type_error: 'Giá phải là số' })
    .positive('Giá phải lớn hơn 0')
    .optional(),
  status: z.enum(['active', 'inactive'], {
    errorMap: () => ({ message: 'Trạng thái không hợp lệ' }),
  }),
})
```

### 4. Prisma Error Codes cần xử lý
```typescript
import { Prisma } from '@prisma/client'

// P2002 — Unique constraint violation
if (error.code === 'P2002') {
  const field = error.meta?.target as string[]
  return { success: false, error: `${field[0]} đã tồn tại.` }
}

// P2025 — Record not found (update/delete)
if (error.code === 'P2025') {
  return { success: false, error: 'Không tìm thấy bản ghi.' }
}

// P2003 — Foreign key constraint
if (error.code === 'P2003') {
  return { success: false, error: 'Không thể xóa vì có dữ liệu liên quan.' }
}
```

### 5. Client-side Error Display
```typescript
'use client'

const [error, setError] = useState<string | null>(null)

async function handleSubmit(e: FormEvent) {
  e.preventDefault()
  const result = await createProduct(new FormData(e.target as HTMLFormElement))

  if (!result.success) {
    setError(result.error)  // Hiển thị error Tiếng Việt
    return
  }
  router.push('/admin/products')
}

// JSX
{error && (
  <div className="text-red-600 text-sm mt-2">{error}</div>
)}
```

### 6. Not Found Pages
```typescript
// src/app/(public)/gach-op-lat/[patternSlug]/[productSlug]/page.tsx
import { notFound } from 'next/navigation'

const product = await getProductBySlug(productSlug)
if (!product) notFound()  // → renders not-found.tsx
```

### 7. Server-side Logging
```typescript
// Log với context (không expose ra client)
console.error('[createProduct] Unexpected error:', {
  error: error instanceof Error ? error.message : error,
  userId: 'admin',  // context
})

// KHÔNG log sensitive data
// ❌ console.error('Error with data:', { password: formData.get('password') })
```

### 8. Loading / Empty States
```typescript
// ✅ Empty state — rõ ràng cho user
{products.length === 0 && (
  <p className="text-muted-foreground">Chưa có sản phẩm nào.</p>
)}

// ✅ Loading state với skeleton
{isLoading && <ProductCardSkeleton />}
```

---

## Examples

### ✅ Đúng — Full error flow
```typescript
// Server Action
export async function deleteProduct(id: number) {
  try {
    await prisma.product.delete({ where: { id } })
    revalidatePath('/admin/products')
    return { success: true }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        return { success: false, error: 'Không thể xóa sản phẩm đang có trong đơn hàng.' }
      }
    }
    console.error('[deleteProduct]', error)
    return { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' }
  }
}

// Client
const result = await deleteProduct(id)
if (!result.success) toast.error(result.error)
```

---

## Anti-patterns

- ❌ `return { success: false, error: error.message }` — có thể expose DB/internal info
- ❌ Catch lỗi rồi không làm gì (silent fail)
- ❌ Error messages Tiếng Anh ở user-facing UI
- ❌ Throw từ Server Action thay vì return error object
- ❌ Không phân biệt validation error vs system error (UX khác nhau)
- ❌ Log sensitive data (passwords, tokens, PII) vào console
