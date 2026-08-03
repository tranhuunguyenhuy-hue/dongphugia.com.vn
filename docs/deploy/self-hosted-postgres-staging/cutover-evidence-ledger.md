# Production cutover evidence ledger

Status: staging evidence recorded; production approval fields remain open. Record evidence and identifiers, never secret values,
connection strings, cookies, tokens, private keys, database rows, or customer
data.

## Decision and ownership

| Evidence | Value |
| --- | --- |
| Change ticket / approval | `TBD` |
| Planned window, Asia/Ho_Chi_Minh | `TBD` |
| Canonical production domain | `https://www.dongphugia.vn` (migration charter) |
| Go/no-go owner | `TBD` |
| Application owner / backup | `TBD` |
| Database owner / backup | `TBD` |
| DNS owner / backup | `TBD` |
| On-call / escalation channel | `TBD` |
| Business-approved downtime | `TBD` |

## Source and image

| Evidence | Value |
| --- | --- |
| Source revision | `09cf5c21fc4c55599dffa2d2b04299a7f036f1f4` (accepted staging candidate; infrastructure hardening commits are tracked separately) |
| Image | `ghcr.io/tranhuunguyenhuy-hue/dongphugia-web@sha256:73403c56bdc52d8c9d5a01081195de99f2a95945572fc520c292f511ec276046` (immutable staging candidate; Coolify runtime accepted) |
| Platform | `linux/arm64` |
| GHCR workflow run URL | `https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/actions/runs/30804874102` |
| Registry manifest verification | `linux/arm64` only; digest above |
| Source revision label verification | exact match to source revision above |
| SBOM attestation reference | registry attestation verified in GHCR run; 1 SBOM section |
| Provenance attestation reference | registry attestation verified in GHCR run; 1 provenance section |
| Security scan result/reference | Trivy: 0 HIGH, 0 CRITICAL in GHCR run |
| Runtime smoke reference | GHCR run `30804874102`: health `200`, homepage `200`, DB query pass, healthy, restart count `0`; Coolify exact-digest runtime and public route smoke accepted |
| Source performance gate | PR #26 run `30573391793`: median performance `0.99`, median LCP `1933 ms`, TBT `22.5 ms`, CLS approximately `0.00023` |

## Staging acceptance

| Check | Result / timestamp / evidence reference |
| --- | --- |
| Coolify application deployment ID | app `tvsrq1yc9hl56y89uretmqvi`; exact-digest deployment finished and was verified read-only |
| Running digest equals accepted digest | PASS; Coolify runtime uses `sha256:73403c56bdc52d8c9d5a01081195de99f2a95945572fc520c292f511ec276046` |
| Container healthy, restart count zero | PASS; running/healthy with restart count `0` |
| HTTPS/homepage/health | PASS; strict TLS verification, homepage `200`, health `200`, DB query pass |
| Catalogue/blog/search/sitemap/SEO | PASS on exact digest: health/home/category/subcategory/product/search/contact/robots/sitemap/admin-login `200`; unauthenticated admin boundary `307`; synthetic markers render |
| Write-freeze rehearsal | PASS for quote, order and upload APIs: `503 WRITE_FREEZE_ACTIVE`; revalidation GET `405`, unauthenticated POST `401` |
| Bunny synthetic media test | PASS for read compatibility: Bunny hostname marker rendered; no Bunny write credential was provisioned and write paths remained frozen |
| Internal DB-only connectivity | PASS; app uses the full internal Coolify PostgreSQL alias; DB health query passes; no public `5432` |
| Public-port scan | Last AWS read-only evidence: SG ingress only `80/443`; final refresh blocked by expired AWS CLI session |
| CPU/RAM/swap/disk observation | PASS bounded snapshot: host load `0.33`, CPU idle `98%`, disk used `22%`, memory `804/1846 MiB`; longer monitoring remains pending |
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
| Selected primary domain | `https://www.dongphugia.vn` |
| Nameserver strategy | keep Mắt Bão authoritative for `.vn`; keep P.A Việt Nam authoritative for old `.com.vn`; no Cloudflare/nameserver migration in this cutover |
| Complete pre-cutover zone export/reference | `TBD` |
| Old apex record/type/TTL | `dongphugia.com.vn A 216.198.79.1`, TTL `3600` |
| Old `www` record/type/TTL | CNAME `f67c116b40bea258.vercel-dns-017.com`, TTL `3600` |
| New apex record/type/TTL | currently no answer; proposed A `47.131.92.97`, cutover TTL `300`, PM approval required |
| New `www` record/type/TTL | currently no answer; proposed A `47.131.92.97`, cutover TTL `300`, PM approval required |
| TTL reduction timestamp / old TTL aged | `TBD` |
| Cloudflare proxy/TLS decision | no Cloudflare/nameserver change in this cutover |
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
| DB connections/locks | `11/30` total (`36.7%`), active `1`, idle-in-transaction `0`, lock waits `0` | stop above `70%` of configured ceiling | Bounded read-only aggregate; PASS |
| Backup age/checksum | `TBD` | stop above `30h` or mismatch | `TBD` |
| T+5m external smoke | `TBD` | all critical checks pass | `TBD` |
| T+15m go/no-go | `TBD` | owner acknowledgement | `TBD` |
| T+30m unfreeze decision | `TBD` | reconciliation and writes pass | `TBD` |
| T+60m final checkpoint | `TBD` | otherwise rollback | `TBD` |
| T+24h observation close | `TBD` | SLOs and backup pass | `TBD` |

Open post-launch hardening blockers: production monitoring stack is not deployed,
production DB connection headroom is unverified, full production Lighthouse and
capacity/soak evidence remains pending, reviewed legacy URL inventory and the
seven-day observation gate remain open, and a fresh PM window/owner matrix is
required for any production mutation. The accepted staging candidate and
rollback baseline are not themselves open blockers.

## Decision log

| UTC time | Owner | Decision | Evidence/reason |
| --- | --- | --- | --- |
| `TBD` | `TBD` | `GO`, `HOLD`, or `ROLLBACK` | `TBD` |

Final approval is invalid while required fields remain `TBD` or any abort
threshold is active.
