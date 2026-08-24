# Coolify staging runbook

Staging is a private, manual-gated environment for reviewing an immutable
candidate before a merge or production rollout. It is not production and must
use the dedicated synthetic PostgreSQL database.

## Candidate contract

1. CI builds the exact reviewed commit for `linux/arm64` and records the
   immutable GHCR digest, source revision and scan result.
2. A human with Coolify access selects that exact digest in the existing staging
   application; no mutable image tag is accepted as evidence.
3. Verify `/api/health`, core public routes, representative mobile routes,
   metadata/robots/sitemap and synthetic database isolation.
4. Record the commit, digest, validation result, previous digest and rollback
   choice in the PR and its linked GitHub Issue when one exists.

## Safety rules

- Staging always uses `noindex` and never advertises the production hostname.
- When Staging runs a production-configured candidate for parity, set
  `STAGING_SAFETY_MODE=true` at build and runtime. This explicit Staging-only
  guardrail forces `noindex` and the server-side write freeze; Production must
  leave the flag unset.
- Do not commit environment values or Coolify/GHCR credentials.
- No production database, DNS, Bunny, Vercel, traffic or runtime mutation is
  implied by a staging validation.
- If a validation fails, stop on the previously accepted staging digest and
  obtain a new approved candidate; do not guess a rollback image.

The staging database schema, synthetic seed, checksums and bootstrap procedure
are maintained in [`staging-db-bootstrap/`](staging-db-bootstrap/RUNBOOK.md).
