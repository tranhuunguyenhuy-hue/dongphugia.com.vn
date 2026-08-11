# Dongphugia application reference

Read this file only for application code, schema, or test work. Root `AGENTS.md`
owns operating safety; `docs/WORKFLOW-WITH-CODEX.md` owns delivery.

## Product and stack

Dongphugia is a B2C premium building-materials storefront for Da Lat with
offline payment. Its four public categories are `thiet-bi-ve-sinh`,
`thiet-bi-bep`, `vat-lieu-nuoc`, and `gach-op-lat`.

The application uses Next.js App Router, React 19, TypeScript, Tailwind CSS v4,
Prisma, AWS PostgreSQL, Zustand, and Bunny CDN-compatible media URLs.

## Application conventions

- **Tailwind v4:** configure theme values only in `src/app/globals.css` under
  `@theme`. Brand primary `brand-500` is `#2D90AF`. Preserve `@source` lines and
  do not introduce `tailwind.config.js`.
- **Public UI:** `@/components/ui/` shadcn components are admin-only. Public
  routes use the public component patterns.
- **App Router:** `params` and `searchParams` are promises. Server Components
  fetch data; Client Components own interactivity.
- **Caching:** use `unstable_cache()` and `revalidateTag()` for ISR-backed data.
- **Server Actions:** programmatic actions return a result such as
  `{ success: true }`; redirect on the client. Redirect is reserved for
  login/logout flows. Revalidate affected tags after mutation.
- **Database:** AWS PostgreSQL is the production source of truth. An approved
  schema sync is followed by `npx prisma generate`.
- **Images:** upload through `/api/upload-image` and preserve Bunny CDN
  compatibility. Runtime uploads do not live in `public/uploads/`.
- **Metadata:** page titles omit the `| Đông Phú Gia` suffix because the root
  layout template adds it. The homepage uses an absolute title.

## Protected application areas

- Production database schema or data mutation requires the production gates in
  root `AGENTS.md` and a reviewed migration plan.
- Dropping a table or column, changing the auth flow, or adding a major
  production dependency requires explicit technical approval.
- Admin authentication uses bcrypt plus hashed session tokens, the
  `dpg-admin-session` secure HTTP-only cookie, and the dashboard layout guard.
  Preserve the role order `admin > sale_manager > sale` unless auth changes are
  explicitly in scope.

## Known gotchas

| Signal | Required response |
| --- | --- |
| `NEXT_REDIRECT` in a programmatic action | Return a result and navigate from the client. |
| Prisma types are stale after schema work | Run `npx prisma generate` and restart the dev process. |
| Async `params` error | Await `params` before reading route values. |
| Prisma/WASM build relation error | Add all required back-relations, then regenerate the client. |
| Bunny image does not render | Verify the CDN host is present in `images.remotePatterns`. |
| Page title repeats the brand | Remove the brand suffix from the page title string. |
| A branch contains a wide unrelated diff | Port only task-owned changes; do not merge the branch wholesale. |
| Imported `specs` can be null | `products.specs` is non-null JSONB; use an empty object fallback. |
| Crawl discovery includes service/category pages | Hita product URLs use numeric IDs at least 1000; filter lower IDs. |
| Kitchen data uses the wrong taxonomy | `thiet-bi-bep` uses `bep_brands`, `bep_product_types`, and `bep_subtypes`. |
| MOEN/GROHE/ATMOR media is rejected | Product-image validation supports `cdn.hita.com.vn/storage/`. |
| Image fallback captures upsell media | Scope template-3 fallback to `.product-column-left` and exclude `.section-buy-more`. |
| Listing imports show no image | Upserts must populate `products.image_main_url`, which `ProductCard` reads. |

Keep this document for conventions the environment cannot reveal cheaply. Read
scripts, configuration, Prisma schema, and directory layout directly instead of
caching them here.
