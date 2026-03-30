# Code Style Rules — Đông Phú Gia

## Purpose
Chuẩn hóa TypeScript/React code style cho toàn bộ codebase ĐPG. Áp dụng cho Claude Code + Antigravity.

---

## Rules

### 1. TypeScript Naming

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Variables, functions | camelCase | `productList`, `getProductBySlug` |
| React components | PascalCase | `ProductCard`, `SmartFilter` |
| Types, Interfaces | PascalCase | `ProductWithRelations`, `FilterParams` |
| Enums | PascalCase | `QuoteStatus` |
| Constants (module-level) | SCREAMING_SNAKE_CASE | `DEFAULT_PAGE_SIZE` |
| Files (non-component) | kebab-case | `public-api-products.ts` |
| Files (component) | kebab-case | `product-card.tsx` |

### 2. No `any` Type
- **KHÔNG** dùng `any` để bypass TypeScript errors
- Dùng `unknown` + type guard nếu type chưa rõ
- Dùng Prisma generated types (`import type { Product } from '@prisma/client'`)
- Nếu cần flexible type → dùng generics `<T>`

### 3. Import Order
Thứ tự import (top → bottom):
```typescript
// 1. Node built-ins (hiếm dùng trong Next.js)
import fs from 'fs'

// 2. External packages
import { z } from 'zod'
import { cache } from 'react'

// 3. Next.js
import { revalidatePath } from 'next/cache'
import Image from 'next/image'

// 4. Internal — lib/utils
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'

// 5. Internal — components
import { Button } from '@/components/ui/button'
import ProductCard from '@/components/product/product-card'

// 6. Types (last, với `import type`)
import type { Product } from '@prisma/client'
```

### 4. File Organization
```
src/lib/
  {entity}-actions.ts     # Server actions + Zod schemas
  public-api-{entity}.ts  # Public read APIs (cache + ISR)

src/components/
  ui/                     # shadcn/ui + shared primitives
  layout/                 # Header, Footer, FloatingContact
  {feature}/              # Feature-specific components
```

### 5. Component Structure
```typescript
// 1. 'use client' directive (nếu cần)
'use client'

// 2. Imports (theo thứ tự trên)

// 3. Types/Interfaces local
type Props = { ... }

// 4. Component function
export default function ComponentName({ prop }: Props) {
  // hooks
  // handlers
  // render
}
```

### 6. Không dùng default export cho utilities
```typescript
// ✅ Named export cho utilities
export function slugify(text: string) { ... }
export const prisma = new PrismaClient()

// ✅ Default export cho components/pages
export default function ProductCard({ ... }) { ... }
```

---

## Examples

### ✅ Đúng
```typescript
// Prisma type, no any
import type { Product, Collection } from '@prisma/client'

type ProductWithCollection = Product & {
  collection: Collection
}

async function getProductBySlug(slug: string): Promise<ProductWithCollection | null> {
  return prisma.product.findUnique({
    where: { slug },
    include: { collection: true },
  })
}
```

### ❌ Sai
```typescript
// any bypass — vi phạm
async function getProduct(slug: any): Promise<any> {
  return prisma.product.findUnique({ where: { slug } })
}
```

---

## Anti-patterns

- ❌ `as any` hoặc `// @ts-ignore` để bypass lỗi — tìm root cause thay vì bypass
- ❌ Import không dùng (gây warning lint)
- ❌ Magic numbers inline — extract thành named constant
- ❌ Inline styles khi Tailwind đủ dùng
- ❌ Nested ternary (`a ? b ? c : d : e`) — dùng if/else hoặc early return
