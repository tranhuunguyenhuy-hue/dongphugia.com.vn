# Dongphugia application guide

Read this guide only for application code, schema, tests, UI, or media work.
Root `AGENTS.md` owns authority and safety. `WORKFLOW-WITH-CODEX.md` owns
delivery and release gates.

## Before changing code

Read the current Issue or authorized request, relevant source and adjacent
tests, then the narrowest applicable ADR or domain definition. Read a runbook
only when the change affects a runtime or deployment contract.

Prefer established patterns. Do not add unrelated cleanup to a bounded fix.

## Product and stack

Dongphugia is a B2C premium building-materials storefront with offline payment.
It uses Next.js App Router, React 19, TypeScript, Tailwind CSS v4, Prisma, AWS
PostgreSQL, Zustand, and Bunny-compatible media URLs.

Use the canonical product language in root `CONTEXT.md`; do not infer product
families, packages/BOMs, or typed relationships from names, SKU prefixes,
selectors, or aggregate counts.

## Application conventions

- Configure Tailwind v4 theme values only in `src/app/globals.css` under
  `@theme`; preserve `@source` lines and do not add `tailwind.config.js`.
- `brand-500` is `#2D90AF`. Reuse tokens rather than near-duplicate values.
- `@/components/ui/` shadcn components are admin-only; public routes use public
  component patterns.
- Server Components fetch data; Client Components own interactivity.
- `params` and `searchParams` are promises and must be awaited.
- Use `unstable_cache()` and `revalidateTag()` for ISR-backed data.
- Programmatic Server Actions return a result; client code navigates. Redirect
  is reserved for login/logout flows.
- Validate input at boundaries and keep business rules in their domain module.

## Data, security, and media

- AWS PostgreSQL is the Production source of truth. Schema or data change needs
  dedicated validation, recovery, and approval controls; read its ADR and
  migration procedure before proposing it.
- An approved Prisma schema change is followed by `npx prisma generate`.
- Preserve existing authorization, validation, CSP, cache, and error handling.
- Admin auth uses bcrypt, hashed sessions, `dpg-admin-session`, and the role
  order `admin > sale_manager > sale`; do not change it outside explicit scope.
- Upload through `/api/upload-image`; runtime uploads do not live in
  `public/uploads/`.
- Preserve Bunny allowlisting in both the Next image policy and CSP when media
  behavior changes.

## UI and metadata

- Preserve semantic HTML, keyboard access, labels, focus treatment, localization,
  and responsive behavior.
- Page titles omit `| Đông Phú Gia`; the root layout template adds it. The
  homepage title is absolute.
- Validate rendered browser behavior for UI or media changes; compilation alone
  is insufficient.

## Tests and documentation

- Add or update focused tests when behavior changes.
- Run focused checks first, then the repository checks required by the scope and
  recorded controls.
- Record blocked or unrun checks as `UNKNOWN`; do not weaken a check to pass.
- Put durable decisions in an ADR, procedures in a runbook, and dated verified
  facts in `ops/project-current-state.md`.

For handoff, report behavior changed, evidence, residual risk, and the next
release gate. This file does not authorize release.
