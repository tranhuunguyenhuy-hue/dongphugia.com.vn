# ADR 0011: Use risk-based release paths

## Status

**Superseded — historical reference only.** The current governance model uses
one standard workflow with risk-proportionate validation, recovery, and approval
controls; it does not select named release paths. This ADR is retained to
preserve the prior decision and terminology.

Accepted

## Context

The repository previously treated broad infrastructure, backup, restore, and
operational-gate evidence as a default prerequisite for application delivery.
That made ordinary customer-facing changes depend on concerns outside their
actual blast radius.

## Decision

Use `FAST_PATH` for low-risk runtime-only application changes. It requires a
task branch, focused validation plus applicable lint/typecheck, required CI, a
merged immutable Production Candidate, Staging validation of that same digest,
one Production rollout approval, Production smoke verification, and a verified
runtime rollback target when the deployment mechanism has a recoverable target.
When it does not, the rollout approval records the gap and explicitly accepts
the residual risk.

Use `STANDARD` for meaningful API/runtime, authentication, upload, scheduler,
or application-logic risk without a destructive persistent-state migration. It
adds functional Staging validation and rollback readiness proportional to the
actual risk.

Use `HIGH_RISK` for database/schema/data mutation, destructive work,
storage/network authority changes, infrastructure with plausible data loss or
split-brain, and difficult rollback. Require fresh backup, checksum, private
copy, restore verification, rollback readiness, and no-split-brain evidence
when applicable to the affected persistent state.

Every path preserves protected `main`, required CI, Staging-before-Production,
and same-digest promotion. Verify a runtime rollback target when one is
recoverable; otherwise record the residual risk in the Production approval.
Fail closed only when a missing invariant could materially harm Production.

Shared-data Staging remains write-frozen. A candidate check that cannot legally
run there may be deferred only when related non-destructive evidence passes on
the same digest and the check becomes immediate mandatory Production acceptance
using existing Production data. This does not permit synthetic fixtures or
skipping feasible Staging validation.

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
- ADR 0010: superseded shared Production data/media Staging history
- GitHub Issue #70: disaster-recovery hardening evidence
