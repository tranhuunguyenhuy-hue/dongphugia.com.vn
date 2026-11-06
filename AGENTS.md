# Dongphugia — Codex startup instructions

**Goal:** restore and improve `https://www.dongphugia.vn` quickly. Prioritize
working customer-facing releases, not paperwork. This is the one auto-loaded
repo guide. **Do not read other Markdown files by default.**

## Project and context

- Repo `tranhuunguyenhuy-hue/dongphugia.com.vn`, default branch `main`.
- `apps/public/`: new storefront; `apps/admin/`: separate staff CMS;
  `src/`: legacy Next.js; `prisma/`, `scripts/`, `.github/workflows/`.
- Legacy AWS/Coolify/PostgreSQL and newer Cloudflare/Supabase coexist in
  source/history. **Verify the actual Production runtime** before deploy.
- Read `CONTEXT.md` **only** for catalogue, commerce, media/publishing,
  staff-domain tasks, or resuming complex prior work.

## Fast delivery

`Request → Small change → Relevant tests → One PR → Owner approval → Deploy → Live smoke`

1. Infer routine details from code; a clear request needs no default Issue,
   spec, ADR, meeting or multi-agent review.
2. Check `main` and relevant PRs; use one `codex/<task>` branch, one
   bounded PR. Do not expand scope or alter unrelated work.
3. Docs-only: inspect diff/links. UI: check rendered behavior. Logic: focused
   tests plus applicable lint/typecheck. Run full suite/build when required
   by impact or CI, not automatically for every edit.
4. Preview when useful; a build artifact is not a deployed Preview.
5. Owner approves merge and Production. One approval may cover both only
   if automation locks the exact reviewed candidate and target; otherwise
   follow the currently enforced gates. Never deploy without authorization.
6. Verify Production target, smoke-test actual changed URLs/actions and keep
   a known-good application version for rollback. Report PR, commit, live
   result and any blocker. A merge is **not** a deployment.
7. After two failed attempts with the same method, diagnose or change it.
   No repetitive repair PRs for unrelated hardening.

## Risk and code invariants

- CSS, copy, SEO, footer and read-only edits **do not** require database backup,
  restore rehearsal or independent security review. Blocked Phase 2 backup
  must not delay unrelated safe fixes.
- Data/schema, customer orders/payments, permissions, secrets, uploads,
  CDN/DNS and destructive changes need proportionate functional checks,
  an authorized target, recoverable affected data and a tested recovery path.
- Never expose tokens, credentials or private/customer data; do not bypass
  auth/RLS. Staff privileges stay server-side, separate from public routes.
- Preserve SKU, independent PDP/variant URLs, price, media paths and order
  snapshots. Tailwind v4: reuse tokens; do not add `tailwind.config.js`.
- Useful checks: `npm run lint`, `npm run typecheck`, `npm test` and
  affected app builds. Required repository CI remains the merge gate.

## Optional references — open only when applicable

- Exact domain terms: `docs/agents/domain-glossary-full.md`
- Legacy application conventions: `docs/agents/application-conventions.md`
- Release details: `docs/WORKFLOW-WITH-CODEX.md`
- Risky runtime changes: the **one affected** `docs/deploy/` runbook,
  relevant `docs/adr/`, and freshly verified provider state.
- Task status: relevant GitHub Issue/PR, not a dated summary.

Never reset/delete/merge/deploy or mutate shared systems outside approved
scope. Stop on a real blocker; don't hide failures or silently weaken safety.
