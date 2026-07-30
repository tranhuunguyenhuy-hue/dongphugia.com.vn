# Production cutover evidence ledger

Status: template. Record evidence and identifiers, never secret values,
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
| Source revision | `e64531430d3315e01deaf311b35db08d517bee62` |
| Image | `ghcr.io/tranhuunguyenhuy-hue/dongphugia-web@sha256:0ec2a8eca89b9ecae21c3397ec19657b9cc2b35d2fc730752ff82b6491d8b4df` |
| Platform | `linux/arm64` |
| GHCR workflow run URL | `https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/actions/runs/30551255609` |
| Registry manifest verification | `linux/arm64` only; digest above |
| Source revision label verification | exact match to source revision above |
| SBOM attestation reference | registry attestation verified in GHCR run; 1 SBOM section |
| Provenance attestation reference | registry attestation verified in GHCR run; 1 provenance section |
| Security scan result/reference | Trivy: 0 HIGH, 0 CRITICAL in GHCR run |
| Runtime smoke reference | GHCR run: health `200`, homepage `200`, DB query pass, healthy, restart count `0` |

## Staging acceptance

| Check | Result / timestamp / evidence reference |
| --- | --- |
| Coolify application deployment ID | `TBD` |
| Running digest equals accepted digest | `TBD` |
| Container healthy, restart count zero | `TBD` |
| HTTPS/homepage/health | `TBD` |
| Catalogue/blog/search/sitemap/SEO | `TBD` |
| Write-freeze rehearsal | `TBD` |
| Bunny synthetic media test | `TBD` |
| Internal DB-only connectivity | `TBD` |
| Public-port scan | `TBD` |
| CPU/RAM/swap/disk observation | `TBD` |
| Rollback rehearsal | `TBD` |

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
| EBS snapshot ID / state | `TBD` |
| Restore drill target and elapsed time | `TBD` |
| Measured RTO / RPO | `TBD` |
| Reconciliation result reference | `TBD` |
| Sequence verification | `TBD` |
| Excluded-table verification | `TBD` |
| Latest backup timestamp / age | `TBD` |

Do not paste table contents into this ledger. Record only aggregate counts,
checksums and approved report references.

## Media compatibility

| Evidence | Value |
| --- | --- |
| Production media hostname inventory query/reference | `TBD` |
| Bunny hostname counts | `TBD` |
| Legacy Supabase Storage hostname counts | `TBD` |
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
| Vercel project ID/name | `TBD` |
| Vercel production deployment ID/URL | `TBD` |
| Vercel production source commit | `TBD` |
| Vercel rollback verification timestamp | `TBD` |

## Runtime environment inventory

Record presence/source only, never values.

| Variable | Present | Source/owner |
| --- | --- | --- |
| `DATABASE_URL` | `TBD` | `TBD` |
| `DIRECT_URL` | `TBD` | `TBD` |
| `NEXT_PUBLIC_SITE_URL` | `TBD` | `TBD` |
| `NEXT_PUBLIC_GTM_ID` | `TBD` | `TBD` |
| `BUNNY_CDN_HOSTNAME` | `TBD` | `TBD` |
| `BUNNY_STORAGE_ZONE_NAME` | `TBD` | `TBD` |
| `BUNNY_STORAGE_API_KEY` | `TBD` | `TBD` |
| `BUNNY_STORAGE_HOSTNAME` | `TBD` | `TBD` |
| `REVALIDATION_SECRET` | `TBD` | `TBD` |
| `REVALIDATE_SECRET` | `TBD` | `TBD` |
| `SESSION_HOURS` | `TBD` | `TBD` |
| `MAIN_SITE_URL` | `TBD` | `TBD` |
| `WRITE_FREEZE_MODE` | `TBD` | `TBD` |
| `MAINTENANCE_MODE` | `TBD` | `TBD` |

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

## Decision log

| UTC time | Owner | Decision | Evidence/reason |
| --- | --- | --- | --- |
| `TBD` | `TBD` | `GO`, `HOLD`, or `ROLLBACK` | `TBD` |

Final approval is invalid while required fields remain `TBD` or any abort
threshold is active.
