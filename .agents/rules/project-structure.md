# Project Structure Rules — Đông Phú Gia

## Purpose
Quy định bắt buộc về vị trí và naming khi tạo file/folder mới. Đảm bảo codebase ĐPG nhất quán khi thêm entity, page, hoặc component mới. Áp dụng cho Claude Code + Antigravity.

---

## Rules

### 1. File Placement — "Mỗi loại file có 1 home duy nhất"

| Loại file | Đặt ở | Ví dụ |
|-----------|-------|-------|
| Server Actions + Zod | `src/lib/{entity}-actions.ts` | `product-actions.ts` |
| Public API (read, cached) | `src/lib/public-api-{entity}.ts` | `public-api-products.ts` |
| Auth, utilities | `src/lib/` (file đã có) | `utils.ts`, `admin-auth.ts`, `prisma.ts` |
| Admin pages | `src/app/admin/(dashboard)/{entity}/` | `products/page.tsx` |
| Public pages | `src/app/(public)/{category-slug}/` | `gach-op-lat/page.tsx` |
| API endpoints | `src/app/api/{resource}/route.ts` | `api/upload/route.ts` |
| shadcn/ui primitives | `src/components/ui/` | `button.tsx`, `input.tsx` |
| Layout components | `src/components/layout/` | `header.tsx`, `footer.tsx` |
| Feature components | `src/components/{feature}/` | `category/smart-filter.tsx` |
| DB migration SQL | `scripts/db/migration-{YYYY-MM-DD}-{desc}.sql` | `migration-2026-03-30-add-blog.sql` |
| Seed / Import scripts | `scripts/seed/` hoặc `scripts/{purpose}/` | `scripts/tdm-import/` |
| Static assets (local) | `public/images/{category}/` | `public/images/brands/` |
| Upload images | **Supabase Storage** bucket `images` | KHÔNG dùng `public/uploads/` |

### 2. Naming Conventions

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Files (tất cả) | kebab-case | `product-card.tsx`, `public-api-products.ts` |
| Folders | kebab-case | `gach-op-lat/`, `tb-ve-sinh/` |
| React components | PascalCase (trong file) | `ProductCard`, `SmartFilter` |
| Route segments | Vietnamese slug (không dấu, có gạch ngang) | `gach-op-lat`, `san-go`, `tb-ve-sinh` |
| Admin entity folders | English, plural, kebab-case | `products/`, `collections/`, `pattern-types/` |
| DB migration files | `migration-{YYYY-MM-DD}-{description}` | `migration-2026-03-30-add-weight.sql` |

**Slugify rule:** Tiếng Việt → kebab-case không dấu. Dùng `slugify()` từ `@/lib/utils` (đã fix cho `đ/Đ → d`).

```
Gạch ốp lát  →  gach-op-lat
Thiết bị Vệ sinh  →  thiet-bi-ve-sinh
Sàn gỗ  →  san-go
```

### 3. Admin CRUD — 4+1 Files Bắt Buộc

Mọi admin entity đều phải có đủ 4+1 files:

```
src/app/admin/(dashboard)/{entity}/
├── page.tsx                    # Server Component — list + filter
├── {entity}-form.tsx           # Client Component — create/edit form
├── {entity}-delete-button.tsx  # Two-click delete confirmation
├── new/
│   └── page.tsx                # Create page
└── [id]/
    └── page.tsx                # Edit page (await params!)
```

### 4. Component Co-location — KHÔNG đặt component trong `src/app/`

`src/app/` chỉ chứa:
- `page.tsx` — route page
- `layout.tsx` — layout wrapper
- `error.tsx` — error boundary
- `loading.tsx` — loading UI
- `not-found.tsx` — 404 page
- `{name}-form.tsx`, `{name}-delete-button.tsx` — **chỉ trong admin** (co-located với route)

Mọi component tái sử dụng → `src/components/{feature}/`

---

## Decision Tree

```
Cần tạo file mới?
│
├── Logic / Data layer?
│   ├── Mutation (create/update/delete)
│   │   └── src/lib/{entity}-actions.ts         (Zod + Server Action)
│   ├── Read (public, cần cache + ISR)
│   │   └── src/lib/public-api-{entity}.ts      (cache() + revalidate 3600)
│   ├── Utility function dùng chung
│   │   └── src/lib/utils.ts                    (THÊM VÀO FILE HIỆN CÓ, không tạo file mới)
│   └── API endpoint (webhook, upload, special)
│       └── src/app/api/{resource}/route.ts
│
├── UI Component?
│   ├── Dùng lại ở nhiều nơi, feature-specific
│   │   └── src/components/{feature}/{name}.tsx
│   ├── Primitive UI (button, input, modal...)
│   │   └── src/components/ui/{name}.tsx        (shadcn/ui pattern)
│   ├── Layout (header, footer, nav)
│   │   └── src/components/layout/{name}.tsx
│   └── Admin-only, 1 route dùng
│       └── src/app/admin/(dashboard)/{entity}/{name}.tsx  (co-located OK)
│
├── Page / Route?
│   ├── Admin page
│   │   └── src/app/admin/(dashboard)/{entity}/page.tsx
│   ├── Public category/product page
│   │   └── src/app/(public)/{category-slug}/page.tsx
│   └── Marketing page (about, partners, projects)
│       └── src/app/(public)/{page-name}/page.tsx
│
└── Script / DB?
    ├── Schema thay đổi (column/table/index)
    │   └── scripts/db/migration-{date}-{desc}.sql
    ├── Seed / one-time import
    │   └── scripts/seed/{name}.ts  hoặc  scripts/{purpose}/{name}.ts
    └── Static image asset (không phải upload)
        └── public/images/{category}/{name}.{ext}
```

---

## Anti-patterns

- ❌ **Tạo `public/uploads/` để lưu file upload** — folder này không tồn tại sau Vercel deploy. Dùng Supabase Storage bucket `images`.

- ❌ **Tạo component trong `src/app/`** — ngoại trừ form/delete-button co-located với admin route. Tái sử dụng → `src/components/`.

- ❌ **Tạo `src/lib/utils-{feature}.ts` mới** — thêm vào `src/lib/utils.ts` hiện có, hoặc đặt helper trong file actions cùng entity.

- ❌ **Tạo Prisma query trực tiếp trong page component** — mọi query phải qua `src/lib/public-api-{entity}.ts` với `cache()`.

- ❌ **Đặt route tiếng Việt có dấu** — `/gạch-ốp-lát` bị lỗi URL encoding. Dùng slug không dấu: `/gach-op-lat`.

- ❌ **Admin entity folder tên tiếng Việt** — `src/app/admin/gach-op-lat/` sai. Dùng English plural: `products/`, `collections/`.

- ❌ **Tạo file TypeScript trong `scripts/` không có `.ts` extension** — scripts chạy bằng `npx tsx` hoặc `node --loader ts-node/esm`.

- ❌ **Nest components quá sâu** — `src/components/category/filter/drawer/item/` → flatten thành `src/components/category/filter-drawer-item.tsx`.
