# Project Current State

Last verified: 2026-08-21. This document records the active operational
baseline for follow-up work; revalidate live state before any mutation.

## Production Status

- Production application: `dongphugia-web-production-dark`
- Current production immutable digest:
  `sha256:5826df04c8b052b7c834a07ac956d54596537def964646dc2d3013c242dacf2c`
- Provenance: `d7cd7dffac72894fd42359df58b9959c133280ef`
- Status: healthy; the Blog Managed Media CSP incident is resolved.

## Current Architecture

- Next.js, React, Node.js, Prisma, and PostgreSQL.
- GitHub → GitHub Actions → Docker ARM64 → GHCR → Coolify → AWS EC2.
- Bunny provides managed media and CDN delivery.

## Deployment Rules

- Apply the authoritative [Production gates](../../AGENTS.md#production-and-secret-gates)
  and [release-path policy](../WORKFLOW-WITH-CODEX.md) before every Production
  mutation.
- `FAST_PATH`, `STANDARD`, and `HIGH_RISK` definitions, including the stronger
  controls for persistent-state changes, live in that release-path policy.
- The resolved CSP-only incident was a `FAST_PATH` rollout. Classify each
  follow-up independently under the authoritative policy.

## Important Decisions

- The current Production baseline is the CSP-only hotfix above; it excludes
  PR #69 runtime behavior.
- The Publishing CDN hostname is required in both the Next image allowlist and
  the Production `img-src` CSP.
- Platform migration decisions remain paused.

## Deferred Scopes

The following remain deferred and require separate PM authorization; routine
follow-up work must not resume them implicitly.

- PR #69 investigation.
- Issue #68 and shared-data migration.
- Cloudflare or Vercel migration.
- Coolify replacement.
- LCP optimization and Production promotion.
- Unrelated refactoring.

## Known Operational Notes

- Verify the actual running runtime digest after a Coolify deployment; a
  completed deployment record alone is insufficient evidence.
- Production acceptance must include the rendered browser result as well as
  health, HTTP, and CSP checks when image delivery is in scope.
- The 2026-08-04 consolidation quarantine remains subject to retention and
  requires fresh explicit approval before permanent deletion.

## Workflow Baseline

The core delivery workflow is risk-scoped: FAST_PATH is the default for small,
low-risk work, while stronger review and release controls follow actual blast
radius and persistence. Publishing documentation is aligned to ADR 0010 and
`docs/deploy/staging-coolify.md`: Dedicated-data Staging is write-frozen validation,
while approved integrations use the Production Publishing API/credential
contract. This documentation baseline does not authorize credential, runtime,
data, media, deployment, or infrastructure changes.
