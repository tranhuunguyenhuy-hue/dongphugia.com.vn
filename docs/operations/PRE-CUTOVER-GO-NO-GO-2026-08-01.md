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
- `FACT` - P.A Việt Nam export is stored outside the repository:
  `/Users/m-ac/Downloads/dns_records_dongphugia_com_vn_2026-08-01_22-03-51.csv`.
  The UTF-8/BOM CSV has 10 columns, 5 customer-managed rows, no duplicates,
  and SHA-256
  `cd05ed3f9413f9af99da855cd99331271819e3411227ddb8bd622c0c70f1ad50`.
  Sanitized inventory: `@ TXT` TTL `3600` (value withheld; checksum-only
  verification), `cdn CNAME -> dpg-products.b-cdn.net` TTL `3600`, `@ A ->
  216.198.79.1` TTL `3600`, `www CNAME ->
  f67c116b40bea258.vercel-dns-017.com` TTL `3600`, and `* A ->
  103.9.159.156` TTL `300`. The exact second host is `cdn`, not `cd`.
  Read-only authoritative comparison passed for all five records. Current
  authoritative NS are `ns1.pavietnam.vn` and `ns2.pavietnam.vn`; no public MX
  or CAA data was observed. Evidence timestamp is 2026-08-01 22:03:51
  Asia/Ho_Chi_Minh (filename timestamp).
- `FACT` - Bunny/media disposable-write evidence remains accepted. Do not repeat
  it without a changed input or a new acceptance requirement.

## AWS and backup refresh - 2026-08-01

- `FACT` - AWS account `503344933326`, region `ap-southeast-1`; EC2
  `i-011fe10948e0a8c15` is running as `t4g.small`, instance and system status
  checks are `ok`, and SSM is `Online`.
- `FACT` - The exact EIP attached to the instance is `47.131.92.97`
  (`eipalloc-0c4913a4df24f1722`, association
  `eipassoc-092dfef7841b0f635`).
- `FACT` - Coolify dark container
  `ydgt1mkagpitpq8shovd726z-124225689632` is running with image reference
  `ghcr.io/tranhuunguyenhuy-hue/dongphugia-web@sha256:e5eaadf454abe9b01bb35389e80b0828dac237d9cb4195dc289345627bfeab9b`,
  healthy, restart count `0`, and no published host ports. Internal health
  returned HTTP `200`.
- `FACT` - Target PostgreSQL container is running with no published host ports;
  `pg_isready` accepted connections for `dongphugia_production`, and server
  `ssl` is `on`. Its current Docker restart count is `11`; this is a monitoring
  item, not proof of a current outage.
- `FACT` - Last 24-hour EC2 CPU averages were approximately `8.25%`-`13.08%`
  with observed hourly maximum `34.42%`; CPU credit balance stayed approximately
  `575.2`-`576`. Host memory had `702 MiB` available at refresh and `486 MiB`
  swap in use; retain this as a capacity watch item.
- `FACT` - S3 bucket metadata passed: `AES256` SSE-S3, all four Block Public
  Access controls enabled, eight objects totaling `282,346,563` bytes, newest
  object `2026-07-31T19:17:55Z`.
- `FACT` - Source dump checksum and archive-index inspection passed: source
  dump `...082929Z.dump`, `977` archive entries. Latest target-public dump
  checksum and archive-index inspection passed: `...191712Z.dump`, `623`
  archive entries. No dump rows were printed.
- `FACT` - Existing source object
  `daily/2026/07/31/dongphugia-production-20260731T082929Z.dump` was reused;
  no fresh production dump was created. S3 metadata remained `52,776,596`
  bytes, SSE-S3, with manifest size `110` bytes. The downloaded object matched
  its manifest: SHA-256
  `efc2ee8a137407600afc972971bc8b6e228d27c3b78f240aa0a3403192fc9407`.
- `FACT` - `pg_restore --list` passed before restore with `977` archive entries.
  The archive contained no `auth`, `storage` or `vault` schema entries. Restore
  was limited to schema `public` with owner/privilege restoration disabled.
- `FACT` - Disposable target was local PostgreSQL `17.6-alpine`, container
  `dpg-restore-drill-20260801-a`, with no published port and no persistent
  volume. Final restore completed with exit code `0`, zero stderr lines and zero
  restore warnings/errors. A first invocation was rejected for an omitted
  database role before any restore; the corrected `-U postgres` invocation
  passed.
- `FACT` - Restored public inventory was `46` tables, `45` sequences and `224`
  indexes; no non-system objects existed outside `public`. Aggregate critical
  counts were: `orders 15`, `order_items 31`, `quote_requests 13`,
  `quote_items 14`, `customers 6`, `products 17,752`, `product_images
  110,321`, `categories 5`, `subcategories 35`, `admin_users 1` and
  `admin_sessions 1`. No row contents or PII were read into evidence.
- `FACT` - Foreign-key catalog validation passed (`56` FKs, `0` not-valid),
  and all checked order, quote, product and admin assignment orphan counts were
  `0`. Critical sequence alignment was `ALIGNED` for all checked tables; four
  unused public sequences were empty and did not represent a sequence-behind
  condition.
- `FACT` - Media aggregate checks passed without exposing paths: all `110,321`
  product-image URLs and `17,751` non-null product main-image URLs were
  absolute HTTP(S) URLs, with `4` distinct host buckets in each set. Banner
  URLs were `7/7` absolute with `2` host buckets; subcategory hero URLs were
  all null in the restored data. No media hostname/path mismatch was observed.
- `FACT` - A timed second restore into an isolated disposable database measured
  `23.56 s` (`RTO` evidence). The application HTTP smoke was not run against
  this local-only target because no separate isolated app endpoint was exposed;
  the existing dark-target read-only smoke remains unchanged. Database-level
  read-only schema/aggregate smoke passed.
- `FACT` - Cleanup passed: the disposable container was removed, no drill named
  volume remained, and no AWS resource was provisioned. External one-time cost
  was `$0`, below the approved `$5` ceiling. The pre-existing PostgreSQL client
  image cache was not deleted.
- `GATE` - Restore/reconciliation refresh is `PASS` for this isolated proof.
  It does not authorize production write-freeze, final copy/delta, migration,
  traffic or DNS changes; those gates remain `NO-GO` pending their separate PM
  approvals.

## Proposed DNS plan - not approved and not applied

| Host | Type | Proposed value | TTL | Purpose |
|---|---|---:|---:|---|
| `dongphugia.vn` | A | `47.131.92.97` | 300 | Target apex ingress |
| `www.dongphugia.vn` | A | `47.131.92.97` | 300 | Canonical target ingress |

- No AAAA record is proposed.
- No CNAME record is proposed for the new `.vn` apex or `www`; both proposed
  names use the A records shown above.
- TLS must be valid for both apex and `www` before accepting canonical traffic.
- Any ACME DNS-01 TXT record requires a separate exact record/action approval.
- The old `.com.vn` domain remains on Vercel during the observation window; no
  old-domain redirect is in this window.

## Current `.com.vn` rollback snapshot - read-only, not applied

| Host | Type | Current value/target | TTL |
|---|---|---|---:|
| `@` | TXT | value withheld; checksum-only evidence | 3600 |
| `cdn` | CNAME | `dpg-products.b-cdn.net` | 3600 |
| `@` | A | `216.198.79.1` | 3600 |
| `www` | CNAME | `f67c116b40bea258.vercel-dns-017.com` | 3600 |
| `*` | A | `103.9.159.156` | 300 |

Authoritative NS: `ns1.pavietnam.vn`, `ns2.pavietnam.vn`. No public MX/CAA
records were observed. Export checksum:
`cd05ed3f9413f9af99da855cd99331271819e3411227ddb8bd622c0c70f1ad50`.

## PM gate package - current decision inputs

| Category | Current evidence / decision state |
|---|---|
| `FACT` release | PR #26 head `9aa93c3c565e23e459d4e4f24ba363805ab88134`; accepted source `090ff89c981f8c6b2d851bf99d7fb8572dacc4da`; stable staging digest `sha256:65fd6460f910468bba5e6d131e45ad63bcf6cd9fb1e067ffe0398423212e03df`; dark digest `sha256:e5eaadf454abe9b01bb35389e80b0828dac237d9cb4195dc289345627bfeab9b` |
| `FACT` runtime | Dark container `ydgt1mkagpitpq8shovd726z-124225689632` healthy, restart `0`; target PostgreSQL is private, SSL on; Vercel `.com.vn` remains rollback baseline |
| `FACT` data safety | Existing dump/checksum, isolated public-schema restore, FK/orphan/sequence/media reconciliation PASS; RTO `23.56 s`; cleanup PASS; cost `$0` |
| `FACT` DNS | `.vn` Mắt Bão export and `.com.vn` P.A export are checksum-verified; proposed `.vn` A records and TTL are listed above; no DNS mutation |
| `FACT` web/SEO baseline | Target release has canonical, sitemap and robots paths in the accepted application evidence; old-domain redirects remain disabled |
| `PM decision required` | Approve a new write-freeze/final-copy window, exact start/duration, user impact, named app/DB/monitoring/rollback owners and rollback triggers |
| `PM decision required` | Separately approve DNS records, TLS/ACME actions, expected downtime, SEO monitoring and PM as primary DNS operator |
| `ASSUMPTION` | No backup DNS operator is available unless PM names one; this is a single-human dependency |
| `UNKNOWN` | Public TLS issuance/readiness for both new `.vn` names still requires final ingress/certificate validation without DNS mutation; Search Console/GTM ownership and post-cutover 404/redirect monitoring still need named operators |

Expected cutover impact is a short controlled write-freeze plus DNS propagation;
exact downtime remains an approval input. Rollback sequence is: stop/abort
target writes, restore Vercel/domain records from the snapshot, validate old
domain health, then observe before any retry. Old-domain redirects remain
disabled until a separate post-observation approval.

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

1. Use the checksum-verified P.A Việt Nam export as the rollback snapshot; the
   former human-only export blocker is closed.
2. Re-verify the current Vercel rollback deployment and retain it unchanged.
3. Validate target ingress and TLS for `dongphugia.vn` and
   `www.dongphugia.vn` without changing public traffic.
4. PM must approve the exact `.vn` records, TTL, DNS operator, rollback
   operator, expected downtime and SEO monitoring plan.

## Current blockers and ownership

- `FACT` - P.A Việt Nam full customer-managed zone export is now verified and
  the former human-only blocker is closed.
- `HUMAN-ONLY` - PM approval of a new production-data maintenance window.
- `HUMAN-ONLY` - PM/DNS operator approval before any ACME or DNS record change.
- `FACT` - AWS read-only session was reauthenticated and the refresh above was
  completed without reading credentials or secret values.
- `UNKNOWN` - Named backup DNS operator is not yet confirmed.

**Owners:** Codex coordinates technical evidence. PM owns GO/NO-GO and all
production-data/DNS approvals. PM/customer is the primary DNS operator.
