# Database Rules — Đông Phú Gia

## Purpose
Chuẩn hóa Prisma conventions, SQL migration workflow, và patterns phòng tránh data issues. Áp dụng cho Claude Code.

---

## Rules

### 1. Prisma Model Naming

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Model name | PascalCase (singular) | `Product`, `QuoteRequest` |
| Field name | camelCase | `createdAt`, `productId` |
| Relation field | camelCase (singular/plural) | `product`, `collections` |
| DB table (@@map) | snake_case (plural) | `@@map("products")` |
| DB column (@map) | snake_case | `@map("created_at")` |

```prisma
model QuoteRequest {
  id        Int      @id @default(autoincrement())
  createdAt DateTime @default(now()) @map("created_at")
  productId Int?     @map("product_id")
  product   Product? @relation(fields: [productId], references: [id])

  @@map("quote_requests")
}
```

### 2. KHÔNG dùng `prisma migrate`
- DB được quản lý thủ công qua Supabase SQL Editor
- **Workflow thêm bảng/column:**
  1. Viết SQL → test trong Supabase Dashboard (SQL Editor)
  2. Verify trong Supabase Table Editor
  3. `npx prisma db pull` → sync schema
  4. `npx prisma generate` → regenerate client
  5. Restart dev server (clear Turbopack cache)

### 3. SQL Migration Naming
```
scripts/db/migration-{YYYY-MM-DD}-{description}.sql
```
Ví dụ:
```
scripts/db/migration-2026-03-01-add-quote-requests.sql
scripts/db/migration-2026-03-30-add-blog-tags.sql
```

### 4. Index Patterns
```sql
-- Single column (truy vấn phổ biến)
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_collection_id ON products(collection_id);

-- Composite (filter + sort phổ biến)
CREATE INDEX idx_products_collection_status ON products(collection_id, status);

-- Unique constraint thay vì chỉ index
ALTER TABLE products ADD CONSTRAINT products_slug_unique UNIQUE (slug);
```

### 5. PostgreSQL Sequence Reset (Quan trọng!)
**Triệu chứng:** `P2002` error khi tạo record mới sau khi seed data với explicit IDs.

**Nguyên nhân:** SERIAL sequence out of sync với MAX(id) hiện tại.

**Fix:**
```sql
-- Cú pháp chung
SELECT setval('{table}_id_seq', (SELECT MAX(id) FROM {table}));

-- Ví dụ
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));
SELECT setval('collections_id_seq', (SELECT MAX(id) FROM collections));
SELECT setval('quote_requests_id_seq', (SELECT MAX(id) FROM quote_requests));
```

Chạy trong Supabase SQL Editor sau khi seed data có explicit IDs.

### 6. Back-relations (Required cho Vercel build)
Mọi relation đều phải có back-relation. Thiếu back-relation → **Vercel build WASM error**.

```prisma
model Product {
  colorId Int?
  color   Color? @relation(fields: [colorId], references: [id])
}

model Color {
  // Back-relation BẮT BUỘC
  products Product[]
}
```

### 7. Soft Delete Pattern
Không xóa vật lý record có quan hệ — dùng `status` field:
```prisma
model Product {
  status String @default("active") // "active" | "inactive" | "draft"
}
```

### 8. Prisma Client Singleton
```typescript
// src/lib/prisma.ts — KHÔNG tạo instance mới ở nơi khác
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

---

## Examples

### ✅ Đúng — Thêm column mới
```sql
-- scripts/db/migration-2026-03-30-add-product-weight.sql
ALTER TABLE products ADD COLUMN weight_kg DECIMAL(10,2);
COMMENT ON COLUMN products.weight_kg IS 'Trọng lượng sản phẩm (kg)';
```
```bash
npx prisma db pull && npx prisma generate
# Restart dev server
```

### ✅ Đúng — Query với include
```typescript
const product = await prisma.product.findUnique({
  where: { slug },
  include: {
    collection: true,
    color: true,
    origin: true,
  },
})
```

### ❌ Sai
```bash
# KHÔNG dùng migrate
npx prisma migrate dev --name add-weight

# KHÔNG modify schema.prisma thủ công mà không có SQL migration tương ứng
```

---

## Anti-patterns

- ❌ `prisma migrate` — dùng SQL Editor trực tiếp
- ❌ Thay đổi `schema.prisma` mà không chạy SQL tương ứng trước
- ❌ Thiếu back-relations (gây WASM build error trên Vercel)
- ❌ `prisma.{model}.deleteMany()` không có `where` clause
- ❌ Tạo PrismaClient instance mới ngoài `src/lib/prisma.ts`
- ❌ Xóa column/bảng mà không hỏi PM (có thể mất production data)
