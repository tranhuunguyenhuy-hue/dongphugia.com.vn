---
status: accepted
---

# Use environment-bound rotating Bearer credentials

## Partial supersession

This ADR remains the historical decision for the Publishing credential model.
ADR 0010 supersedes only its original Shared-data Staging implication: the
current Shared-data Staging runtime is write-frozen and receives no Publishing
credential. Approved integrations use an environment-bound Production
credential against the Production API contract. The Production rotation and
revocation decision below remains active.

## Original decision

Each Machine Identity will authenticate server-to-server with its own
high-entropy opaque Bearer credential, whose secret is shown once and stored
only as a hash. The original design separated staging and production
credentials; production credentials expire after 90 days by default, rotation
may overlap at most two active credentials for seven days, expiry never extends
on use, and emergency revocation blocks new API requests immediately without
changing already published content or independently authorized schedules.

## Current authority

- ADR 0010 defines the Shared-data Staging architecture.
- `docs/deploy/staging-coolify.md` defines its write-frozen operating rules.
- `docs/deploy/publishing-api-v1-runbook.md` defines current Publishing
  operations.
