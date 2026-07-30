# Production cutover evidence ledger

Status: staging evidence recorded; production approval fields remain open. Record evidence and identifiers, never secret values,
connection strings, cookies, tokens, private keys, database rows, or customer
data.

## Decision and ownership

| Evidence | Value |
| --- | --- |
| Change ticket / approval | `TBD` |
| Planned window, Asia/Ho_Chi_Minh | `TBD` |
| Canonical production domain | `TBD` |
| Go/no-go owner | `TBD` |
| Application owner / backup | `TBD` |
| Database owner / backup | `TBD` |
| DNS owner / backup | `TBD` |
| On-call / escalation channel | `TBD` |
| Business-approved downtime | `TBD` |

## Source and image

| Evidence | Value |
| --- | --- |
| Source revision | `5eece0c0b78b51bc408dbc2f06404a726bed1143` |
| Image | `ghcr.io/tranhuunguyenhuy-hue/dongphugia-web@sha256:12b6d170e45d9c47caff2ae18466ef6ddea69f0038012a03b0fce4173aa9d5b3` |
| Platform | `linux/arm64` |
| GHCR workflow run URL | `https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/actions/runs/30555758799` |
| Registry manifest verification | `linux/arm64` only; digest above |
| Source revision label verification | exact match to source revision above |
| SBOM attestation reference | registry attestation verified in GHCR run; 1 SBOM section |
| Provenance attestation reference | registry attestation verified in GHCR run; 1 provenance section |
| Security scan result/reference | Trivy: 0 HIGH, 0 CRITICAL in GHCR run |
| Runtime smoke reference | GHCR run: health `200`, homepage `200`, DB query pass, healthy, restart count `0` |

## Staging acceptance

| Check | Result / timestamp / evidence reference |
| --- | --- |
| Coolify application deployment ID | app `q45dwq0ju41p0mpv59zdjah4`; rolling deployment finished `2026-07-30 15:23:30 UTC` |
| Running digest equals accepted digest | PASS; Coolify redeployed the accepted digest above |
| Container healthy, restart count zero | Coolify reports `Running (healthy)`; GHCR smoke restart count `0`; live Coolify restart count was not independently exposed |
| HTTPS/homepage/health | PASS; strict TLS verification, homepage `200`, health `200`, DB query pass |
| Catalogue/blog/search/sitemap/SEO | Functional routes PASS; production gate HOLD: Lighthouse performance `0.78` versus required `0.90`, LCP `4085 ms` versus required `2500 ms` |
| Write-freeze rehearsal | PASS for quote, order and upload APIs: `503 WRITE_FREEZE_ACTIVE`; revalidation GET `405`, unauthenticated POST `401` |
| Bunny synthetic media test | NOT RUN; no staging Bunny write credential/zone was provisioned and writes remain frozen |
| Internal DB-only connectivity | PASS; app uses the full internal Coolify PostgreSQL alias; DB health query passes; no public `5432` |
| Public-port scan | Last AWS read-only evidence: SG ingress only `80/443`; final refresh blocked by expired AWS CLI session |
| CPU/RAM/swap/disk observation | Pre-app host evidence passed thresholds; Coolify metrics are not enabled, so post-app host metrics remain an approval blocker |
| Rollback rehearsal | PASS; rolled back to digest `0ec2a8...`, verified health `200`, then forward-deployed accepted digest and verified health `200` |

## Database and backup

| Evidence | Value |
| --- | --- |
| Source database identity fingerprint, non-secret | `TBD` |
| Target database identity fingerprint, non-secret | `TBD` |
| Schema artefact checksum | `TBD` |
| Migration allowlist checksum | `TBD` |
| Source export filename/reference | `TBD` |
| Source export SHA-256 / size | `TBD` |
| Freeze start UTC / export watermark | `TBD` |
| Target pre-cutover backup SHA-256 | `TBD` |
| EBS snapshot ID / state | Existing DLM snapshot evidence: complete; no new AWS snapshot created in this phase |
| Restore drill target and elapsed time | Disposable `dpg_restore_drill`; schema restore and sensitive-table zero checks passed; approximately `1s` for synthetic data |
| Measured RTO / RPO | Logical restore approximately `1s` for synthetic data; nightly schedule implies up to `24h` RPO until final-delta backup |
| Reconciliation result reference | `TBD` |
| Sequence verification | `TBD` |
| Excluded-table verification | Restore drill confirmed zero `admin_sessions`, customers, orders and quote requests in staging synthetic dataset |
| Latest backup timestamp / age | Nightly dump task succeeded `2026-07-30 14:54 UTC`; daily-retention and weekly-promote/retention tasks both passed manual execution at `15:32 UTC`; policy is 7 daily + 4 weekly |

Do not paste table contents into this ledger. Record only aggregate counts,
checksums and approved report references.

## Media compatibility

| Evidence | Value |
| --- | --- |
| Production media hostname inventory query/reference | `TBD` |
| Bunny hostname counts | `TBD` |
| Legacy Supabase Storage hostname counts | Staging route HTML smoke: `0`; production-data inventory remains `TBD` |
| Other hostname counts and disposition | `TBD` |
| Decision to keep/remove compatibility allowlist | `TBD` |

Keep the legacy Supabase Storage hostname in `next.config.ts` until this section
has approved production-data evidence.

## DNS and Vercel baseline

Read-only evidence observed before the final package:

- `dongphugia.vn`: Mắt Bão nameservers; no observed apex A or `www` answer.
- `dongphugia.com.vn`: P.A Việt Nam nameservers; apex A currently
  `216.198.79.1`; `www` CNAME currently
  `f67c116b40bea258.vercel-dns-017.com`.

Re-capture authoritative answers immediately before cutover.

| Evidence | Value |
| --- | --- |
| Selected primary domain | `TBD` |
| Nameserver strategy | `TBD` |
| Complete pre-cutover zone export/reference | `TBD` |
| Old apex record/type/TTL | `TBD` |
| Old `www` record/type/TTL | `TBD` |
| New apex record/type/TTL | `TBD` |
| New `www` record/type/TTL | `TBD` |
| TTL reduction timestamp / old TTL aged | `TBD` |
| Cloudflare proxy/TLS decision | `TBD` |
| Vercel project ID/name | project name `dongphugia.com.vn`; internal project ID not available locally |
| Vercel production deployment ID/URL | GitHub deployment `5498627451`; `https://dongphugiacom-b70xmrgj8-tranhuunguyenhuy-9755s-projects.vercel.app` |
| Vercel production source commit | `cf98ab78b9fd34403e277b5e23ea8b082b6800ce` |
| Vercel rollback verification timestamp | GitHub deployment status `success`, read-only verified `2026-07-30` |

## Runtime environment inventory

Record presence/source only, never values.

| Variable | Present | Source/owner |
| --- | --- | --- |
| `DATABASE_URL` | yes (staging) | Coolify locked runtime secret |
| `DIRECT_URL` | yes (staging) | Coolify locked runtime secret |
| `NEXT_PUBLIC_SITE_URL` | yes (staging) | Coolify locked runtime variable |
| `NEXT_PUBLIC_GTM_ID` | `TBD` | `TBD` |
| `BUNNY_CDN_HOSTNAME` | yes (staging) | Coolify locked runtime variable |
| `BUNNY_STORAGE_ZONE_NAME` | no | production cutover blocker for media writes |
| `BUNNY_STORAGE_API_KEY` | no | production cutover blocker for media writes |
| `BUNNY_STORAGE_HOSTNAME` | yes (staging) | Coolify locked runtime variable |
| `REVALIDATION_SECRET` | yes (staging) | Coolify locked runtime secret |
| `REVALIDATE_SECRET` | yes (staging compatibility) | Coolify locked runtime secret |
| `SESSION_HOURS` | yes (staging) | Coolify locked runtime variable |
| `MAIN_SITE_URL` | `TBD` | `TBD` |
| `WRITE_FREEZE_MODE` | yes; `true` | Coolify locked runtime variable |
| `MAINTENANCE_MODE` | yes; `false` | Coolify locked runtime variable |

## Monitoring and checkpoints

| Signal/checkpoint | Baseline | Threshold | Result / notification evidence |
| --- | --- | --- | --- |
| External availability/error rate | `TBD` | any sustained failure | `TBD` |
| p95 latency | `TBD` | `TBD-SLO` | `TBD` |
| App/DB health and restarts | `TBD` | any unexpected restart | `TBD` |
| Host available memory | `TBD` | stop below `700 MiB` | `TBD` |
| Swap use | `TBD` | stop above `512 MiB` | `TBD` |
| Disk free/use | `TBD` | stop below `24 GiB` or above `75%` | `TBD` |
| DB connections/locks | `TBD` | plan thresholds | `TBD` |
| Backup age/checksum | `TBD` | stop above `30h` or mismatch | `TBD` |
| T+5m external smoke | `TBD` | all critical checks pass | `TBD` |
| T+15m go/no-go | `TBD` | owner acknowledgement | `TBD` |
| T+30m unfreeze decision | `TBD` | reconciliation and writes pass | `TBD` |
| T+60m final checkpoint | `TBD` | otherwise rollback | `TBD` |
| T+24h observation close | `TBD` | SLOs and backup pass | `TBD` |

Open production blockers: missing CSP/HSTS, exposed `x-powered-by`, incomplete
structured write-freeze responses in several admin/server-action paths, failing
Lighthouse thresholds, no post-app host metrics, no off-host backup,
incomplete production media inventory, unresolved
canonical-domain/DNS ownership, and unassigned cutover/on-call owners.

## Decision log

| UTC time | Owner | Decision | Evidence/reason |
| --- | --- | --- | --- |
| `TBD` | `TBD` | `GO`, `HOLD`, or `ROLLBACK` | `TBD` |

Final approval is invalid while required fields remain `TBD` or any abort
threshold is active.
