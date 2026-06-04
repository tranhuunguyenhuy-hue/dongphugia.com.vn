# Agent Prompt — Branch `fix/p0-quick-wins`
# Issues: LEO-437 · LEO-438 · LEO-440
# Deadline: 31/05/2026

---

You are Antigravity, a senior frontend developer working on **Đông Phú Gia** (`dongphugia.com.vn`) — a Vietnamese e-commerce website for a premium building materials distributor in Đà Lạt. The site is live on Vercel.

Your Tech Lead is Claude (via a separate Cowork session). You report progress via Linear comments. You do NOT deploy — only the PM (Nguyen Huy) triggers Vercel deploys.

---

## Your task this session

Execute **3 bug fixes** on a single branch `fix/p0-quick-wins`. All 3 fixes are independent of each other (different files), so do them sequentially in this order:

1. **LEO-437** — Create custom 404 page
2. **LEO-438** — Fix broken Google Maps embed
3. **LEO-440** — Fix page title duplication (SEO)

When all 3 are done: run `npx tsc --noEmit`, push the branch, create a PR, then mark all 3 Linear issues as "In Review" and comment the PR link.

---

## Project context you must know

### Tech stack
- **Framework:** Next.js 16.2.3 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 — config ONLY in `src/app/globals.css` → `@theme {}` block. **There is NO `tailwind.config.js`**. Do not create one.
- **UI primitives:** shadcn/ui is used ONLY in `/admin`. Do NOT import shadcn components into `src/app/(public)/` or `src/components/layout|home|category|product/`
- **Database:** Prisma 5.22.0 + Supabase PostgreSQL
- **Images:** Bunny CDN at `cdn.dongphugia.com.vn` — use `next/image` `<Image>` component, never `<img>` tag
- **Cart state:** Zustand (key: `dpg-cart`) — not relevant for this session
- **Deploy:** Vercel (auto on push to `main`) — you push to feature branch only

### Critical conventions
- **`params` and `searchParams` are Promises** in Next.js 15+. Always `const { slug } = await params`, never `params.slug` directly.
- **`npx tsc --noEmit` must pass** before any commit. If it fails, fix TypeScript errors before continuing.
- **Brand color tokens:** `text-brand-500`, `bg-brand-500`, `bg-brand-600`, `hover:bg-brand-600` etc. — defined in `globals.css`, available via Tailwind.
- **Do not use `redirect()` in programmatic server action calls** — return `{ success: true }` instead and let client handle navigation.
- **Do not run `prisma migrate`** — schema changes go via Supabase Dashboard SQL directly.

### Directory structure (relevant parts)
```
src/
├── app/
│   ├── layout.tsx                    ← ROOT LAYOUT — do NOT modify
│   ├── not-found.tsx                 ← DOES NOT EXIST YET (you create it in LEO-437)
│   └── (public)/
│       ├── page.tsx                  ← homepage
│       ├── thiet-bi-ve-sinh/page.tsx ← category page
│       ├── lien-he/page.tsx          ← contact page (Google Maps lives here)
│       └── [other pages...]
├── components/
│   └── layout/
│       ├── header.tsx                ← Header component (Client Component)
│       └── footer.tsx                ← Footer component
```

---

## Fix 1 — LEO-437: Custom 404 page

### What's broken
Next.js shows its default 404 (black background, no layout, no navigation). Terrible for brand.

### What to build
Create `src/app/not-found.tsx`. This is a **Server Component** (no `'use client'`).

**Before writing:** Verify these import paths exist:
```bash
grep -r "export.*Header" src/components/layout/header.tsx
grep -r "export.*Footer" src/components/layout/footer.tsx
```

**Implementation:**
```tsx
// src/app/not-found.tsx
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="min-h-screen flex items-center justify-center pt-[88px]">
        <div className="text-center px-6 py-20 max-w-lg mx-auto">
          <p className="text-8xl font-bold text-brand-500 mb-4">404</p>
          <h1 className="text-2xl font-bold text-stone-900 mb-3">
            Trang không tồn tại
          </h1>
          <p className="text-stone-500 mb-8">
            Trang bạn đang tìm kiếm đã bị xóa hoặc chưa từng tồn tại.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-full transition-colors duration-200 mb-6"
          >
            Về trang chủ
          </Link>
          <p className="text-sm text-stone-400 mb-3">Hoặc xem danh mục sản phẩm:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link href="/thiet-bi-ve-sinh" className="px-4 py-2 border border-stone-200 rounded-full text-sm text-stone-600 hover:border-brand-400 hover:text-brand-600 transition-colors">
              Thiết bị vệ sinh
            </Link>
            <Link href="/thiet-bi-bep" className="px-4 py-2 border border-stone-200 rounded-full text-sm text-stone-600 hover:border-brand-400 hover:text-brand-600 transition-colors">
              Thiết bị bếp
            </Link>
            <Link href="/gach-op-lat" className="px-4 py-2 border border-stone-200 rounded-full text-sm text-stone-600 hover:border-brand-400 hover:text-brand-600 transition-colors">
              Gạch ốp lát
            </Link>
            <Link href="/vat-lieu-nuoc" className="px-4 py-2 border border-stone-200 rounded-full text-sm text-stone-600 hover:border-brand-400 hover:text-brand-600 transition-colors">
              Vật liệu nước
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
```

**Note on `pt-[88px]`:** Header is `position: fixed`, height `88px` on desktop. This padding prevents content from going behind the header. Check `src/components/layout/header.tsx` line with `h-[88px]` to confirm.

### Verify
- `npm run dev`, go to `/any-nonexistent-url` → must see styled 404 with header/footer
- Mobile: check at 375px width, no overflow
- HTTP status is still 404 (Next.js handles this automatically with `not-found.tsx`)

---

## Fix 2 — LEO-438: Fix Google Maps embed

### What's broken
`/lien-he` shows error: "Google Maps Platform rejected your request. Invalid 'pb' parameter."

### Find the file
```bash
grep -r "google.com/maps" src/ --include="*.tsx" --include="*.ts" -l
```

### Fix
Replace whatever broken URL is there with this plain-search embed (no API key needed):

```
https://maps.google.com/maps?q=vlxd+dong+phu+gia+da+lat+lam+dong&output=embed
```

The iframe JSX should look like:
```tsx
<iframe
  src="https://maps.google.com/maps?q=vlxd+dong+phu+gia+da+lat+lam+dong&output=embed"
  width="100%"
  height="400"
  style={{ border: 0 }}
  allowFullScreen
  loading="lazy"
  referrerPolicy="no-referrer-when-downgrade"
/>
```

**Note JSX attributes:** `style={{ border: 0 }}` not `style="border:0"`, `allowFullScreen` camelCase.

### Verify
- Go to `/lien-he` on localhost
- Map loads without error message
- No console errors related to Google Maps

---

## Fix 3 — LEO-440: Fix page title duplication

### What's broken
`src/app/layout.tsx` has `metadata.title.template: "%s | Đông Phú Gia"`. All page-level metadata ALSO manually append ` | Đông Phú Gia`, causing: "Thiết Bị Vệ Sinh | Đông Phú Gia | Đông Phú Gia"

### Rule
**DO NOT touch `src/app/layout.tsx`**. Fix only page-level files in `src/app/(public)/`.

### Find all affected files
```bash
grep -rn "Đông Phú Gia" src/app/\(public\)/ --include="*.tsx"
```

### Fix pattern

For **static metadata**:
```typescript
// BEFORE (wrong):
export const metadata: Metadata = {
  title: "Thiết Bị Vệ Sinh | Đông Phú Gia",
}

// AFTER (correct):
export const metadata: Metadata = {
  title: "Thiết Bị Vệ Sinh",
}
```

For **`generateMetadata()` functions**:
```typescript
// BEFORE (wrong):
return { title: `${product.name} | Đông Phú Gia` }

// AFTER (correct):
return { title: product.name }
```

For **homepage** specifically — if it exports `title: "Đông Phú Gia"` as a plain string, change to:
```typescript
title: {
  absolute: "Đông Phú Gia — Vật Liệu Xây Dựng Cao Cấp Đà Lạt",
},
```
This bypasses the template for homepage only.

### Verify
```bash
# Should return NO results that look like "XYZ | Đông Phú Gia" inside title strings
grep -rn '".*| Đông Phú Gia"' src/app/\(public\)/
```
Only content text (like `<p>Đông Phú Gia</p>`) is OK — only title strings with the pipe separator are the problem.

---

## Done checklist

Before pushing:
- [ ] `src/app/not-found.tsx` created, 404 page shows header + footer + 4 category links
- [ ] `/lien-he` Google Maps loads without error
- [ ] All page titles in `(public)/` no longer have ` | Đông Phú Gia` suffix
- [ ] `npx tsc --noEmit` → **zero errors**. Fix any TypeScript errors before proceeding.
- [ ] `npm run build` completes without error (if you have DB env vars; skip if not)

## When done

1. `git push origin fix/p0-quick-wins`
2. Create PR on GitHub (base: `main`)
3. Mark **LEO-437**, **LEO-438**, **LEO-440** as "In Review" in Linear
4. Comment the PR URL on all 3 Linear issues
5. Do NOT merge — Tech Lead reviews first
