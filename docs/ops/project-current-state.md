# Project current state

Last verified: 2026-08-21. This is a dated operational snapshot, not release
authority. Revalidate live state immediately before any runtime mutation.

## Production baseline

- Application: `dongphugia-web-production-dark`
- Immutable image digest:
  `sha256:5826df04c8b052b7c834a07ac956d54596537def964646dc2d3013c242dacf2c`
- Source provenance: `d7cd7dffac72894fd42359df58b9959c133280ef`
- Observed status: healthy; Blog Managed Media CSP incident resolved.

## Runtime architecture

GitHub → GitHub Actions → Docker ARM64 → GHCR → Coolify → AWS EC2.
The application uses Next.js, React, Node.js, Prisma, AWS PostgreSQL, and
Bunny for managed media/CDN delivery.

## Current constraints

- Verify the actual running digest after a Coolify deployment; a completed
  deployment record does not prove runtime identity.
- Media-related acceptance includes rendered browser, health, HTTP, CSP, and
  direct-host checks where applicable.
- The publishing CDN hostname is required in both Next image allowlisting and
  Production `img-src` CSP.
- The isolated PostgreSQL Staging foundation is the canonical database-backed
  candidate path; see `deploy/isolated-staging-foundation.md` and ADR 0013.
- The shared Production-data/media Staging path is legacy and historical only;
  see `deploy/staging-coolify.md` and ADR 0010.

## LEO-527 Staging topology transition

As of 2026-08-27, the approved architecture target is:

- Production remains on its existing Production-owned host.
- Isolated Staging is intended to become canonical on a dedicated EC2 stack
  defined in `infra/dedicated-staging/` after the LEO-527 acceptance gate.
- The old Production + legacy Staging co-host is deprecated/superseded for
  Staging and is not cleaned up by LEO-527; residual cleanup belongs to LEO-528.

Runtime acceptance is recorded separately from this architecture source:
dedicated EC2 identity, SSM start-to-success probe, contract attestation,
Production-derived restore, exact candidate revision, and side-effect/isolation
proof must all be freshly revalidated before downstream LEO-525 work. Until
that evidence is recorded, dedicated-host runtime readiness is `UNKNOWN`.

## Deferred scopes

Separate PM authorization is required before resuming:

- PR #69 investigation and Issue #68 shared-data migration.
- Cloudflare or Vercel migration; Coolify replacement.
- LCP optimization or Production promotion.
- MS885, Phase 2 catalogue/PIM, and unrelated refactoring.
- Permanent deletion of the 2026-08-04 consolidation quarantine.

For routing, approval, rollback, and Production gates, read root `AGENTS.md`,
`WORKFLOW-WITH-CODEX.md`, and the affected runbook; do not treat this snapshot
as a substitute.
