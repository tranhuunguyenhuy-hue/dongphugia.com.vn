# Agent Prompt — Branch `fix/search-crash`
# Issue: LEO-436
# Deadline: 31/05/2026

---

You are Antigravity, a senior frontend developer working on **Đông Phú Gia** (`dongphugia.com.vn`) — a Vietnamese e-commerce website for a premium building materials distributor in Đà Lạt. The site is live on Vercel.

Your Tech Lead is Claude (via a separate Cowork session). You report progress via Linear comments. You do NOT deploy — only the PM (Nguyen Huy) triggers Vercel deploys.

---

## Your task this session

Fix a **critical crash** on the search page (`/tim-kiem`) — currently shows a black "This page couldn't load" error for ANY search query on production. Zero users can use search right now.

**Branch:** `fix/search-crash`
**Single file to modify:** `src/app/(public)/tim-kiem/page.tsx`

---

## Project context you must know

### Tech stack
- **Framework:** Next.js 16.2.3 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 — config ONLY in `src/app/globals.css` → `@theme {}` block. **There is NO `tailwind.config.js`**. Do not create one.
- **Database:** Prisma 5.22.0 + Supabase PostgreSQL
- **Prisma client:** singleton at `src/lib/prisma.ts`, import as `import { prisma } from '@/lib/prisma'`
- **Deploy:** Vercel (auto on push to `main`) — you push to feature branch only

### Critical conventions
- **`params` and `searchParams` are Promises** in Next.js 15+. Always `const { q } = await searchParams`, never `searchParams.q` directly.
- **`npx tsc --noEmit` must pass** before any commit. Fix TypeScript errors before continuing.
- **Do not run `prisma migrate`** — you are reading schema, not changing it.
- **Do not modify `/api/search/route.ts`** — leave it intact.

---

## Root cause (already diagnosed)

The current `src/app/(public)/tim-kiem/page.tsx` has a function like this:

```typescript
// THIS IS THE BUG — Server Component calling its own Vercel function:
async function fetchSearchResults(q: string, ...) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/search?q=${encodeURIComponent(q)}&...`)
  // ...
}
```

On Vercel, a Server Component cannot `fetch()` its own API routes during rendering — the function call blocks and times out, with zero error handling, causing a full render crash → black screen.

**The fix:** Replace the `fetch()` call with a direct Prisma query inside the same Server Component. The data is identical; we just bypass the HTTP round-trip.

---

## Step-by-step execution

### Step 1: Read these files first (do not skip)

```
src/app/(public)/tim-kiem/page.tsx     ← the file you will modify
src/app/api/search/route.ts             ← understand current query logic (DO NOT modify)
src/lib/prisma.ts                       ← confirm import path for prisma client
prisma/schema.prisma                    ← find the `products` model, confirm field names
```

**From `prisma/schema.prisma`, note down:**
- The exact field name for "active" status — could be `is_active`, `isActive`, `status`, or something else
- Whether `image_main_url` exists
- Whether the `products` model has a `categories` relation and its field names
- Whether `price_display` exists

These field names go directly into your Prisma query. TypeScript will error if wrong.

### Step 2: Create the branch

```bash
git checkout main
git pull origin main
git checkout -b fix/search-crash
```

### Step 3: Replace `fetchSearchResults()` with Prisma direct

In `src/app/(public)/tim-kiem/page.tsx`, find the `fetchSearchResults` function and replace its body entirely. Keep the function signature the same so callers don't break.

**Template — adjust field names to match what you found in schema.prisma:**

```typescript
import { prisma } from '@/lib/prisma'

async function fetchSearchResults(q: string, page = 1, limit = 24) {
  if (!q || q.trim().length < 2) {
    return { products: [], total: 0 }
  }

  try {
    const skip = (page - 1) * limit
    const searchTerm = q.trim()

    const [products, total] = await Promise.all([
      prisma.products.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { sku: { contains: searchTerm, mode: 'insensitive' } },
          ],
          // Use the actual field name from schema.prisma:
          is_active: true,        // ← adjust if field is named differently
        },
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          price: true,
          price_display: true,    // ← remove if field doesn't exist in schema
          image_main_url: true,   // ← adjust if named differently
          category_id: true,
          categories: {           // ← adjust if relation name is different
            select: { slug: true },
          },
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.products.count({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { sku: { contains: searchTerm, mode: 'insensitive' } },
          ],
          is_active: true,        // ← same field name as above
        },
      }),
    ])

    return { products, total }
  } catch (error) {
    console.error('[Search] Prisma error:', error)
    return { products: [], total: 0 }
  }
}
```

**Important:** After adjusting field names, run `npx tsc --noEmit` immediately. TypeScript will catch any field name mismatches — fix them before continuing.

### Step 4: Wrap the page component in try/catch

Find the `export default async function` (the page component) and ensure it handles errors gracefully:

```typescript
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  // MUST await searchParams — it's a Promise in Next.js 15+
  const { q = '', page: pageStr = '1' } = await searchParams

  let results: { products: any[]; total: number } = { products: [], total: 0 }

  try {
    if (q.trim().length >= 2) {
      results = await fetchSearchResults(q.trim(), parseInt(pageStr) || 1)
    }
  } catch (error) {
    console.error('[SearchPage] Unexpected error:', error)
    // Render with empty results — do not re-throw
  }

  // ... rest of the render logic unchanged
}
```

**Do not change the render/JSX** — only fix the data fetching. The goal is minimal diff.

### Step 5: Remove the old self-fetch code

After replacing `fetchSearchResults()`, verify there are **no remaining `fetch()`** calls to internal API routes in this file:

```bash
grep -n "fetch(" src/app/\(public\)/tim-kiem/page.tsx
```

If any `fetch(` remains pointing to `/api/search`, remove it. External fetch calls (e.g., to third parties) are fine.

Also check that `process.env.NEXT_PUBLIC_SITE_URL` is no longer referenced in this file if it was only used for the self-fetch URL.

### Step 6: TypeScript check

```bash
npx tsc --noEmit
```

Must output **zero errors**. Common errors you might hit:
- Wrong Prisma field name → check `schema.prisma` and fix
- `mode: 'insensitive'` not accepted → check if your Prisma version supports it (it does in 5.x)
- Return type mismatch if the existing code expected specific shape → adjust `select` to match what the render code uses

### Step 7: Test on localhost

```bash
npm run dev
```

Test all these URLs:
- `http://localhost:3000/tim-kiem?q=toto` → products appear, no crash
- `http://localhost:3000/tim-kiem?q=abc123doesnotexist` → empty state message, no crash
- `http://localhost:3000/tim-kiem` → default search page, no crash
- `http://localhost:3000/tim-kiem?q=a` → no crash (query too short, no search)
- `http://localhost:3000/tim-kiem?q=bồn` → test Vietnamese characters work

If the existing render code breaks because the data shape changed slightly (e.g., you changed the `select` fields), adjust `select` to include whatever fields the JSX needs. Read the render section of the file to understand what fields are accessed.

### Step 8: Done

```bash
npx tsc --noEmit    # must be zero errors
git add src/app/\(public\)/tim-kiem/page.tsx
git commit -m "fix(search): replace self-fetch with direct Prisma query (LEO-436)"
git push origin fix/search-crash
```

Then:
1. Create PR on GitHub (base: `main`)
2. Mark **LEO-436** as "In Review" in Linear
3. Comment the PR URL on LEO-436
4. Do NOT merge — Tech Lead reviews first

---

## What NOT to do

- **Do not modify** `src/app/api/search/route.ts` — leave it exactly as is
- **Do not add rate limiting** to the Server Component — the API route still has it for client-side use cases
- **Do not change the UI/JSX** — pure data fetching fix only
- **Do not add new npm packages** — Prisma is already installed
- **Do not create new files** — one file modified, nothing else

---

## If you get stuck

**Prisma field not found / TypeScript error on field name:**
Read `prisma/schema.prisma`, find the `model products { }` block, list all fields. Map them to what the existing render code accesses. Use only fields that exist.

**`mode: 'insensitive'` TypeScript error:**
This is a PostgreSQL-specific Prisma feature. Confirm your query is targeting a `String` field type. If still errors, try wrapping in `Prisma.StringFilter`:
```typescript
{ name: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } }
```
And import: `import { Prisma } from '@prisma/client'`

**Render code expects shape that doesn't match Prisma result:**
Read what properties the JSX accesses on each product (e.g., `product.imageUrl` vs `product.image_main_url`). Adjust `select` to include those fields, or check if there's a mapping layer. Match exactly what the existing render expects.
