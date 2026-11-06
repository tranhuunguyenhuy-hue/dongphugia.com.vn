# Dongphugia — Codex instructions

This is the **only automatically loaded repository guide**. Keep it short.
Goal: restore and improve the customer website quickly; prioritize a working
Production outcome over process artifacts. Do not read every document by default.

## Project map

- Repo: `tranhuunguyenhuy-hue/dongphugia.com.vn`; branch: `main`.
- Customer site: `https://www.dongphugia.vn`.
- Code: `apps/public/` (new Public), `apps/admin/` (separate staff Admin),
  `src/` (legacy Next.js), `prisma/`, `scripts/`, `.github/workflows/`.
- Stack varies by runtime: legacy AWS/Coolify/PostgreSQL/Bunny; newer
  Cloudflare Workers/Supabase code exists. **Verify the runtime actually
  serving Production before deployment**; do not infer it from old docs.
- Domain vocabulary and active work links: `CONTEXT.md` (**read only for
  catalogue, commerce, CMS, publishing, or cross-session handoff tasks**).

## Default delivery: fast and focused

`Request → Change → Relevant tests → PR → Owner approval → Deploy → Live smoke`

1. A plain-language request is enough. Confirm the observable outcome; do not
   create an Issue, spec, ADR, or review meeting for a small clear task.
2. Check current `main` and relevant open PRs. Make the smallest bounded
   change on one `codex/<task>` branch; one task normally means one PR.
3. Test only affected behavior plus repository-required CI. For docs-only work,
   verify diff/links; for UI, inspect rendered output; for behavior, run focused
   tests. Do not require a full build or dedicated reviewer by default.
4. Use reachable Preview when helpful and available; a build artifact alone
   is **not** deployed Preview. Do not create an infrastructure project just
   to validate a reversible copy/CSS change.
5. Owner must approve merge and Production. A single go/no-go can cover both
   **only if** automation binds the exact reviewed candidate and target;
   otherwise use the currently enforced separate gates.
6. Deploy only to the verified runtime, smoke-test affected live URLs/actions,
   and report commit, PR, Production result, or explicit blocker.
7. After two failures with the same fix, inspect the cause or change approach.
   Do not turn unrelated technical debt into a blocking subproject.

**Risk proportionality:** UI/text/SEO without data writes needs no database
backup or restore rehearsal. Ordinary features need focused functional checks
and app rollback. Schema/data mutations, payments, staff authorization,
secrets, CDN/DNS cutovers, or destructive actions require target confirmation,
appropriate recoverable data, specific approval and a tested recovery path.
An unrelated Phase 2 backup failure must not block a safe standalone UI fix.

## Source conventions

- Next.js / React / TypeScript. Follow patterns and tests adjacent to the
  changed file. Use Tailwind v4 tokens (not a new `tailwind.config.js`).
- Public and staff Admin are separate; never expose staff permissions in
  public endpoints. Validate inputs and preserve existing Auth, RLS, CSP.
- Preserve product SKU, public prices, URL/SEO, image paths, and order-history
  facts; do not infer variant family membership from names or SKU prefixes.
- Do not commit credentials, private URLs or user data. Do not change shared
  runtime/database/DNS without the specific authorized scope.
- Useful checks: `npm run lint`, `npm run typecheck`, `npm test`,
  and the narrow build/test command for the affected app. Run only what is
  relevant; required CI is still the merge gate.

## Read more only when needed

- Detailed domain terms: `docs/agents/domain-glossary-full.md`.
- Legacy application rules: `docs/agents/application-conventions.md`.
- Extended release steps: `docs/WORKFLOW-WITH-CODEX.md`.
- Production change: verify current state, then read the **one** affected
  `docs/deploy/` runbook; historical `docs/ops/` evidence is not current proof.
- Architecture changes: read only the relevant `docs/adr/` decision.
- Project continuation: check the relevant GitHub Issue/PR; never trust a
  dated summary as a live release status.

Preserve unrelated work. Do not reset, delete, merge, deploy or mutate external
systems beyond the approved scope. Stop and report a real blocker rather than
silently weakening tests or security. No Production change without explicit
approval. Keep completion summaries brief and factual.
