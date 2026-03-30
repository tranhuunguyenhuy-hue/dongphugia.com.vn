# Naming Conventions — Đông Phú Gia

## Purpose
Chuẩn hóa naming cho files, routes, components, và slug generation. Đảm bảo nhất quán giữa Claude Code và Antigravity.

---

## Rules

### 1. File Naming

| Loại file | Convention | Ví dụ |
|-----------|-----------|-------|
| React components | kebab-case.tsx | `product-card.tsx`, `smart-filter.tsx` |
| Pages (Next.js) | `page.tsx` | `page.tsx` (trong folder route) |
| Layouts | `layout.tsx` | `layout.tsx` |
| Server actions | `{entity}-actions.ts` | `product-actions.ts` |
| Public API | `public-api-{entity}.ts` | `public-api-products.ts` |
| Utils/libs | kebab-case.ts | `admin-auth.ts`, `utils.ts` |
| Scripts | kebab-case.ts | `reset-sequences.ts` |
| SQL migrations | `migration-{YYYY-MM-DD}-{desc}.sql` | `migration-2026-03-30-add-tags.sql` |

### 2. Route / URL Naming
- Folder names trong Next.js App Router → kebab-case
- Route groups dùng `(parentheses)` → không xuất hiện trong URL
- Dynamic segments dùng `[camelCase]` trong brackets

```
src/app/
  (public)/
    gach-op-lat/                    → /gach-op-lat
      [patternSlug]/                → /gach-op-lat/[slug]
        [productSlug]/              → /gach-op-lat/[slug]/[slug]
  admin/
    (dashboard)/
      quote-requests/               → /admin/quote-requests
      pattern-types/                → /admin/pattern-types
```

**URL conventions:**
- Kebab-case cho tất cả URL segments: `/san-go`, `/vat-lieu-nuoc`
- Tiếng Việt trong URL phải được slugify (không dấu)
- Không dùng underscore trong URLs

### 3. Component Naming

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Page component | PascalCase + Page suffix | `ProductDetailPage` |
| Layout component | PascalCase + Layout suffix | `AdminDashboardLayout` |
| Feature components | PascalCase | `ProductCard`, `SmartFilter` |
| UI primitives | PascalCase | `Button`, `Input`, `Badge` |
| Form components | PascalCase + Form suffix | `ProductForm`, `QuoteRequestForm` |
| Delete buttons | PascalCase + DeleteButton | `ProductDeleteButton` |

### 4. Admin CRUD File Structure
```
admin/{entity}/
  page.tsx                     # List page (server component)
  {entity}-form.tsx            # Create + Edit form (client)
  {entity}-delete-button.tsx   # Two-click delete (client)
  new/page.tsx                 # Create page
  [id]/page.tsx                # Edit page
```

### 5. Slug Generation — `slugify()` từ `@/lib/utils`

**Đã fix cho Tiếng Việt (đặc biệt ký tự đ/Đ):**
```typescript
// src/lib/utils.ts
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/đ/g, 'd')           // Fix: đ → d TRƯỚC normalize
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}
```

**Anti-pattern đã biết:**
```typescript
// ❌ SAI — đ bị strip thành "" vì normalize trước
text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
// "Đá Marble" → "-arble" (mất "Đ")

// ✅ ĐÚNG — luôn dùng slugify() từ @/lib/utils
import { slugify } from '@/lib/utils'
const slug = slugify('Đá Marble')  // → "da-marble"
```

### 6. Database Entity → File Mapping

| DB table | Prisma model | Actions file | Public API file |
|----------|-------------|-------------|----------------|
| `products` | `Product` | `product-actions.ts` | `public-api-products.ts` |
| `collections` | `Collection` | `collection-actions.ts` | `public-api-collections.ts` |
| `quote_requests` | `QuoteRequest` | `quote-request-actions.ts` | — |
| `blog_posts` | `BlogPost` | `blog-actions.ts` | `public-api-blog.ts` |

### 7. Image Storage Paths
```
Supabase bucket: images
  products/{productId}/{filename}
  collections/{collectionId}/{filename}
  banners/{filename}
  brands/{brandSlug}/{filename}
```

### 8. TypeScript Type Naming

```typescript
// Props types — Props suffix
type ProductCardProps = { product: Product }

// Composite types — descriptive
type ProductWithRelations = Product & { collection: Collection; color: Color }

// Filter types — Params suffix
type ProductFilterParams = { collection?: string; color?: string }

// Action result — ActionResult
type ActionResult = { success: true; id?: number } | { success: false; error: string }
```

---

## Examples

### ✅ Đúng
```
src/app/admin/(dashboard)/pattern-types/page.tsx
src/lib/pattern-type-actions.ts
src/components/category/smart-filter.tsx
```

### ❌ Sai
```
src/app/admin/patternTypes/Page.tsx       # PascalCase route, Page suffix
src/lib/patternTypeActions.ts              # camelCase filename
src/components/category/SmartFilter.tsx   # PascalCase filename
```

---

## Anti-patterns

- ❌ Vietnamese characters trong file names (ký tự không ASCII)
- ❌ Underscores trong URL paths (`/san_go` → dùng `/san-go`)
- ❌ Tự implement slug logic thay vì dùng `slugify()` từ `@/lib/utils`
- ❌ Inconsistent entity naming giữa DB table, Prisma model, và file names
