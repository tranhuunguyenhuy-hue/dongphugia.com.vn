# Shared Production-data staging runbook

> **LEGACY REFERENCE ONLY.** ADR 0013 makes isolated PostgreSQL Staging the
> canonical migration/deployment path. Do not replay `db/postgres-migrations`
> against this shared-data runtime, and do not use this runbook for new feature
> threads. It is retained for historical Coolify operations and must remain
> write-frozen.

Staging is a separately addressable Coolify runtime for validating the same
exact immutable Production Candidate digest that may later be promoted to
Production. Staging and Production read the same Production database/data and
the same Production CDN/media across the whole website. Staging is not a
disposable data sandbox.

This runbook does not authorize a Production deployment, database/CDN/media
mutation, permission change, traffic change, resource cleanup, or secret
inspection. Those operations require the current PM authorization gate in the
linked Issue.

## Candidate contract

1. GitHub Actions builds the Production Candidate once from protected `main`
   for `linux/arm64`; its digest, source revision, provenance, SBOM and scan
   result are recorded.
2. Coolify Staging selects that **same exact immutable Production Candidate
   digest**. A mutable tag and a staging-only build are never acceptance
   evidence.
3. The Staging runtime is distinct from Production. Gate B changes only its
   runtime configuration and selected digest; the Production application
   runtime, selected image, traffic, data, and media remain untouched. If the
   shared-data setup needs a Production database read-only principal, its
   provisioning and grants are a distinct, explicitly approved `HIGH_RISK`
   Production-database permission mutation, not a Staging-only action.
4. The digest that passes applicable Staging acceptance is the only digest that
   can be proposed at Gate C for Production. Do not rebuild it between gates.

The repository workflow `.github/workflows/staging-ghcr.yml` is now the
canonical isolated-Staging workflow. It does not target this legacy shared-data
runtime.

## Shared-data safety model

The preferred primary database safety boundary is a dedicated database-level
read-only principal for every Staging connection to Production data, including a
separate Publishing database when one exists. Application write-freeze is
defense in depth, not the only database boundary. The repository does not prove
that the current Staging configuration uses those principals; provisioning,
granting, verifying, and recording a rollback reference for them remain a
`HIGH_RISK` implementation item before shared-data Staging is enabled.

If a Production-data connection cannot technically use its own read-only
principal, do not silently rely on application write-freeze. Stop shared-data
Staging enablement until an explicitly approved `HIGH_RISK` exception defines
the alternative database boundary and rollback plan.

The application blocks all writes through the common Prisma client and guarded
mutating routes when `WRITE_FREEZE_MODE` is true. A Production Candidate also
fails closed with writes frozen when that variable is omitted. Production alone
may explicitly set it false during an approved Gate C rollout. Therefore a
Staging runtime must leave writes frozen; it must never set this value to false
as part of ordinary validation.

The candidate is also noindex by default. `PRODUCTION_INDEXING_ENABLED` may be
true only in the approved Production runtime at Gate C. Staging omits it or
keeps it false. Its canonical/structured-data URLs can intentionally remain the
Production URLs because the candidate is the Production artifact, but crawler
access is disallowed by both robots and page metadata.

`RUNTIME_ROLE` is the runtime-only role boundary: Staging must set `staging` and
Production must set `production`. An omitted or invalid role fails closed:
write thaw and indexing remain disabled. The immutable image never supplies
this role at build time.

| Operation class                                                               | Staging rule while sharing Production data/media                                                                     |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Read/render public pages, APIs, sitemap, CDN media                            | Allowed as read-only acceptance.                                                                                     |
| Admin, checkout/order, quote, Publishing, uploads/deletes, cache revalidation | Denied by the read-only database boundary where applicable and blocked by application write freeze.                    |
| Scheduler, seed/reset, migrations, schema tooling, Global Publishing Gate     | Prohibited. Keep scheduler disabled and Gate closed.                                                                 |
| Email, webhooks, search indexing, third-party callbacks, analytics            | Do not invoke during validation unless a separately approved, bounded procedure proves it is redirected or harmless. |
| Any temporary thaw, destructive operation, media deletion, external effect    | Requires a new explicit PM authorization and immediate return to frozen state.                                       |

## Required Staging configuration at Gate B

Configure values only in the approved Coolify runtime mechanism. Never place
values, connection strings, tokens, host identifiers, or credentials in this
repository, Issue, PR, shell history, CI output, or chat.

- Main application data connection: the reviewed Production database/data path
  using its dedicated database-level read-only Staging principal. Do not
  substitute application write-freeze for this database boundary.
- Publishing data connection: the reviewed Production Publishing database path
  using its dedicated database-level read-only Staging principal when it is a
  separate connection. Do not substitute application write-freeze for this
  database boundary.
- Catalogue and Publishing CDN/media: the reviewed Production hosts and storage
  scope used by the Production Candidate.
- Publishing environment/storage boundary: Production, so the shared media
  configuration matches the real referenced objects. Publishing writes remain
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
starts reading Production data.

## Gate B preflight and reversible execution

Shared-data Staging alignment is `HIGH_RISK` work. Any required Production
database-principal provisioning or grant is a distinct, explicitly approved
Production-database permission mutation before the Staging binding; Gate B does
not change the Production application runtime or traffic. The dedicated plan
must be proportionate: restore rehearsal is a blocking gate only if this
release changes schema, permissions in a way that needs restore for rollback,
performs destructive data work, or otherwise depends on restore capability.
Issue #70 remains operational hardening and disaster-recovery follow-up; it is
not an automatic blocker for ordinary Fast Path releases.

Before requesting Gate B approval, record sanitized `PASS`, `FAIL`, or
`UNKNOWN` evidence for: current Staging and Production image state; selected
candidate digest; application health; Production database health/capacity;
dedicated read-only-principal availability and effective permissions;
Production media health; monitoring; runtime side-effect guardrails; and prior
Staging digest/configuration rollback reference. Add backup/restore evidence
only when the approved HIGH_RISK plan requires it.

After approval, change only the Staging runtime in this order:

1. Confirm the selected digest's source revision, architecture and production
   Publishing CDN contract.
2. Preserve the prior Staging digest/configuration reference without printing
   sensitive values.
3. Verify the dedicated Staging database principal is read-only and bind
   Staging to the selected digest plus the reviewed Production data/media
   configuration, with write freeze and noindex active.
4. Deploy Staging once and stop if health, digest, guardrails, or monitoring is
   ambiguous.
5. Run whole-site read-only acceptance. Do not deploy Production.

Rollback restores only the recorded prior Staging digest/configuration. It does
not mutate Production data/media, change traffic, or remove legacy resources.

## Staging acceptance

Shared-data Staging is a validation environment, not a synthetic fixture
environment. Run every non-destructive check that existing shared data permits.
Do not create test data, media, uploads, or other side effects to make a check
possible.

### Deferred acceptance on write-frozen Staging

Record a check as `NOT_APPLICABLE_ON_WRITE_FROZEN_STAGING` only when all of the
following hold:

1. Shared-data Staging policy prohibits the required mutation, or no suitable
   existing shared-data fixture exists.
2. Related non-destructive evidence has passed on the same immutable digest.
3. The check is an immediate mandatory Production post-deploy acceptance using
   existing Production data; a failure stops further mutation and is reported
   with sanitized evidence.

This is not a skip: feasible Staging checks remain required, and a deferred
check never authorizes a different digest.

Verify with sanitized evidence:

- `/api/health`, expected immutable digest, no restart loop and monitoring;
- same-data representative homepage, catalogue/product, Blog/Publishing,
  navigation/search, metadata, structured data, sitemap and public APIs;
- Production CDN hostname, public DNS, direct object response, CSP `img-src`,
  Next image policy, browser rendering and non-zero natural image dimensions
  when a suitable existing shared-data asset exists;
- `robots.txt` and metadata are noindex, while expected differences such as
  Staging hostname/authentication/runtime-only metadata are explained;
- write attempts are rejected without intentionally creating, deleting or
  changing any Production record; and
- scheduler, Publishing Gate and other side-effect paths are still disabled.

Complete every recorded immediate Production acceptance after rollout, including
any deferred Managed Media direct-object and browser-rendering checks against an
existing affected Production Blog Post. A successful Staging result does not
close Production acceptance or authorize Gate C.

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

Before Production promotion, confirm the same digest that passed Staging,
current Production health, monitoring, rollback target, the applicable
release-path acceptance, and the explicit Production runtime settings for write
enablement and indexing. Add database/CDN/backup evidence when the approved
HIGH_RISK plan requires it. Ask for the one Production rollout approval
before any Production deployment or configuration change.
