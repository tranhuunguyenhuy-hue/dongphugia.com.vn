# Findings: Admin Subdomain Separation Research
> Cập nhật: 2026-04-29

---

## F-001: Coupling Analysis — Main Site vs Admin

**Phát hiện**: Admin CMS hiện tại tightly coupled với main site qua:

### Shared Libraries (admin dùng từ `src/lib/`)
| File | Lines | Vai trò | Cần copy sang admin? |
|------|-------|---------|---------------------|
| `product-actions.ts` | 276 | CRUD sản phẩm + revalidate | ✅ Yes (thay revalidatePath) |
| `order-actions.ts` | 267 | CRUD đơn hàng | ✅ Yes |
| `blog-actions.ts` | 202 | CRUD blog | ✅ Yes |
| `actions.ts` | 177 | Banners, categories, quotes | ✅ Yes |
| `partner-actions.ts` | 75 | CRUD đối tác | ✅ Yes |
| `project-actions.ts` | 78 | CRUD dự án | ✅ Yes |
| `admin-auth.ts` | ~60 | HMAC-SHA256 cookie auth | ✅ Yes (adjust domain) |
| `public-api-products.ts` | ~700 | Read products (admin queries) | ⚠️ Partial |
| `cache.ts` | ~100 | Lookup tables cache | ✅ Yes |
| `prisma.ts` | ~5 | Prisma client singleton | ✅ Yes (copy) |

**Tổng**: ~1,342 lines cần port/adapt

### Database Models cần thiết cho Admin
```
products, product_images, categories, subcategories
brands, origins, colors, materials
blog_posts, blog_tags
orders, order_items
partners, projects
banners, quote_requests
```

---

## F-002: Cache Architecture Hiện Tại

**Phát hiện**: Main site dùng 2 layer caching:

### Layer 1: `unstable_cache` (Next.js ISR)
```typescript
// cache.ts — cached với tags
getCategories()     → tag: 'categories',    revalidate: 3600
getSubcategories()  → tag: 'subcategories', revalidate: 3600
getBrands()         → tag: 'brands',        revalidate: 3600
```

### Layer 2: `revalidatePath` trong Server Actions
```typescript
// product-actions.ts — invalidate specific paths sau mutations
revalidatePath('/thiet-bi-ve-sinh')
revalidatePath('/thiet-bi-bep')
// ... etc
```

**Vấn đề khi tách**: `revalidatePath` và `revalidateTag` chỉ hoạt động trong cùng Next.js instance. Khi admin là subdomain khác → phải dùng `/api/revalidate` HTTP endpoint.

**Giải pháp đã xác nhận**: 
```
admin.dongphugia.com.vn  →  POST /api/revalidate  →  dongphugia.com.vn
(Sau mỗi mutation)           (secret: env var)        (revalidatePath + revalidateTag)
```

---

## F-003: Auth System

**Phát hiện**: HMAC-SHA256 cookie-based auth trong `src/lib/admin-auth.ts`

**Cookie hiện tại**:
```typescript
// Cookie chỉ set cho domain hiện tại (dongphugia.com.vn)
// Khi tách sang admin.dongphugia.com.vn → cần adjust:
// domain: '.dongphugia.com.vn'  ← với dấu chấm = share toàn bộ subdomain
```

**Lưu ý**: `ADMIN_PASSWORD` env var cần có trên admin project.

**Cân nhắc nâng cấp**: Supabase Auth hoặc JWT với refresh token pattern phù hợp hơn cho production. Nhưng HMAC cookie đủ dùng nếu muốn migrate nhanh.

---

## F-004: Middleware Dependencies

**Phát hiện**: `src/middleware.ts` có `/admin` trong BYPASS_PATHS:
```typescript
const BYPASS_PATHS = [
  "/maintenance",
  "/admin",      ← CẦN XÓA sau khi tách
  "/api",
  ...
]
```

**Sau khi xóa /admin**: Middleware chỉ handle:
1. Maintenance mode
2. Product slug 301 redirects (3,323 mappings từ redirect-map.json)

→ **Main site middleware sẽ đơn giản và nhẹ hơn.**

---

## F-005: Static Assets

**Phát hiện**: 
- Product images: Bunny CDN (`cdn.dongphugia.com.vn`)
- Public assets: Vercel `/public` folder
- Image upload: `src/components/ui/image-uploader.tsx`

**Khi tách**: Admin mới cần:
- Copy `ImageUploader` component
- Config `BUNNY_CDN_STORAGE_KEY` và `BUNNY_CDN_ZONE` env vars
- CORS: Bunny CDN cần allow upload từ `admin.dongphugia.com.vn`

---

## F-006: Vercel Configuration

**Phát hiện**: `vercel.json` hiện tại chỉ có:
```json
{ "regions": ["sin1"] }
```

**Kế hoạch deployment**:
- Main: `dongphugia.com.vn` → Vercel project hiện tại (không đổi)
- Admin: `admin.dongphugia.com.vn` → Vercel project MỚI
  - Region: `sin1` (Singapore — gần VN nhất)
  - Custom domain: `admin.dongphugia.com.vn`

---

## F-007: shadcn/ui Compatibility

**Phát hiện**: 
- Main site: `components.json` style = `new-york`, baseColor = `neutral`, Tailwind v4
- Admin mới: Nên dùng CÙNG config để consistent
- Tailwind v4 + shadcn/ui (latest) = ✅ Compatible (đã verify trên main site)

**Components đã có trên main site (có thể reference):**
`Badge, Button, Card, Checkbox, Dialog, DropdownMenu, Form, Input, Label, Select, Sheet, Skeleton, Table, Tabs, Textarea, Tooltip, Sonner, Avatar, Breadcrumb, Pagination, AlertDialog`

---

## F-008: Schema Drift Risk

**Phát hiện**: Khi có 2 projects dùng chung 1 DB nhưng mỗi project có `prisma/schema.prisma` riêng:

**Rủi ro**: Dev thêm column mới vào 1 project, chạy migration → project kia bị lỗi.

**Giải pháp options**:
1. **Manual sync** (đơn giản, dùng được ngắn hạn): Copy `schema.prisma` manually mỗi khi có thay đổi
2. **npm package** (phức tạp): Tách schema + prisma client thành private npm package dùng chung
3. **Git submodule** (trung gian): `prisma/` là git submodule shared

**Khuyến nghị**: Option 1 (manual sync) cho giai đoạn đầu. Khi DB schema ổn định, không cần lo nhiều.

---

## F-009: Nhân sự & UX

**Phát hiện từ User Advocate**:
- Admin users = nhân viên nội bộ, dùng desktop
- Priority: Tốc độ thao tác > Đẹp
- Critical features: Search nhanh (Command Palette), Bulk actions, Unsaved changes guard
- Mobile: Low priority cho CMS

---

## F-010: Action Files Security Gap

**Phát hiện nguy hiểm**: 
```typescript
// src/lib/product-actions.ts — KHÔNG có auth check!
'use server'
export async function createProduct(payload) {
  // ← Không verify admin session ở đây
  // Auth chỉ verify ở layout.tsx
}
```

**Khi tách**: Admin project mới CÓ THỂ thêm auth check trong mỗi action:
```typescript
async function ensureAdmin() {
  const ok = await verifyAdminSession()
  if (!ok) throw new Error('Unauthorized')
}
```

→ Defense-in-depth tốt hơn so với hiện tại.
