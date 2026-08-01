# Pre-cutover GO/NO-GO - 2026-08-01

**Status:** `NO-GO` for both production-data cutover and DNS switch.

**Scope:** This is a planning and evidence summary only. It grants no authority
for a production write-freeze, final copy, database write, DNS mutation,
nameserver change, traffic switch or redirect.

## Release identity

| Item | Evidence |
|---|---|
| Release PR | #26, open, exact head `9aa93c3c565e23e459d4e4f24ba363805ab88134`; required checks previously passed |
| Accepted application source | `090ff89c981f8c6b2d851bf99d7fb8572dacc4da` |
| Stable staging image | `sha256:65fd6460f910468bba5e6d131e45ad63bcf6cd9fb1e067ffe0398423212e03df` |
| Production dark image | `sha256:e5eaadf454abe9b01bb35389e80b0828dac237d9cb4195dc289345627bfeab9b` |
| Existing public rollback baseline | Vercel remains reachable at `https://www.dongphugia.com.vn`; its apex returned HTTP `307` to `www` during the 2026-08-01 read-only check |

## Preparation evidence

- `FACT` - Dark target acceptance previously covered health, target-DB TLS,
  homepage, admin login/session/logout, media reads and Bunny disposable smoke.
- `FACT` - Backup, checksum, private off-host copy and isolated restore proof
  were completed in the prior approved scope. Their freshness must be
  re-verified for a newly approved window.
- `FACT` - Mắt Bão zone export is stored outside the repository:
  `/Users/m-ac/Downloads/dongphugia.vn-01082026022643.csv`.
  SHA-256:
  `5f8866721e952dc9bb6b19df2e86e9c4fab3b383659648f719a48f85d057033a`.
  It contains one record: `@ NS ns1.matbao.com., ns2.matbao.com.` with TTL
  `3600`; public authoritative NS delegation matched the export.
- `FACT` - Bunny/media disposable-write evidence remains accepted. Do not repeat
  it without a changed input or a new acceptance requirement.

## Proposed DNS plan - not approved and not applied

| Host | Type | Proposed value | TTL | Purpose |
|---|---|---:|---:|---|
| `dongphugia.vn` | A | `47.131.92.97` | 300 | Target apex ingress |
| `www.dongphugia.vn` | A | `47.131.92.97` | 300 | Canonical target ingress |

- No AAAA record is proposed.
- TLS must be valid for both apex and `www` before accepting canonical traffic.
- Any ACME DNS-01 TXT record requires a separate exact record/action approval.
- The old `.com.vn` domain remains on Vercel during the observation window; no
  old-domain redirect is in this window.

## Gate decision

### `PRODUCTION-DATA-WRITE-FREEZE-APPROVAL-GATE`: NO-GO

Required before a PM may consider this gate:

1. Approve a new maintenance/write-freeze window. The 31 July 2026 window has
   expired.
2. Re-verify the exact dark runtime digest, target PostgreSQL `verify-full`
   health, restart/capacity trend, source-backup/S3 checksum, restore proof and
   reconciliation freshness.
3. Name app, database, monitoring and rollback owners; confirm the final-copy,
   reconciliation, sequence and no-split-brain procedure.
4. PM must approve the exact freeze start, expected duration, user impact,
   rollback triggers and procedure before the freeze is enabled.

### `DNS-SWITCH-APPROVAL-GATE`: NO-GO

Required before a PM may consider this gate:

1. Recover P.A Việt Nam portal access and export the complete current
   `dongphugia.com.vn` zone, including all A/AAAA/CNAME/MX/TXT/CAA/SRV and TTL
   records.
2. Re-verify the current Vercel rollback deployment and retain it unchanged.
3. Validate target ingress and TLS for `dongphugia.vn` and
   `www.dongphugia.vn` without changing public traffic.
4. PM must approve the exact `.vn` records, TTL, DNS operator, rollback
   operator, expected downtime and SEO monitoring plan.

## Current blockers and ownership

- `HUMAN-ONLY` - P.A Việt Nam account recovery and old-domain zone export.
- `HUMAN-ONLY` - PM approval of a new production-data maintenance window.
- `HUMAN-ONLY` - PM/DNS operator approval before any ACME or DNS record change.
- `TECHNICAL ACCESS` - AWS read-only session reauthentication is needed to
  refresh runtime, database, capacity and backup metadata.
- `UNKNOWN` - Named backup DNS operator is not yet confirmed.

**Owners:** Codex coordinates technical evidence. PM owns GO/NO-GO and all
production-data/DNS approvals. PM/customer is the primary DNS operator.
