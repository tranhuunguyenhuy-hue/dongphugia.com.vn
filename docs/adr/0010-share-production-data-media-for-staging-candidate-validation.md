# ADR 0010: Share Production data and media for Staging candidate validation

## Status

Accepted

## Decision

Staging and Production use the same Production database/data and Production
CDN/media repository-wide. Staging remains a separate, separately addressable
runtime. GitHub Actions builds one immutable Production Candidate; that same
digest is validated on Staging before it is eligible for separately approved
Production promotion.

Staging is not a disposable data sandbox. It uses dedicated database-level
read-only principals for its Production-data connections where technically
feasible, fail-closed application write freezing as defense in depth, noindex
by default, disabled scheduler/side effects, and explicit PM gates for any
operation that could affect Production data, media, cache, users or an external
system.

## Consequences

- Production data/media rendering is validated as closely as possible before
  promotion, including Publishing Managed Media.
- A staging-only build, synthetic staging runtime, staging media fallback or
  mutable tag cannot prove Production Candidate acceptance.
- CI fixtures remain disposable test infrastructure only; seed/reset/migration
  commands are prohibited against the shared runtime.
- The current repository does not prove read-only Staging database principals
  are configured. Provisioning and verifying them is an implementation item in
  the risk-triggered Staging alignment plan, not a claim about current runtime.
- Expected environmental differences are limited to runtime addressability,
  authentication, noindex/write-freeze guardrails and separately authorized
  side effects.
- The executable order is source PR validation, Gate A merge, protected-main
  Production Candidate build, Gate B Staging alignment/acceptance, then Gate C
  Production promotion. Old staging resources are retained for rollback until
  separately approved for cleanup.

## Related

- GitHub Issue #68
- `docs/deploy/staging-coolify.md`
- Issue #66 Managed Media acceptance
- ADR 0011: risk-based release paths
