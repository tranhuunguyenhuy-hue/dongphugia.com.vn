# Dongphugia documentation map

Read the smallest set of sources that answers the active task. This map assigns
authority and status; it is not a second workflow manual. `CURRENT` sources
govern new work. `SUPPORTING` sources add task-specific detail. `HISTORICAL`
and `SUPERSEDED` sources preserve provenance only and do not authorize a new
delivery path.

## Always applicable

- `CURRENT` — Root [`AGENTS.md`](../AGENTS.md): authority, safety, scope, and
  gates.
- `CURRENT` — [`WORKFLOW-WITH-CODEX.md`](WORKFLOW-WITH-CODEX.md): routing,
  source delivery, validation, review, PR, merge, Staging, and release path.
- `SUPPORTING` — [`AGENTS.md`](AGENTS.md): application conventions; read only
  for source work.

Repository policy requires a task-owned PR, required CI, and PM approval before
merge to `main`. GitHub branch-protection configuration is live enforcement,
not an authority document: verify it immediately before relying on it.

## Choose by task

- `SUPPORTING` — [Current operational state](ops/project-current-state.md):
  dated Production baseline, active deferrals, incident follow-up, and handoff;
  revalidate it before runtime work.
- `CURRENT` — [Domain context](../CONTEXT.md): canonical catalogue and
  publishing language.
- `CURRENT` — [Architecture decisions](adr/): hard-to-reverse technical and
  policy choices. Read the status and related newer ADRs before relying on one.
- `CURRENT` — [Deployment procedures](deploy/): target-specific Staging and
  Production procedures. Read only the affected current runbook.
- `CURRENT` — [Isolated PostgreSQL Staging deployment foundation](deploy/isolated-staging-foundation.md):
  canonical database-backed candidate path (ADR 0013).
- `CURRENT` — [Canonical Migration Implementation Baseline](deploy/migration-implementation-baseline.md):
  locked migration target, candidate identity, approval matrix, rollback
  ownership, and seven-stage delivery sequence (LEO-533).
- `CURRENT` — [Product/Family preservation contract](deploy/product-family-preservation-contract.md):
  executable Product/Family schema, migration, relationship, and accepted
  MS885 data-preservation checks (LEO-534).
- `CURRENT` — [Migration free-tier and Owner-gate policy](deploy/migration-free-tier-policy.md):
  fail-closed budget preflight, provider-limit verification, and explicit
  Owner gates for later migration issues (LEO-532).
- `CURRENT` — [Supabase runtime security boundary](deploy/supabase-runtime-security-boundary.md):
  isolated Free target identity, least-privilege roles, forced RLS/Auth
  separation, Free-tier guards, secret-safe validation, and teardown boundary
  (LEO-539).
- `CURRENT` — [LEO-541 Supabase runtime API](deploy/supabase-runtime-api.md):
  authenticated Edge-to-RPC order/quote contract, owner-bound RLS,
  idempotency, advisory locks, rollback test, and static-render boundary.
- `CURRENT` — [Runtime backup and recovery](deploy/runtime-backup-recovery.md):
  encrypted logical backup, checksum manifest, isolated restore rehearsal, and
  Product/Family/Blog recovery checks (LEO-540).
- `CURRENT` — [Public static build](deploy/public-static-build.md):
  read-only build-time export, SEO/redirect output, inventory checks, and
  Product/Family preservation gate (LEO-536).
- `CURRENT` — [Dedicated isolated Staging EC2 IaC](../infra/dedicated-staging/README.md):
  dedicated-host topology and one-time source-safe clone capability (LEO-527).
- `SUPPORTING` — [CI-only disposable database fixtures](deploy/staging-db-bootstrap/RUNBOOK.md):
  test fixtures, not a Staging runtime procedure.
- `CURRENT` — [Workflow controls](WORKFLOW-WITH-CODEX.md#risk-proportionate-controls):
  the one standard workflow and risk-proportionate validation, recovery, and
  approval controls.
- `SUPPORTING` — [Design system](DESIGN_SYSTEM.md): UI token and component
  design work.
- `SUPPORTING` — [Public sitemap map](SITEMAP.md): crawl, sitemap, and public
  URL work.

## Superseded and historical paths

- `SUPERSEDED` — [ADR 0010](adr/0010-share-production-data-media-for-staging-candidate-validation.md)
  and the [shared-data Coolify runbook](deploy/staging-coolify.md) preserve the
  former shared Production-data/media topology. They are not a new candidate,
  migration, deployment, or Publishing rollout path.
- `SUPERSEDED` — [ADR 0011](adr/0011-use-risk-based-release-paths.md) records
  the former named release-path model. The current workflow uses one lifecycle
  with risk-proportionate controls instead.
- `HISTORICAL` — release evidence, status snapshots, past plans, and retained
  recovery material are provenance, not current workflow authority.

## ADR identifier register

ADR identifiers are unique. `ADR 0001` means only [Keep the Product SEO
contract simple and delete discontinued products](adr/0001-simple-product-seo-contract.md).
The accepted Publishing decision [Authorize zero-touch publishing per Machine
Identity](adr/0014-authorize-zero-touch-publishing-per-machine-identity.md) is
ADR 0014; it was renumbered from the former duplicate ADR 0001 without changing
its domain decision.

## Publishing integration

`CURRENT` — [Publishing API v1 integration guide](integrations/publishing-api-v1-integration-guide.vi.md)
is the single human-readable technical integration guide. The Production OpenAPI
document is its machine-readable contract. `SUPPORTING` — The [Publishing
operation guide](operations/ai-agent-publishing-operation-guide.vi.md) is for
approved Content operators and does not authorize connection, credentials, or
Platform changes.

Historical status, crawl, planning, and rollout evidence is not workflow
authority. Retain it in Git history or approved quarantine when required.
