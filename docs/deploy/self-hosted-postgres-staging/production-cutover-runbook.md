# Production cutover runbook

Status: plan and approval package only. Do not change DNS, nameservers,
Cloudflare, Vercel, AWS, production data, or production traffic from this file.

## Gate objective

Move production traffic only after the accepted staging image, self-hosted
PostgreSQL, backups, restore drill, migration rehearsal, write freeze and
rollback path all have recorded evidence. Deployment and release are separate:
the AWS application must be deployed and verified before DNS release.

## Mandatory domain decision

The application currently canonicalizes to `www.dongphugia.com.vn`, while the
migration brief also refers to `dongphugia.vn`. The cutover owner must select one
primary production domain before any DNS change.

| Domain | Current evidence | Decision required |
| --- | --- | --- |
| `dongphugia.vn` | Authoritative NS: Mắt Bão; no observed apex A or `www` record | Decide whether this is a new primary, redirect-only, or reserved domain |
| `dongphugia.com.vn` | Authoritative NS: P.A Việt Nam; apex currently resolves to Vercel IP; `www` CNAME points to Vercel | Decide whether it remains primary and is the actual migration target |
| Cloudflare | Not currently authoritative for either domain | Decide whether to onboard nameservers in a separate, rehearsed change |

Do not combine a nameserver migration, canonical-domain migration, database
migration and origin switch in one release window. Recommended order:

1. Decide and document the canonical domain.
2. If Cloudflare is required, replicate and verify the complete DNS zone, change
   nameservers in a separate window, and observe stability before origin cutover.
3. Lower relevant record TTLs at the authoritative provider and wait at least
   the previous TTL before cutover.
4. Change only the approved apex/`www` origin records during the traffic switch.

## Responsibility matrix

Replace every `TBD` before approval.

| Responsibility | Owner | Backup owner | Evidence |
| --- | --- | --- | --- |
| Go/no-go and business downtime | `TBD-PM` | `TBD` | approval record |
| Application/image/Coolify | `TBD-APP` | `TBD` | digest and deploy record |
| Database migration/reconciliation | `TBD-DB` | `TBD` | dump, restore and query ledger |
| Mắt Bão DNS for `dongphugia.vn` | `TBD-DNS` | `TBD` | before/after zone export |
| P.A Việt Nam DNS for `dongphugia.com.vn` | `TBD-DNS` | `TBD` | before/after zone export |
| Cloudflare zone/proxy, if adopted | `TBD-DNS` | `TBD` | zone and TLS evidence |
| Vercel rollback | `TBD-VERCEL` | `TBD` | production deployment record |
| Monitoring and incident command | `TBD-ONCALL` | `TBD` | contact/escalation record |

## Production environment contract

Names only; values are resolved through the approved secret/operator mechanism.

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_GTM_ID` (optional)
- `BUNNY_CDN_HOSTNAME`
- `BUNNY_STORAGE_ZONE_NAME`
- `BUNNY_STORAGE_API_KEY`
- `BUNNY_STORAGE_HOSTNAME`
- `REVALIDATION_SECRET`
- `REVALIDATE_SECRET` (compatibility alias if still required)
- `SESSION_HOURS` (optional)
- `MAIN_SITE_URL` (only if cross-site revalidation remains enabled)
- `WRITE_FREEZE_MODE`
- `MAINTENANCE_MODE`

Do not add `ADMIN_PASSWORD`, Supabase client variables, connection strings, or
secret values to Git, the runbook or the evidence ledger.

## Preconditions

- staging acceptance passed against the exact production candidate digest;
- PR/source audit includes security P0/P1 and has no unreviewed changes;
- production image digest, revision, SBOM, provenance and zero HIGH/CRITICAL
  scan evidence are recorded;
- production AWS capacity forecast and stop thresholds pass without creating a
  new resource or changing Security Group/IAM;
- PostgreSQL backup automation has a successful recent backup and checksum;
- disposable restore drill passed and measured RTO/RPO are recorded;
- source and target reconciliation queries were rehearsed;
- legacy Supabase media hostname inventory is complete and compatibility policy
  is recorded;
- exact Vercel rollback deployment and pre-cutover DNS zone records are recorded;
- owner matrix, contact channel and decision authority contain no `TBD`;
- no open unexplained data difference, security P0, alerting gap or failed health
  check remains.

## Deterministic data migration model

Use `migration-allowlist.md` as the only table allowlist. Explicitly exclude
`admin_sessions`, `crawl_product_snapshots`, `crawl_import_decisions`, and
`crawl_runs` unless a later reviewed package changes that decision.

Initial copy:

1. Capture source database identity, schema checksum and UTC export timestamp.
2. Export only allowlisted tables in deterministic dependency order using a
   custom-format, data-only dump with primary keys preserved.
3. Record dump SHA-256, byte size, start/end timestamps and tool versions.
4. Restore in a single transaction with `--exit-on-error`, no owner and no
   privileges.
5. Reset all affected sequences to at least the imported maximum primary key.
6. Run the reviewed count, checksum and referential-integrity queries on source
   and target. Do not proceed with unexplained differences.

Final delta policy:

- Preferred production plan: enable application write freeze before the final
  source export so the final delta is empty.
- If non-empty delta is approved, define before execution for every mutable
  table: UTC watermark column, stable primary-key tie-breaker, inclusive/exclusive
  boundary, child-table dependency order, delete/tombstone behavior, idempotent
  conflict rule and sequence repair.
- A timestamp without a primary-key tie-breaker is not a deterministic watermark.
- Do not infer deletions from absence. Use an approved delete ledger or keep full
  writes frozen.
- Apply a non-empty delta in one transaction, rerun all reconciliation queries,
  and abort on any unexplained mismatch.

Required freeze coverage:

- public order and quote creation;
- admin login/session mutation;
- all admin create/update/delete actions;
- cache revalidation side effects;
- Bunny upload/delete side effects;
- catalogue, content and redirect mutations;
- direct operator scripts and external writers.

`MAINTENANCE_MODE` is not sufficient because `/admin` and `/api` bypass it.
`WRITE_FREEZE_MODE=true` plus an operator freeze of external writers is the
authoritative freeze mechanism.

## Abort thresholds

Abort before DNS release if any of these occurs:

- any source/target count, key checksum, foreign-key or sequence mismatch;
- production write observed after the recorded freeze timestamp;
- backup checksum failure, restore drill failure, or backup age over `30h`;
- app or DB not healthy, unexpected container restart, or health response leak;
- public exposure of `22`, `3000`, `5432`, `6001`, `6002`, or `8000`;
- host memory available below `700 MiB`, swap use above `512 MiB`, disk free
  below `24 GiB`, disk use above `75%`, or unexpected sustained CPU saturation;
- missing notification target or on-call acknowledgement;
- TLS/canonical/SEO mismatch for the selected production domain;
- Vercel rollback target or DNS rollback records are unverified.

## Minute-by-minute cutover template

Replace estimates with measured rehearsal values before approval. The initial
business maintenance budget is `60 minutes`; exceeding it triggers rollback.

| Relative time | Owner | Action | Pass evidence |
| --- | --- | --- | --- |
| T-24h | DNS owner | Confirm canonical decision; lower approved TTL and wait old TTL | authoritative DNS answers |
| T-2h | Incident owner | Open change channel; confirm owners, backups, restore drill, alerts | signed checklist |
| T-30m | App owner | Verify AWS candidate by digest without production traffic | health, resources, TLS |
| T-20m | DB owner | Capture source/target baseline reconciliation | zero unexplained differences |
| T-15m | App owner | Enable maintenance and write freeze; stop external writers | mutation probes blocked |
| T-12m | DB owner | Record freeze timestamp and capture final approved export | dump checksum |
| T-8m | DB owner | Restore/apply final data transaction and repair sequences | successful transaction |
| T-4m | DB owner | Run complete reconciliation | signed pass |
| T-2m | App owner | Run AWS candidate smoke with production target DB | HTTP/DB/SEO pass |
| T+0 | DNS owner | Change only approved apex/`www` records | authoritative answer |
| T+5m | On-call | Verify public DNS/TLS/health/homepage and write paths | external probes pass |
| T+15m | PM | First go/no-go checkpoint | no abort signal |
| T+30m | PM | End maintenance/write freeze only after acceptance | approved timestamp |
| T+60m | PM | Final cutover checkpoint; otherwise rollback | decision record |
| T+24h | On-call | End enhanced observation if SLOs and backups pass | monitoring report |

Estimated write downtime remains `30-60 minutes` until an import/restore rehearsal
produces measured timings. DNS propagation is not guaranteed by this estimate.

## Monitoring and acceptance

Minimum release signals:

- external HTTPS availability, error rate and p95 latency;
- `/api/health` safe status and DB readiness;
- app/DB restart count, CPU, memory, swap, disk and inode use;
- PostgreSQL connections, long transactions, lock waits and database growth;
- order/quote synthetic transaction success after unfreeze;
- backup success, checksum and age;
- canonical, redirects, sitemap, robots and critical SEO metadata;
- Bunny and legacy media fetch success;
- an actual notification route acknowledged by the named on-call owner.

Checkpoint policy: any security, data-integrity, public-exposure or sustained
availability failure is an immediate rollback signal. Resource warnings require
the incident owner to decide within five minutes; no acknowledgement means
rollback.

## Vercel and DNS rollback

Before cutover record:

- Vercel project ID/name;
- current production deployment URL, deployment ID and source commit;
- current production branch and successful health timestamp;
- all existing apex/`www` record values, types, TTLs and authoritative NS;
- screenshots or exports sufficient for a second operator to restore records.

Rollback before AWS accepts production writes:

1. Restore the exact pre-cutover DNS records.
2. If needed, promote the recorded Vercel deployment to Production.
3. Verify DNS, TLS, homepage, health and write path on Vercel.
4. Disable the AWS production application or leave it isolated from traffic.
5. Unfreeze writes only after Vercel and its production database are confirmed.

Rollback after AWS accepts production writes is not a DNS-only action. Keep
writes frozen, reconcile the AWS delta, and either replay it to the old database
or declare AWS the source of truth and roll forward. Never point traffic back to
Vercel while silently discarding accepted writes.

## Final approval boundary

Current gate result: **HOLD**. Staging is deployed by accepted immutable digest,
but production cutover is not authorized until every abort condition and open
item in `cutover-evidence-ledger.md` is cleared. In particular, do not approve
DNS release while the Lighthouse performance gate, security-header hardening,
write-freeze response audit, off-host/retention backup controls, post-app host
capacity evidence, media inventory, domain decision, or owner matrix is open.

The cutover approval must identify the exact image digest, canonical domain,
DNS records, database evidence ledger, maintenance window, owners and rollback
deployment. Until that approval, production DNS, nameservers, traffic, data and
Vercel configuration remain unchanged.
