# ADR 0015: Dedicated EC2 Staging replaces the co-hosted topology

## Status

Accepted for LEO-527 implementation; canonical after the LEO-527 source PR
merges and dedicated-host acceptance passes. The co-hosted arrangement is
deprecated and superseded as the canonical Staging target.

## Context

The former topology placed Production and Staging services on one EC2 host.
That host experienced OOM-killer activity and an impaired instance state, and
SSM RunCommand/Session Manager recovery became unreliable. Recovery that needs
stop/start, replacement, or broad host remediation crosses the Production
availability boundary. Shared-host Staging also makes a future reboot,
database restore, or test operation harder to prove as Production-safe.

## Decision

Use two host boundaries:

```text
old: Production + Staging co-hosted on one EC2
new: Production host only + dedicated Staging EC2
```

The dedicated host is created by
[`infra/dedicated-staging/dedicated-staging.yaml`](../../infra/dedicated-staging/dedicated-staging.yaml)
and is identified by Staging-only tags, a dedicated subnet/security group,
separate instance profile, encrypted EBS data volume, and the canonical
Docker ownership marker. It runs only the isolated Staging PostgreSQL and app
contract from `docs/deploy/isolated-staging-foundation.md`.

The management path is SSM-first. IMDSv2 is required, SSH is not opened,
PostgreSQL is not public, and the instance profile contains no standing
Production backup/database/application permissions. A one-time exact-object
S3 read for the approved clone is removed immediately after restore. The
security group permits the web ingress needed for bounded Staging browser
smoke and protocol-level DNS/HTTP/HTTPS egress required for bootstrap and the
approved source-safe clone path. Isolation additionally depends on no
Production credentials, no database-port access, and runtime guardrails. No
Production SG, route, EIP, volume, container, or DNS resource is changed by
this decision.

## Production-derived clone path

The preferred path is an approved Production-derived daily backup object plus
its checksum sidecar. During the one-time clone, the dedicated Staging role
receives `s3:GetObject` for exactly those two object ARNs; the capability is
removed immediately after checksum verification and restore. The dump exists
only on the dedicated Staging data volume during the operation and is never
committed, logged, or returned in chat.

A direct PostgreSQL clone may use the LEO-523 principal only after a fresh
effective-permission attestation proves `NOSUPERUSER`, `NOBYPASSRLS`, no role
membership that grants DML, and no effective INSERT/UPDATE/DELETE privilege.
Application write freeze is defense in depth, not a substitute for a read-only
source boundary. If the attestation fails, do not change Production grants in
LEO-527; use the approved backup path or stop.

The restore target is the Staging-owned `dpg_isolated_staging` database, with
`dpg_staging_migrator`, `dpg_staging_app`, marker
`dongphugia:isolated-staging:v1`, dedicated network/volume ownership, and
`WRITE_FREEZE_MODE=true`. Production application/database contents and
permissions are not mutated.

## Transition and rollback

Provision the dedicated stack, prove SSM start-to-success, bootstrap the
canonical contract, restore the representative dataset, deploy the exact
immutable ARM64 candidate, and complete isolation/browser/side-effect checks.
Only then is the dedicated host canonical for downstream LEO-525 work.

Rollback before handoff is limited to resources carrying the LEO-527 ownership
tags: recreate the dedicated EC2, Docker network/volume, and Staging database
from the retained source backup or retained encrypted EBS volume. Do not
stop/start/replace the old Production host. Do not delete old co-hosted
resources in this ADR; inaccessible legacy residue is cleanup debt for LEO-528.

## Consequences

- Staging reboots, restores, and migration QA no longer share the Production
  host boundary.
- The dedicated host has normal EC2/EBS/network cost approved by the Product
  Owner; no unrelated paid service is introduced.
- Source data remains sensitive and transient; only sanitized status, hashes,
  and contract evidence are retained in the handoff.
- The old co-hosted runbook/evidence remains useful history but is not a current
  provisioning or acceptance path.

## Related

- LEO-527 — Infrastructure — Provision dedicated isolated Staging EC2
- LEO-525 — downstream MS885 migration + Product/PDP smoke QA
- LEO-523 — Production verified read-only data access path
- LEO-528 — Production host stabilization and legacy residue retirement
- `infra/dedicated-staging/README.md`
- `docs/deploy/isolated-staging-foundation.md`
- ADR 0013
