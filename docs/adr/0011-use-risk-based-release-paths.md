# ADR 0011: Use risk-based release paths

## Status

Accepted

## Context

The repository previously treated broad infrastructure, backup, restore, and
operational-gate evidence as a default prerequisite for application delivery.
That made ordinary customer-facing changes depend on concerns outside their
actual blast radius.

## Decision

Use `FAST_PATH` by default for ordinary application changes. It requires a
task branch, focused validation plus applicable lint/typecheck, required CI, a
merged immutable Production Candidate, Staging validation of that same digest,
one Production rollout approval, Production smoke verification, and a verified
runtime rollback target when the deployment mechanism has a recoverable target.
When it does not, the rollout approval records the gap and explicitly accepts
the residual risk.

Use `FULL_PATH` only for material database, destructive data, infrastructure,
AWS/network/security, Coolify infrastructure, CDN/storage, DNS, broad
authentication/authorization, irreversible, major security-sensitive, or
difficult-rollback risks. Tailor additional controls—such as an Issue/spec,
architecture review, backup/restore readiness, infrastructure preflight,
staged migration/rollback plan, and broader acceptance—to the actual risk.

Every path preserves protected `main`, required CI, Staging-before-Production,
and same-digest promotion. Verify a runtime rollback target when one is
recoverable; otherwise record the residual risk in the Production approval.
Fail closed only when a missing invariant could materially harm Production.

## Consequences

- Routine branch, test, PR, CI, candidate, and Staging actions do not need
  repeated PM approval on Fast Path; Production rollout approval remains
  explicit.
- Restore rehearsal is operational hardening/disaster-recovery readiness. It
  blocks only releases whose risk depends on restore capability, rather than
  ordinary Fast Path releases without schema, permission, or destructive-data
  work.
- Teams stop once task acceptance and the applicable path are satisfied, record
  non-blocking findings as follow-up debt, and reuse infrastructure facts unless
  concrete drift requires revalidation.

## Related

- `docs/WORKFLOW-WITH-CODEX.md`
- ADR 0010: shared Production data/media Staging validation
- GitHub Issue #70: disaster-recovery hardening evidence
