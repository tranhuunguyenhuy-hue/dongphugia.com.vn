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

## Technical readiness refresh - 2026-08-01 22:33 Asia/Ho_Chi_Minh

- `FACT` - PR #29 remains open/draft at exact head
  `31b6e1c60ee35cd2eab13a515d492c0f1e1c9e7b`; quality, homepage-readiness,
  Vercel and preview comments are all `PASS`.
- `FACT` - AWS profile `dongphugia-admin` is valid for account `503344933326`
  in `ap-southeast-1`; EC2 `i-011fe10948e0a8c15` is arm64/running, status checks
  are `ok`, EIP is `47.131.92.97`, and SSM agent `3.3.4624.0` is `Online`.
- `FACT` - Current dark app identity is resource
  `dongphugia-web-production-dark` in Coolify project `dongphugia-staging`,
  container `ydgt1mkagpitpq8shovd726z-124225689632`, exact image digest
  `sha256:e5eaadf454abe9b01bb35389e80b0828dac237d9cb4195dc289345627bfeab9b`.
  It is healthy, restart count `0`, internal HTTP `/` returned `200`, and the
  container has no published host port.
- `FACT` - Coolify ingress identity is container `coolify-proxy` running
  `traefik:v3.6`, healthy, publishing host ports `80`, `443` and `8080`. The
  dark app router is HTTP-only: `Host(dpg-production-dark.invalid)` with
  `PathPrefix(/)` to service port `3000`; no HTTPS router or TLS certificate
  coverage exists for either `.vn` name. Host-header validation returned HTTP
  `200` only for the invalid internal host, and HTTP `404` for both proposed
  `.vn` hosts. HTTPS validation returned `503` for all three hosts.
- `FACT` - The current TLS SNI certificate is the Traefik default certificate
  (`CN=TRAEFIK DEFAULT CERT`) with an internal generated SAN, not
  `dongphugia.vn` or `www.dongphugia.vn`, valid 2026-08-01 through 2027-08-01.
  This is a hard technical blocker for ingress readiness. No DNS or certificate
  mutation was made.
- `FACT` - Target PostgreSQL remains private; `pg_isready` passes, server
  `ssl=on`, minimum TLS is `TLSv1.2`, and current `pg_stat_ssl` showed `4/5`
  active sessions using SSL. `verify-full` client validation was not reproven
  without reading secret values; the previous verify-full result is therefore
  `STALE EVIDENCE` for this checkpoint.
- `FACT` - Current resource snapshot: app `127 MiB / 512 MiB`, target DB
  `130.2 MiB / 640 MiB`, host available memory `690 MiB`, swap used `488 MiB`;
  DB Docker restart count remains `11`. CloudWatch last-24-hour CPU average
  ranged about `7.97%`-`8.97%`, with hourly maximum `34.37%`.
- `FACT` - Read-only dark acceptance through the internal HTTP router passed:
  homepage, `/sitemap.xml`, `/robots.txt`, `/admin/login`, hero endpoints at
  widths `720` and `1280` all returned `200`. Canonical, `og:url`, JSON-LD and
  `.vn` references were present; all six checked security headers were present.
  No credential was entered and no session or business write was created.
- `FACT` - Accepted source `090ff89...` statically contains the central Prisma
  write guard plus order, quote, admin, upload and revalidation freeze coverage;
  this is source evidence only. Existing admin login/session evidence remains
  current from the prior accepted smoke and was not repeated.
- `GATE` - TLS/ingress readiness is `NO-GO` until a dark-only router and
  certificate covering both `.vn` names are prepared and validated. If ACME
  requires DNS-01, only the exact challenge record/action may be presented for
  PM/operator approval; no challenge record is created here.

## Proposed DNS plan - not approved and not applied

| Host | Type | Proposed value | Pre-cutover TTL | Observation/steady TTL |
|---|---|---:|---:|---:|
| `dongphugia.vn` | A | `47.131.92.97` | 300 | 300 |
| `www.dongphugia.vn` | A | `47.131.92.97` | 300 | 300 |

- No AAAA record is proposed.
- No CNAME record is proposed for the new `.vn` apex or `www`; both proposed
  names use the A records shown above.
- The apex must return HTTP `308` to `https://www.dongphugia.vn`, preserving
  path and query string. This redirect is a planned router behavior, not
  currently active.
- TLS must be valid for both apex and `www` before accepting canonical traffic.
- Any ACME DNS-01 TXT record requires a separate exact record/action approval.
- The old `.com.vn` domain remains on Vercel during the observation window; no
  old-domain redirect is in this window.
- TTL `300` is the proposed pre-cutover and observation value; any later
  steady-state TTL change requires PM approval.

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
| `FACT` ingress | `coolify-proxy` / Traefik `v3.6` is healthy on ports 80/443/8080, but dark route is HTTP-only on `dpg-production-dark.invalid`; proposed `.vn` hosts return 404/503 and default TLS certificate is not domain-covered |
| `FACT` dark acceptance | Internal read-only homepage, sitemap, robots, admin login GET, hero 720/1280, canonical/OG/JSON-LD and security headers passed; no credential/session/business write was created |
| `STALE EVIDENCE` DB TLS | Server SSL is on and active connections are encrypted, but client `verify-full` was not reproven in this refresh without secret exposure |
| `FACT` data safety | Existing dump/checksum, isolated public-schema restore, FK/orphan/sequence/media reconciliation PASS; RTO `23.56 s`; cleanup PASS; cost `$0` |
| `FACT` DNS | `.vn` Mắt Bão export and `.com.vn` P.A export are checksum-verified; proposed `.vn` A records and TTL are listed above; no DNS mutation |
| `FACT` web/SEO baseline | Target release has canonical, sitemap and robots paths in the accepted application evidence; old-domain redirects remain disabled |
| `TECHNICAL BLOCKER` | Dark-only ingress/TLS route for `dongphugia.vn` and `www.dongphugia.vn` is not prepared; ACME method and certificate ownership must be resolved before DNS gate |
| `PM decision required` | Approve a new write-freeze/final-copy window, exact start/duration, user impact, named app/DB/monitoring/rollback owners and rollback triggers |
| `PM decision required` | Separately approve DNS records, TLS/ACME actions, expected downtime, SEO monitoring and PM as primary DNS operator |
| `ASSUMPTION` | No backup DNS operator is available unless PM names one; this is a single-human dependency |
| `UNKNOWN` | Search Console/GTM ownership and post-cutover 404/redirect monitoring still need named operators; target client `verify-full` must be refreshed secret-safely |

Expected cutover impact is a short controlled write-freeze plus DNS propagation;
exact downtime remains an approval input. Rollback sequence is: stop/abort
target writes, restore Vercel/domain records from the snapshot, validate old
domain health, then observe before any retry. Old-domain redirects remain
disabled until a separate post-observation approval.

Candidate windows (planning only, not approved):

- Window A: `23:00-23:30` Asia/Ho_Chi_Minh on a date selected by PM.
- Window B: `10:00-10:30` Asia/Ho_Chi_Minh on a date selected by PM.

### Approval package A - `PRODUCTION-DATA-WRITE-FREEZE-APPROVAL-GATE`

- Exact release: source `090ff89c981f8c6b2d851bf99d7fb8572dacc4da`, stable
  staging digest
  `sha256:65fd6460f910468bba5e6d131e45ad63bcf6cd9fb1e067ffe0398423212e03df`,
  dark digest
  `sha256:e5eaadf454abe9b01bb35389e80b0828dac237d9cb4195dc289345627bfeab9b`.
- Target identity: EC2 `i-011fe10948e0a8c15` / EIP `47.131.92.97`, Coolify
  dark resource `dongphugia-web-production-dark`, target DB
  `dongphugia_production` private. Current app/DB writes remain unfrozen.
- Required PM signature: selected window, exact freeze start, expected
  15-20-minute duration, final dump/final delta and reconciliation procedure,
  no-split-brain owner, app/DB/monitoring/rollback owners, user impact and
  rollback triggers.
- Data safety evidence is PASS, but current target client `verify-full` is
  stale for this refresh and must be revalidated before freeze. Decision:
  `NO-GO`.

### Approval package B - `DNS-SWITCH-APPROVAL-GATE`

- Proposed records: apex and `www` A `47.131.92.97`, TTL `300` pre-cutover and
  during observation; no AAAA/CNAME. Apex HTTP `308` to canonical HTTPS `www`,
  preserving path/query. Old `.com.vn` redirects remain disabled.
- Rollback records: use the checksum-verified P.A snapshot above; Vercel and
  the old domain remain unchanged. PM is primary DNS operator; no backup
  operator is named, so this is a single-human dependency.
- Required PM signature: exact records/TTL, Mắt Bão/P.A operator actions,
  TLS/ACME action, expected downtime, rollback propagation assumptions and
  SEO/canonical/sitemap/robots/Search Console/GTM monitoring.
- Current technical blocker: dark Coolify route has no HTTPS router or
  certificate for either `.vn` host. Decision: `NO-GO` until dark-only ingress
  and TLS validation pass.

## Gate decision

### `PRODUCTION-DATA-WRITE-FREEZE-APPROVAL-GATE`: NO-GO

Required before a PM may consider this gate:

1. Approve a new maintenance/write-freeze window. The 31 July 2026 window has
   expired.
2. Re-verify the exact dark runtime digest, target PostgreSQL `verify-full`
   health (current server SSL is not sufficient; prior client evidence is
   stale), restart/capacity trend, source-backup/S3 checksum, restore proof and
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
- `TECHNICAL BLOCKER` - Coolify dark ingress has no `.vn` HTTPS routers or
  domain-covered certificate; current internal router is only
  `dpg-production-dark.invalid` over HTTP.
- `HUMAN-ONLY` - PM approval of a new production-data maintenance window.
- `HUMAN-ONLY` - PM/DNS operator approval before any ACME or DNS record change.
- `FACT` - AWS read-only session was reauthenticated and the refresh above was
  completed without reading credentials or secret values.
- `UNKNOWN` - Named backup DNS operator is not yet confirmed.

**Owners:** Codex coordinates technical evidence. PM owns GO/NO-GO and all
production-data/DNS approvals. PM/customer is the primary DNS operator.

## Dark-only ingress/TLS preparation checkpoint - 2026-08-01 23:17 Asia/Ho_Chi_Minh

### Verified facts

- Coolify app `ydgt1mkagpitpq8shovd726z` (`dongphugia-web-production-dark`)
  is running the exact digest
  `sha256:e5eaadf454abe9b01bb35389e80b0828dac237d9cb4195dc289345627bfeab9b`
  from source revision `090ff89c981f8c6b2d851bf99d7fb8572dacc4da`.
- Latest successful deployment is `uedctlreknzlgyh7ogvjph4p`; runtime
  container `ydgt1mkagpitpq8shovd726z-161316206465` is healthy with zero
  restarts. Prior successful deployments in this configuration sequence were
  `zufd6h8561kxolkpv6ga5yxf`, `lvklw7azumo4jdecc9sa6ftf` and
  `o2tvmkud0es2chkf06d4uevq`.
- Custom `apex-to-www` middleware is saved with `permanent=true`, but runtime
  generated apex router precedence still produces HTTP `302` from
  `dongphugia.vn` to `https://dongphugia.vn/...`; required HTTP `308` to
  `https://www.dongphugia.vn/...` is not met. `www` HTTP also returns `302`
  to HTTPS as expected from the generated redirect-to-https router.
- Internal HTTPS read-only checks passed for homepage, sitemap, robots, admin
  login GET, hero widths 720/1280, canonical/OG/JSON-LD and the checked
  security headers. The synthetic validation path returned `404` on HTTPS
  `www`, which is not a product route.
- Runtime SNI still serves Traefik default certificate `CN=TRAEFIK DEFAULT
  CERT` with an internal generated SAN, not either `.vn` hostname. No ACME
  challenge or DNS record was created.
- Runtime-only DB refresh proved `sslmode=verify-full`, client connection OK,
  server SSL true, TLS 1.3 and a cipher present for the private target host;
  no URL/password value was recorded and no DB write occurred.

### Decisions, assumptions and unknowns

- `PM DECISION` - Dark-only Coolify configuration/redeploy was authorized;
  production traffic, DNS and old-domain redirects remain out of scope.
- `FACT` - Staging, Vercel rollback, Bunny, backup/restore evidence and both
  portal zone exports are unchanged.
- `ASSUMPTION` - The current Coolify generated router precedence must be
  reconciled before the apex `308` can be accepted; no application source
  change is inferred from this ingress-only evidence.
- `UNKNOWN` - Exact ACME certificate issuance method and the responsible
  operator are not yet approved; if DNS-01 is required, the exact TXT name,
  value handling, TTL and operator action must be presented without exposing
  the token.

### Gate status

- `PRODUCTION-DATA-WRITE-FREEZE-APPROVAL-GATE: NO-GO` - target client TLS is
  now current, but there is still no new PM-approved freeze window, final dump,
  final delta or production-data approval.
- `DNS-SWITCH-APPROVAL-GATE: NO-GO` - apex HTTP `308` and domain-covered TLS
  are not proven. Proposed records remain unchanged and unapplied:
  `dongphugia.vn A 47.131.92.97 TTL 300` and
  `www.dongphugia.vn A 47.131.92.97 TTL 300`.

### PM actions required next

1. Approve a new production-data window only after the router/TLS blockers are
   closed; approval must name freeze start, duration, app/DB/monitoring/
   rollback owners, final-copy/reconciliation steps and rollback triggers.
2. Separately approve the exact ACME operator action (DNS-01 or a later
   DNS-dependent method) and, only after certificate and routing acceptance,
   approve the DNS records at `DNS-SWITCH-APPROVAL-GATE`.

No production write, freeze, final copy, migration, DNS/nameserver change,
canonical traffic switch, old-domain redirect or Vercel mutation was made in
this checkpoint.

## Dark apex router reconciliation checkpoint - 2026-08-01 23:45 Asia/Ho_Chi_Minh

### Before/after identity

- Before: deployment `uedctlreknzlgyh7ogvjph4p`, exact digest
  `sha256:e5eaadf454abe9b01bb35389e80b0828dac237d9cb4195dc289345627bfeab9b`,
  source `090ff89c981f8c6b2d851bf99d7fb8572dacc4da`, healthy, restart `0`.
  Effective apex router used generated `redirect-to-https`; Caddy apex redir
  had no explicit status.
- After: deployments `fisp4s4wve7b3s83wlq688xe`,
  `g8fmibf4rusxv3h4anufveoq`, `o5446de3b36s4chxjugoirc9` and latest
  `etp64no66uz4latp52thr0bs` all succeeded. Runtime container
  `ydgt1mkagpitpq8shovd726z-164404708127` is healthy with restart `0` and the
  exact same digest/revision. No application source or image changed.

### Router evidence

- Coolify retained `priority=100` and the custom `apex-to-www` middleware with
  `permanent=true`, but emitted the apex router with
  `middlewares=redirect-to-https`. A Caddy `redir ... 308` value was normalized
  to a label without the status suffix.
- `http://dongphugia.vn/_dark-validation/path?probe=1` returned `301` with
  `Location: https://www.dongphugia.vn/_dark-validation/path?probe=1`.
- The apex root returned `301` with `Location: https://www.dongphugia.vn/`.
- `http://www.dongphugia.vn/_dark-validation/path?probe=1` returned `302` to
  the equivalent HTTPS `www` URL.
- Required apex HTTP `308` is **NOT PASS**. Path/query preservation passed;
  there was no observed redirect chain for the apex response.
- `dpg-production-dark.invalid` labels remain present for internal validation.
  TLS is still not declared PASS: the SNI certificate remains Traefik default
  and is not valid for either `.vn` hostname.

### ACME plan (not executed)

DNS-01 is recommended because DNS is intentionally not pointed at the target;
HTTP-01 must not be attempted before DNS approval. After PM approval, the
ACME operator would create CA-provided TXT values at
`_acme-challenge.dongphugia.vn` and, if separately requested by the CA, the
corresponding `www` challenge name, using TTL `300`, wait for authoritative
propagation, issue SAN coverage for apex and `www`, then remove only the
challenge records. The exact token/value, validity window and operator action
must be supplied at the approval gate and are deliberately absent here. No
ACME order or DNS record was created; renewal remains a Coolify/Traefik task.

### Gate decision

- `PRODUCTION-DATA-WRITE-FREEZE-APPROVAL-GATE: NO-GO` - no new PM-approved
  window, freeze, final copy or final delta.
- `DNS-SWITCH-APPROVAL-GATE: NO-GO` - router status is `301`, not `308`, and
  the certificate is not domain-covered. Proposed records remain unchanged
  and unapplied (`dongphugia.vn A 47.131.92.97 TTL 300`; `www A
  47.131.92.97 TTL 300`).

## Dark redirect acceptance refresh - 2026-08-02

### Exact release and deployment

- The sole changed GHCR package is
  `tranhuunguyenhuy-hue/dongphugia-apex-redirect`, now public by PM approval.
  Anonymous pull of
  `sha256:a9ecf197c102ba26559bebf437610656b61be4a774cd63b017dce86830d1749e`
  succeeded. No registry credential was used or persisted on Coolify.
- Exact source is
  `9b7884f2ef66643f7aea2c6350fb76198fa2b508`; the image is `linux/arm64`.
  Its OCI attestation contains SPDX SBOM and SLSA provenance layers, and
  Trivy `0.55.2` reports `HIGH=0`, `CRITICAL=0`.
- Coolify resource `mpwt7qmpjsa0izwvc8nic4co` (`dongphugia-apex-redirect-dark`)
  completed deployment `l89vln0w0ztk73gpo52af87n`. Runtime is healthy,
  restart count `0`, exact digest is active, and internal `/healthz` is `200`.
  No host port is published; the generated `sslip.io` route is internal only.

### Router and log acceptance

- HTTP apex `/` returned exactly one `308` with
  `Location: https://www.dongphugia.vn/`.
- HTTP apex `/_dark-validation/path?probe=1&sort=asc` returned exactly one
  `308` with the same path and query in the `Location` value.
- HTTPS apex routing-only validation (`-k`) returned the same `308`; this does
  not declare TLS pass. `www.dongphugia.vn` HTTPS returned `200`.
- Redirect logs contained no `probe=1`, `sort=asc` or encoded query values.
- Effective runtime caps are `cap-drop=ALL`, memory `64 MiB`, CPU `0.25`, and
  no port bindings. Coolify did not apply `ReadonlyRootfs`,
  `no-new-privileges` or a PIDs limit; retain this as a hardening gap for a
  supported configuration follow-up.

### Preservation and gate status

- Existing dark app `ydgt1mkagpitpq8shovd726z`, accepted staging digest and
  Vercel rollback baseline are unchanged. No production DB, DNS, traffic,
  nameserver, old-domain redirect or write-freeze mutation occurred.
- `PRODUCTION-DATA-WRITE-FREEZE-APPROVAL-GATE`: **NO-GO** pending a new PM
  window, fresh final dump/S3 copy, final public-schema restore/reconcile,
  no-split-brain validation and named owners.
- `DNS-SWITCH-APPROVAL-GATE`: **NO-GO**. The dark router is technically `308`
  ready, but the certificate is still Traefik default and DNS records remain
  unapplied. ACME preparation stops before TXT mutation; the required
  `aws-secrets-manager` guidance is unavailable (`SECRET-HANDLING-BLOCKER`).

Source mutation is not required by evidence and was not attempted. Further
technical action requires a Coolify-specific router mechanism that preserves
the permanent status; no production, DNS, Vercel or staging mutation is
authorized.

## Accelerated one-pass PM page - 2026-08-02

### A. Router and runtime result

- **FAIL** - The exact accepted image remains
  `sha256:e5eaadf454abe9b01bb35389e80b0828dac237d9cb4195dc289345627bfeab9b`
  from source `090ff89c981f8c6b2d851bf99d7fb8572dacc4da` on Coolify app
  `ydgt1mkagpitpq8shovd726z`. The latest rollback-restored deployment is
  `lgds74j95439opjgbyqe217u`; runtime
  `ydgt1mkagpitpq8shovd726z-172109863127` is healthy with restart `0`.
- A direct priority-1000 apex router attempt was deployed once as
  `vg0xglvh8ssudzz58vdhqu5q`. Coolify still generated Caddy `caddy_1` for
  `https://dongphugia.vn` and the Traefik apex `http-1` router with
  `redirect-to-https`, so the application never received the HTTP apex request.
- After restoring the recorded custom labels, apex root and path/query return
  `301` to the correct `www` URL, not `308`. `www` HTTPS returns `200`; apex
  HTTPS routing reaches the app only under `--resolve -k`, and its certificate
  is not accepted. This is an ingress FAIL, not a source-code FAIL.

### B. TLS and exact operator action

- `coolify-proxy` is Traefik `v3.6` with an HTTP-01 resolver and persistent
  `/traefik/acme.json`; no DNS-01 integration is present. The current SNI
  certificate is Traefik default and does not cover either `.vn` hostname.
- **Recommendation:** use a one-time DNS-01 issuance for SANs
  `dongphugia.vn` and `www.dongphugia.vn`, with TTL `300`, only after PM
  approves the CA order and names the DNS operator. The operator must create
  only the CA-provided `_acme-challenge` TXT record(s), wait for authoritative
  propagation, verify issuance and renewal persistence, then remove only the
  challenge records. The token is never placed in this dossier.
- No ACME order, TXT record, A/AAAA/CNAME, nameserver, traffic or redirect
  mutation was made. If DNS-01 cannot be automated with Mắt Bão, PM must accept
  a named manual renewal owner or defer the cutover.

### C. PRODUCTION-DATA-WRITE-FREEZE-APPROVAL-GATE

**NO-GO.** Existing backup and isolated restore evidence remains PASS (public
schema restore, 56 FK checks, zero orphans, aligned sequences, RTO `23.56 s`,
cleanup and `$0` disposable cost). The following are still window-only:

1. PM approval of a new maintenance window and exact freeze start/duration.
2. Fresh production `pg_dump`, SHA-256 manifest and private S3 copy.
3. Isolated public-schema final restore and P0/P1 reconciliation.
4. No-split-brain verification, final-delta procedure and named rollback owner.
5. Dark health/admin/order/quote/media smoke while the freeze is active.

No `WRITE_FREEZE_MODE`, final dump/copy/delta or production DB write occurred.

### D. DNS-SWITCH-APPROVAL-GATE

**NO-GO.** Proposed records remain planning-only:

| Host | Type | Value | TTL | Status |
| --- | --- | --- | --- | --- |
| `dongphugia.vn` | A | `47.131.92.97` | `300` | Proposed, not applied |
| `www.dongphugia.vn` | A | `47.131.92.97` | `300` | Proposed, not applied |

Before approval, the dossier must additionally show domain-covered TLS, apex
HTTP `308` with path/query preservation, expected downtime, exact rollback
records and TTL, Mắt Bão/P.A/PM responsibilities, and SEO monitoring for
canonical, sitemap, robots, redirects, 404s, Search Console, GTM and traffic.
The old `.com.vn` redirect remains OFF and Vercel remains the rollback baseline.

### E. Window feasibility and decisions

- The planning target `02/08/2026 23:00-23:30 Asia/Ho_Chi_Minh` is **NO-GO** at
  this checkpoint. The technical ingress/TLS blockers and production-data
  approval are not closed; the window must not be treated as approved.
- `FACT` - PR #26 is open/ready at `9aa93c3c565e23e459d4e4f24ba363805ab88134`
  with quality and homepage-readiness successful. PR #29 is draft at
  `2c6e0443bcdc793c12ceaa824147e131f1a98a9f` with required checks successful.
- `FACT` - Staging remains on the accepted digest
  `sha256:65fd6460f910468bba5e6d131e45ad63bcf6cd9fb1e067ffe0398423212e03df`;
  no staging or Vercel mutation occurred in this pass.
- `PM DECISION REQUIRED` - approve a supported redirect-service/Coolify router
  design and DNS-01 operator before requesting a new data window. Do not approve
  DNS or write-freeze while the router status is `301` or the certificate is
  default.

### Release It score

Current overall readiness is `6/10`: deployment separation `8/10`, health and
rollback `7/10`, observability/capacity `5/10`, and data safety `8/10`.
The missing points are the supported apex 308 path, domain-covered TLS, fresh
window dump/reconcile, named monitoring/rollback owners and PM approvals.

## Dark apex redirect service preparation - 2026-08-02

### Implementation and supply-chain evidence

- PR #30: `feat: add dark apex redirect service`; source revision
  `9b7884f2ef66643f7aea2c6350fb76198fa2b508` in the dedicated production-infra
  worktree. The service is isolated under `infra/redirect-service/` and uses
  no database, Bunny, session or application credentials.
- Local `linux/arm64` BuildKit image index:
  `sha256:9ed0436d0c23b0cf5bf280e345703b69db0c0fb5f5ef66a0091b32b826181001`.
  BuildKit emitted SBOM and max-mode provenance metadata. The pinned nginx
  base is `sha256:59ccf0943b0b8e8d9e6ea9039a39555730f544701a655c596f7df7d096c593f5`.
- Local tests passed for health, root and nested path/query `308`, exact
  `Location`, no chain and query-safe access logs. Trivy `0.55.2` reports
  `HIGH=0`, `CRITICAL=0`.
- GHCR push is blocked by the GitHub token's missing package-write scope. No
  mutable tag or unverified digest was deployed; no Coolify resource was
  created. PM must grant package-write access through a secure channel without
  pasting a token into chat.

### Runtime and ACME status

- Existing dark app remains unchanged at digest
  `sha256:e5eaadf454abe9b01bb35389e80b0828dac237d9cb4195dc289345627bfeab9b`,
  deployment `lgds74j95439opjgbyqe217u`, healthy/restart `0`. Staging and
  Vercel rollback remain unchanged.
- AWS read-only identity: account `503344933326`, region `ap-southeast-1`, EC2
  `i-011fe10948e0a8c15`, SSM online. Traefik `v3.6` has the HTTP-01 resolver
  only; ACME storage is permissioned and was not read. DNS-01 is planned while
  the target is not on public DNS. No order or TXT record exists.

### Gate decision

- `PRODUCTION-DATA-WRITE-FREEZE-APPROVAL-GATE: NO-GO`.
- `DNS-SWITCH-APPROVAL-GATE: NO-GO` - GHCR candidate is not yet available to
  Coolify, the dedicated dark redirect resource does not yet exist, and the
  certificate is not domain-covered. The next PM action is package-write
  enablement; after deployment acceptance, a separate approval is required
  before any DNS-01 TXT mutation.

## ACME DNS-01 bounded audit - 2026-08-02

- `FACT` - The required `aws-secrets-manager` skill/retrieve surface and
  `asm-exec` are unavailable. No local `lego`, `certbot` or `acme.sh` client
  is installed.
- `FACT` - EC2 read-only metadata shows Traefik `v3.6` configured for
  HTTP-01 only, storing ACME state at `/traefik/acme.json`; no DNS-01 provider
  is configured. The mounted file metadata is `root:root`, mode `600`, size
  `16054` bytes. Contents were not read.
- `FACT` - No ACME order, TXT record, certificate binding, DNS mutation or
  traffic activation occurred.
- `BLOCKER` - `SECRET-HANDLING-BLOCKER`: no compliant secret-safe path exists
  in this runtime to create the approved manual DNS-01 order.
- `PM ACTION` - Restore/approve one compliant runtime-only secret mechanism or
  nominate an approved manual DNS-01 operator/client that keeps the account
  key root-only and outside chat, logs, argv and artifacts. Then create one
  SAN order and stop before `_acme-challenge` TXT mutation.

## Safe readiness refresh - 2026-08-02

- `FACT` - AWS account `503344933326`, region `ap-southeast-1`, EC2
  `i-011fe10948e0a8c15` and SSM `Online` remain valid. The redirect runtime is
  healthy with restart `0`, exact digest unchanged, `3.445 MiB / 64 MiB` and
  `3` PIDs. Existing dark and staging runtimes remain healthy and unchanged.
- `FACT` - EC2 point-in-time refresh: uptime `3d 8h`, load average
  `1.75/0.80/0.58`, `676 MiB` available memory, `450 MiB` swap used and root
  filesystem `21%` used. No soak or load-test claim is made.
- `FACT` - Production-target PostgreSQL reports server `ssl=on` and minimum
  TLS `1.2`; Docker restart count is `11`. Client `verify-full` could not be
  reproven without a compliant secret-safe path and remains `STALE/UNKNOWN`.
- `FACT` - Private S3 bucket
  `dongphugia-prod-db-backup-503344933326-ap-southeast-1` remains SSE-S3 with
  all four Block Public Access controls enabled. The newest target-public dump
  is `88,396,363` bytes at `2026-08-01T19:18:56Z`; the `113`-byte checksum
  manifest followed at `19:18:58Z`. Lifecycle retention is enabled for daily
  `8` days and weekly `29` days. No object content was read; existing
  checksum/restore/reconciliation evidence remains authoritative.
- `FACT` - A local exact-digest disposable smoke passed with Docker
  `read-only`, nginx tmpfs mounts, `no-new-privileges`, `pids-limit=64` and
  `cap-drop=ALL`; `/healthz` returned `ok`. Coolify was not mutated. A future
  same-digest Coolify hardening change must use a supported Compose/resource
  path with recorded rollback; no blind Docker-options retry is allowed.
- `GATE` - `PRODUCTION-DATA-WRITE-FREEZE-APPROVAL-GATE` and
  `DNS-SWITCH-APPROVAL-GATE` remain `NO-GO` pending client `verify-full`,
  domain-covered TLS and a compliant ACME secret path. No production or DNS
  mutation occurred.

## Manual ACME DNS-01 attempt - 2026-08-02

- `FACT` - The PM-approved fallback used the immutable official image
  `docker.io/certbot/certbot@sha256:34ee91d2f43008eb78a007d22f23ed4b2eaa9a454cb27ca2c042b49527a695b4`,
  Certbot `5.7.0`, `linux/arm64`; no host package was installed.
- `FACT` - Temporary state was on encrypted EBS at
  `/var/lib/dongphugia-acme`, `root:root`, mode `0700`; hook/state files were
  root-only. No account/private key contents were read, and all state was
  removed after the failed attempt.
- `FACT` - The single order attempt returned DNS-01 owner names
  `_acme-challenge.dongphugia.vn` and `_acme-challenge.www.dongphugia.vn`
  at `2026-08-01T20:00:48Z`. TXT values are withheld from this dossier because
  the order failed and are no longer actionable.
- `FACT` - Certbot proceeded past the detached manual prompt; with no TXT
  records the Let's Encrypt production CA rejected the authorizations. No TXT,
  certificate issuance/binding, DNS, routing or traffic mutation occurred.
- `FACT` - Cleanup proof: failed container, image cache, account state,
  challenge file and logs removed; no Certbot process remains.
- `BLOCKER` - Resumable interactive order execution is unproven. Do not use
  the stale values. A second order requires explicit PM approval for a tested
  interactive/hold mechanism and must stop before TXT mutation.

## Manual ACME DNS-01 interactive hold - 2026-08-02

- `FACT` - Offline hook proof passed: first invocation returns, second
  invocation blocks, and a root-only sentinel releases/removes the block.
- `FACT` - Exactly one live Let's Encrypt production order is held with pinned
  Certbot `5.7.0` `linux/arm64` image
  `docker.io/certbot/certbot@sha256:34ee91d2f43008eb78a007d22f23ed4b2eaa9a454cb27ca2c042b49527a695b4`.
  Interactive SSM session: `dongphugia-admin-k4deen37kuat3l85iob9okv3c4`;
  container: `dpg-acme-order-20260802-hold`; hook is blocked after call two.
- `FACT` - Challenge owner names captured at `2026-08-02T06:27:29Z` are
  `_acme-challenge.dongphugia.vn` and
  `_acme-challenge.www.dongphugia.vn`. Live values are excluded from this
  repository.
- `HUMAN STOP` - No TXT exists and the release sentinel is absent. PM/DNS
  operator must create exactly those TXT records with TTL `300`, verify
  authoritative propagation, and separately approve resume. Do not release
  the sentinel or press Enter before approval.
- `GATE` - No certificate issuance/binding or DNS/routing/traffic/production
  mutation occurred. Safe metadata did not expose expiry; treat the order as
  time-sensitive.

## Production data write-freeze approval package - 2026-08-02 15:56 Asia/Ho_Chi_Minh

This latest section supersedes earlier historical snapshots in this dossier
where runtime, certificate or ACME state differs.

### Current time, window and identities

- `FACT` - Package time was `2026-08-02 15:56:36 +07:00`. Earliest deterministic
  proposal: `2026-08-02 23:00-23:30 Asia/Ho_Chi_Minh`; planning-only, not started
  and not approved. Automatic `NO-GO` applies if PM approval is absent by `22:00`.
- `FACT` - Freeze-capable Vercel tree: `f06b7a3a8cfae27e440211b04e634a9f4a2d9209`.
  Provenance-only retrigger: `6f0678ad92b17cc13e493fab3b19412418ae7af6`, empty
  tree diff from `f06b7a3`; Vercel status deployment
  `B8UjK3asBEU7NtAxDVmuiHJRcofF` is `success`. Current public `.com.vn` still
  returns `200` from Vercel. Rollback baseline is
  `cf98ab78b9fd34403e277b5e23ea8b082b6800ce`.
- `FACT` - `WRITE_FREEZE_MODE` is OFF in the accepted deployment configuration;
  its environment value was not read or printed. The exact Vercel production
  alias promotion is not visible from the available public headers and remains
  `UNKNOWN` for PM dashboard confirmation.
- `FACT` - Current immutable runtime identities remain healthy/restart `0`:
  dark app `sha256:e5eaadf454abe9b01bb35389e80b0828dac237d9cb4195dc289345627bfeab9b`,
  staging `sha256:65fd6460f910468bba5e6d131e45ad63bcf6cd9fb1e067ffe0398423212e03df`,
  and apex redirect `sha256:a9ecf197c102ba26559bebf437610656b61be4a774cd63b017dce86830d1749e`.
- `FACT` - Dark TLS binding is PASS for both `.vn` SANs. Direct EIP testing
  proved apex HTTP/HTTPS `308` path/query preservation and `www` HTTPS `200`;
  canonical DNS and production traffic remain unchanged.
- `FACT` - Current EC2 point-in-time capacity is load `0.20/0.42/0.38`,
  `709 MiB` available memory, `495 MiB` swap used and root filesystem `22%`
  used; no soak/capacity guarantee is claimed.

### Freeze guard coverage and migration boundary

- `FACT` - The accepted source guard defaults OFF and returns `503
  WRITE_FREEZE_ACTIVE` when enabled. Central Prisma interception covers ORM and
  raw SQL writes. Explicit coverage includes orders, quotes, Bunny upload,
  revalidation, admin login/session and all audited product/category/blog/
  partner/project/customer/user/order server actions; tests cover orders,
  quotes, revalidation, upload and sessions.
- `FACT` - Source is official Supabase-managed PostgreSQL; no source URL,
  credential, row or PII was read. Target is private PostgreSQL `17.6`, database
  `dongphugia_production`, container `dpg-production-postgres`, server `ssl=on`,
  restart `11`, size `770,722,963` bytes. Prior client evidence proved
  `sslmode=verify-full`/TLS 1.3 against target host `dpg-production-postgres`;
  mark this stale and re-prove at T-60 through the secret-safe runtime path.
- `FACT` - Current target aggregate: orders `15`, quotes `13`, customers `6`,
  products `17,752`, product images `110,321`, admin users `1`, sessions `0`,
  audit logs `3`; trailing 1-day/7-day target orders and quotes `0`. FK state is
  `56/56` valid with `0` invalid; `45` sequences present. Source write rate is
  not refreshed and must not be inferred from the target copy.
- `FACT` - Only application-owned `public` schema is in scope. Supabase
  `auth`, `storage` and `vault` remain excluded.

### Backup evidence and protected final-copy requirement

- `FACT` - S3 backup bucket is private, SSE-S3 `AES256`, Block Public Access
  fully enabled. Lifecycle is daily `8` days and weekly `29` days. Latest target
  public dump: `daily/target/2026/08/01/dongphugia-target-public-20260801T191812Z.dump`,
  `88,396,363` bytes; manifest SHA-256
  `4fac3a7b9638c032945833736c0b8e5f589ac5d7e996d18b6843d0ff8911eaa8`.
- `DECISION` - Existing July 31 source/target objects are evidence only. A fresh
  pre-freeze source custom dump, checksum manifest, private S3 copy and final
  public-schema restore/reconciliation are mandatory window actions and have not
  been performed.

### 15-20 minute sequence, owners and rollback

1. `T-60/T-10`: PM approves window; main verifies exact source/digests, health,
   restarts, target verify-full, S3 checksum and rollback owners.
2. `T+00`: enable `WRITE_FREEZE_MODE=true` only after approval; verify all guards
   without creating records. This is a protected mutation and remains blocked.
3. `T+02-T+08`: confirm no split-brain, fresh source custom `pg_dump`, SHA-256
   manifest and private S3 copy.
4. `T+08-T+14`: checksum/list proof, restore `public` to target, reconcile P0/P1
   counts, FK/orphans, timestamps, media host/path and sequences.
5. `T+14-T+18`: target read-only health, admin/session, order/quote guard, media,
   TLS, canonical, sitemap, robots and security-header smoke.
6. `T+18-T+20`: explicit PM/main GO or rollback. Any checksum, restore,
   reconciliation, TLS, health, timeout or split-brain failure keeps Vercel live
   and aborts the cutover.

- `OWNER` - Main technical coordinator owns app/DB/backup/rollback/monitoring;
  PM owns data GO/NO-GO and freeze approval; PM is later DNS operator. No backup
  DNS operator is currently named.
- `DECISION` - Read traffic should continue; write paths return documented `503`
  during the 15-20 minute freeze. RPO target is `<=24h`, RTO `<4h`, internal
  rollback target `<=5 min`; DNS rollback remains TTL/cache bounded.
- `GATE` - `PRODUCTION-DATA-WRITE-FREEZE-APPROVAL-GATE: NO-GO`; no freeze, final
  dump/copy/delta, target migration or production DB write occurred.
- `PROMPT` - `PM APPROVE PRODUCTION DATA WINDOW: I approve
  2026-08-02 23:00-23:30 Asia/Ho_Chi_Minh and the sequence above, with freeze
  enabled only at T0, fresh dump/checksum/S3 copy, public-schema restore,
  reconciliation, no-split-brain validation and explicit GO/rollback. This does
  not approve DNS or production traffic switching.`
