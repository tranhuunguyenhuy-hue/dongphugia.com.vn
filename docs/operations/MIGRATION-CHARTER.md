# Dongphugia platform and domain migration charter

**Updated:** 2026-08-01

**Current state:** transition in progress; production traffic has not switched.

This document defines the current product/release objective. Runtime identities
and evidence that can change must still be taken from the latest orchestrator
hand-off and verified before mutation.

## Outcome

Move the public application, application database and media delivery to the new
platform while preserving the existing Vercel production as a tested rollback
baseline.

| Area | Current production | Target production |
|---|---|---|
| Canonical domain | `https://www.dongphugia.com.vn` | `https://www.dongphugia.vn` |
| Apex | `dongphugia.com.vn` redirects HTTP 307 to current `www` | `https://dongphugia.vn` redirects HTTP 308 to target `www` |
| Hosting | Vercel | AWS EC2 Singapore, Coolify, immutable Linux/ARM64 GHCR image |
| Application | Next.js | Same accepted Next.js release tree, production-specific public configuration |
| Database | Supabase PostgreSQL source | Self-hosted PostgreSQL with TLS `verify-full` |
| Media | Existing Bunny/legacy-compatible paths | Bunny Storage/CDN with verified compatibility |

The old `.com.vn` domain and Vercel deployment remain active through the
observation window. Old-domain redirects are a later, separately approved
release action.

## Latest verified release reference

The values below are reference evidence at the time of this update, not mutable
aliases:

- PR #26 head: `9aa93c3c565e23e459d4e4f24ba363805ab88134`
- PR #26 checks: quality, homepage-readiness and Vercel success
- Accepted application source baseline:
  `090ff89c981f8c6b2d851bf99d7fb8572dacc4da`
- Stable staging image:
  `sha256:65fd6460f910468bba5e6d131e45ad63bcf6cd9fb1e067ffe0398423212e03df`
- Production-specific dark image:
  `sha256:e5eaadf454abe9b01bb35389e80b0828dac237d9cb4195dc289345627bfeab9b`

Before any deployment, verify that the exact source, tree, digest, SBOM,
provenance and scan evidence still match the intended release.

## Verified transition state

- Vercel still serves `www.dongphugia.com.vn`; the old apex redirects to it and
  both remain the rollback baseline.
- The production-specific image has been dark-deployed without canonical
  production traffic.
- Dark acceptance covered application health, target database TLS, homepage,
  admin login/session/logout, media read and disposable Bunny object smoke.
- The production PostgreSQL target exists, but production data has not been
  migrated or opened for production writes.
- The target `www.dongphugia.vn` does not yet resolve publicly. DNS,
  nameservers, canonical production traffic and new old-to-new redirects have
  not been switched.
- The previous 31 July 2026 cutover window has expired. It does not authorize a
  later write-freeze, data copy or DNS switch; PM must approve a new window.

## Migration boundary

Only the application-owned PostgreSQL `public` schema is in migration scope.
Supabase service schemas such as `auth`, `storage` and `vault` are excluded.
Acceptance must prove that admin authentication/session and Bunny upload/read
flows do not depend on excluded schemas.

No production data write is allowed before the data gate. No production traffic
or DNS mutation is allowed before the DNS gate.

## Technical sequence

1. Keep the exact accepted source and immutable image evidence green.
2. Maintain staging and dark-production acceptance without public traffic.
3. Complete full source backup, SHA-256 manifest, off-host S3 copy and isolated
   restore proof.
4. Reconcile critical tables, timestamps, foreign keys, media paths and
   sequences on the isolated target.
5. Export both authoritative DNS zones and prepare exact records, TTL, TLS and
   rollback records.
6. Present `PRODUCTION-DATA-WRITE-FREEZE-APPROVAL-GATE` for a new maintenance
   window.
7. After approval only: short write-freeze, fresh final dump/copy and exact
   reconciliation with no split-brain writes.
8. Run target production smoke while canonical traffic remains unchanged.
9. Present `DNS-SWITCH-APPROVAL-GATE`.
10. After approval only: switch `.vn` records, verify TLS/traffic and start the
    observation window.
11. Enable old-domain redirects only after the new domain is stable and a
    separate approval is recorded.

## Minimum safe launch gates

### Source and artifact

- Exact green source and application tree.
- Immutable Linux/ARM64 digest.
- SBOM and provenance present.
- Security scan has zero HIGH/CRITICAL findings for the accepted candidate.

### Application

- Health and database connectivity pass.
- Homepage, routes, admin session, order/quote guards and media reads pass.
- Canonical, sitemap, robots, OpenGraph and schema use `www.dongphugia.vn`.
- Security headers, restart count and rollback target are verified.

### Data

- Full production dump immediately before migration.
- SHA-256 checksum and private off-host S3 copy.
- Isolated restore proof.
- Critical-table counts, timestamp ranges, foreign keys and sequences reconcile.
- Deterministic write-freeze and final copy prevent split-brain writes.
- Startup objective: RPO at most 24 hours and RTO under 4 hours, with the final
  copy targeting no lost transaction during cutover.

### DNS and TLS

- Full portal exports for `.vn` and `.com.vn`.
- Exact approved A/CNAME/TXT/MX/CAA records and TTL.
- Valid TLS for apex and `www` before accepting canonical traffic.
- Named DNS operator and rollback operator.
- Vercel and old-domain records remain recoverable.

## Domain and SEO requirements

- Preserve path and query string across approved redirects.
- Canonical metadata, sitemap, robots, OpenGraph and schema use the new `www`
  domain.
- Review cookie domain, CORS/CSRF trusted origins, webhooks and revalidation.
- Prepare Search Console, analytics/GTM and external integration updates.
- Monitor 404s, redirect chains, TLS, indexation and traffic after cutover.

## Performance policy

External LCP at or below 2500 ms remains the long-term goal. Performance
research stays separate from the release branch. Minimum Safe Launch may treat
performance as post-launch work only when functional, security, database,
media, backup, reconciliation, rollback and DNS/TLS safety all pass. A red
experimental source is never a release candidate.

## Ownership and hard stops

- Codex: single technical mutation coordinator per resource.
- PM: GO/NO-GO, production-data gate and DNS approval owner.
- PM/customer: primary DNS portal operator unless a named backup is recorded.
- Future Codex threads: read the living context and latest hand-off, verify
  owner release and claim one resource before mutation.

Never act autonomously on:

- production write-freeze, final copy or production database writes;
- DNS, nameserver, canonical traffic or old-domain redirect;
- deletion of the Vercel rollback baseline or old domain;
- new credentials, billing or cost beyond an approved budget.
