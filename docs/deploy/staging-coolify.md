# Dedicated-data Staging runbook

Staging is a separately addressable Coolify runtime with its own PostgreSQL
service. It validates a Staging-safe build of the same application source
revision as the Production candidate, but the Staging image is not a
Production-promotion artifact. Production continues to use its own immutable
Production-target build and its AWS PostgreSQL source of truth.

This runbook does not authorize a Production deployment, database/CDN/media
mutation, permission change, traffic change, resource cleanup, or secret
inspection. Those operations require the current PM authorization gate in the
linked Issue.

## Candidate contract

1. The Staging build is produced from the approved application source revision
   for `linux/arm64` with `DEPLOY_TARGET=staging` and the exact HTTPS Staging
   site URL as build arguments. Its digest, source revision, provenance, SBOM
   and scan result are recorded.
2. Coolify Staging selects that exact immutable Staging digest. A mutable tag or
   a runtime-only URL override is not acceptance evidence because
   `NEXT_PUBLIC_SITE_URL` is intentionally build-time for this release.
3. A separate Production-target image must be built from the same source
   revision before any Production promotion. The Staging digest is never
   promoted to Production.
4. The Staging runtime, database, traffic and media remain isolated from the
   Production application runtime and database. No Production database
   principal or permission mutation is required for this path.

The repository workflow `.github/workflows/staging-candidate.yml` builds and
scans the immutable Staging image. `.github/workflows/staging-ghcr.yml`
continues to validate the source handoff contract only.

## Dedicated Staging data safety model

The approved Staging database boundary is the dedicated Coolify PostgreSQL
service `dpg-staging-postgres`. Staging connections must point only to this
service; they must not reference `DATABASE_URL`, `DIRECT_URL`, or a Publishing
database in Production. Database health, schema compatibility and rollback
reference are recorded as Staging evidence. No Production grants, credentials,
queries or data are required for ordinary Gate C validation.

The application blocks all writes through the common Prisma client and guarded
mutating routes when `WRITE_FREEZE_MODE` is true. A Production Candidate also
fails closed with writes frozen when that variable is omitted. Production alone
may explicitly set it false during an approved Gate C rollout. Therefore a
Staging runtime must leave writes frozen; it must never set this value to false
as part of ordinary validation.

The Staging build is noindex by construction. `PRODUCTION_INDEXING_ENABLED`
must be omitted or false, and the build-time canonical/structured-data URL must
be the HTTPS Staging domain. Production URLs must not be baked into the
Staging image.

`RUNTIME_ROLE` is the runtime-only role boundary: Staging must set `staging` and
Production must set `production`. An omitted or invalid role fails closed:
write thaw and indexing remain disabled. The immutable image never supplies
this role at build time.

| Operation class                                                               | Dedicated Staging rule                                                                                      |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Read/render public pages, APIs, sitemap, CDN media                            | Allowed as read-only acceptance against the dedicated Staging database.                                    |
| Admin, checkout/order, quote, Publishing, uploads/deletes, cache revalidation | Blocked by write freeze and excluded from acceptance.                                                        |
| Scheduler, seed/reset, migrations, schema tooling, Global Publishing Gate    | Prohibited. Keep scheduler disabled and Gate closed.                                                        |
| Email, webhooks, search indexing, third-party callbacks, analytics            | Do not invoke during validation unless separately approved and redirected.                                  |
| Any temporary thaw, destructive operation, media deletion, external effect    | Requires a new explicit PM authorization and immediate return to frozen state.                              |

## Required Staging configuration at Gate B

Configure values only in the approved Coolify runtime mechanism. Never place
values, connection strings, tokens, host identifiers, or credentials in this
repository, Issue, PR, shell history, CI output, or chat.

- Main application data connection: the dedicated Staging PostgreSQL service.
- Publishing data connection: the dedicated Staging Publishing database, when
  configured; never a Production Publishing database.
- Catalogue and Publishing CDN/media: the reviewed CDN hosts and storage scope
  approved for Staging read-only validation.
- Publishing environment/storage boundary: Staging. Publishing writes remain
  frozen.
- `WRITE_FREEZE_MODE`: true, or omitted only when the candidate's documented
  fail-closed default is verified.
- `PRODUCTION_INDEXING_ENABLED`: omitted or false.
- `RUNTIME_ROLE`: staging.
- Scheduler: disabled. Do not create or execute a task against shared data.
- Auto-deploy: disabled whenever deterministic candidate validation is required.
  Select the reviewed immutable digest manually; do not let a later mutable
  image replace the candidate under test.

No data migration, seed, reset, schema command, storage copy, CDN rewrite,
DNS/traffic change, or resource deletion is needed merely because Staging
starts reading its dedicated database.

## Gate B preflight and reversible execution

Dedicated Staging alignment is `STANDARD` release work unless the Staging
database schema or permissions are changed. No Production database-principal
provisioning or grant is part of Gate B. A restore rehearsal is required only
if the release changes the Staging schema, performs destructive Staging data
work, or otherwise depends on restore capability.
Issue #70 remains operational hardening and disaster-recovery follow-up; it is
not an automatic blocker for ordinary releases.

Before requesting Gate B approval, record sanitized `PASS`, `FAIL`, or
`UNKNOWN` evidence for: current Staging and Production image state; selected
Staging digest; application health; dedicated Staging database health/schema;
Staging media health; monitoring; runtime side-effect guardrails; and prior
Staging digest/configuration rollback reference. Add backup/restore evidence
only when the approved plan requires it.

After approval, change only the Staging runtime in this order:

1. Confirm the selected digest's source revision, architecture and Staging
   CDN contract.
2. Preserve the prior Staging digest/configuration reference without printing
   sensitive values.
3. Verify the dedicated Staging PostgreSQL service and bind Staging to the
   selected digest plus the reviewed Staging data/media configuration, with
   write freeze, scheduler disabled and noindex active.
4. Deploy Staging once and stop if health, digest, guardrails, or monitoring is
   ambiguous.
5. Run whole-site read-only acceptance. Do not deploy Production.

Rollback restores only the recorded prior Staging digest/configuration. It does
not mutate Production data/media, change traffic, or remove legacy resources.

## Staging acceptance

Dedicated Staging is a validation environment with its own data. Run every
non-destructive check that the existing Staging fixtures permit.
Do not create test data, media, uploads, or other side effects to make a check
possible.

### Deferred acceptance on write-frozen Staging

Record a check as `NOT_APPLICABLE_ON_WRITE_FROZEN_STAGING` only when all of the
following hold:

1. Dedicated Staging policy prohibits the required mutation, or no suitable
   existing Staging fixture exists.
2. Related non-destructive evidence has passed on the same immutable digest.
3. The check is an immediate mandatory Production post-deploy acceptance using
   existing Production data when a separate Production rollout occurs; a
   failure stops further mutation and is reported with sanitized evidence.

This is not a skip: feasible Staging checks remain required, and a deferred
check never authorizes a different digest.

Verify with sanitized evidence:

- `/api/health`, expected immutable digest, no restart loop and monitoring;
- representative Staging-data homepage, catalogue/product, Blog/Publishing,
  navigation/search, metadata, structured data, sitemap and public APIs;
- approved Staging CDN hostname, public DNS, direct object response, CSP `img-src`,
  Next image policy, browser rendering and non-zero natural image dimensions
  when a suitable existing shared-data asset exists;
- `robots.txt` and metadata are noindex, while expected differences such as
  Staging hostname/authentication/runtime-only metadata are explained;
- write attempts are rejected without intentionally creating, deleting or
  changing any Staging record; and
- scheduler, Publishing Gate and other side-effect paths are still disabled.

Complete every recorded immediate Production acceptance after a separate
Production deployment. A successful Staging result does not close Production
acceptance or authorize Gate C.

### CSP-only Managed Media application

For a CSP-only Blog Managed Media candidate with no suitable existing Staging
asset, record direct Managed Media HTTP and browser rendering as
`NOT_APPLICABLE_ON_WRITE_FROZEN_STAGING` only after the digest/provenance,
health, Blog route, and CSP `img-src` evidence pass on Staging. Immediately
after Production deployment, verify the same digest's `/api/health`, `/blog`,
representative affected Blog Post, existing Managed Media HTTP 200 response, CSP
allowance, and browser `complete=true` with non-zero `naturalWidth` and no CSP
block. Verify the candidate scope contains no unrelated runtime behavior; for
Issue #66, that includes excluding PR #69 runtime behavior. A failed check
stops further mutation and is `BLOCKED` with sanitized evidence.

## Gate C handoff

Before Production promotion, build a separate Production-target image from the
same source revision, then confirm its provenance, current Production health,
monitoring, rollback target, applicable release-path acceptance, and explicit
Production runtime settings for write enablement and indexing. The Staging
digest itself is never promoted. Add database/CDN/backup evidence when the
approved HIGH_RISK plan requires it. Ask for the one Production rollout
approval before any Production deployment or configuration change.
