# Shared Production-data staging runbook

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
3. The Staging runtime is distinct from Production. Only its own runtime
   configuration and selected digest change during Gate B; Production remains
   untouched.
4. The digest that passes complete Staging acceptance is the only digest that
   can be proposed at Gate C for Production. Do not rebuild it between gates.

The repository workflow `.github/workflows/staging-ghcr.yml` validates this
source contract only. It does not build, push, deploy, or configure a staging
image.

## Shared-data safety model

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
| Admin, checkout/order, quote, Publishing, uploads/deletes, cache revalidation | Blocked by write freeze.                                                                                             |
| Scheduler, seed/reset, migrations, schema tooling, Global Publishing Gate     | Prohibited. Keep scheduler disabled and Gate closed.                                                                 |
| Email, webhooks, search indexing, third-party callbacks, analytics            | Do not invoke during validation unless a separately approved, bounded procedure proves it is redirected or harmless. |
| Any temporary thaw, destructive operation, media deletion, external effect    | Requires a new explicit PM authorization and immediate return to frozen state.                                       |

## Required Staging configuration at Gate B

Configure values only in the approved Coolify runtime mechanism. Never place
values, connection strings, tokens, host identifiers, or credentials in this
repository, Issue, PR, shell history, CI output, or chat.

- Main application data connection: the reviewed Production database/data path.
- Publishing data connection: the reviewed Production Publishing database path;
  it remains least-privilege and may be distinct from the CMS connection.
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

No data migration, seed, reset, schema command, storage copy, CDN rewrite,
DNS/traffic change, or resource deletion is needed merely because Staging
starts reading Production data.

## Gate B preflight and reversible execution

Before requesting Gate B approval, record sanitized `PASS`, `FAIL`, or
`UNKNOWN` evidence for: current Staging and Production image state; selected
candidate digest; application health; Production database health/capacity;
backup and restore capability; Production media health; monitoring; runtime
permission availability; side-effect guardrails; prior Staging digest and
configuration rollback reference.

After approval, change only the Staging runtime in this order:

1. Confirm the selected digest's source revision, architecture and production
   Publishing CDN contract.
2. Preserve the prior Staging digest/configuration reference without printing
   sensitive values.
3. Bind Staging to the selected digest plus the reviewed Production
   data/media configuration, with write freeze and noindex active.
4. Deploy Staging once and stop if health, digest, guardrails, or monitoring is
   ambiguous.
5. Run whole-site read-only acceptance. Do not deploy Production.

Rollback restores only the recorded prior Staging digest/configuration. It does
not mutate Production data/media, change traffic, or remove legacy resources.

## Staging acceptance

Verify with sanitized evidence:

- `/api/health`, expected immutable digest, no restart loop and monitoring;
- same-data representative homepage, catalogue/product, Blog/Publishing,
  navigation/search, metadata, structured data, sitemap and public APIs;
- Production CDN hostname, public DNS, direct object response, CSP `img-src`,
  Next image policy, browser rendering and non-zero natural image dimensions;
- `robots.txt` and metadata are noindex, while expected differences such as
  Staging hostname/authentication/runtime-only metadata are explained;
- write attempts are rejected without intentionally creating, deleting or
  changing any Production record; and
- scheduler, Publishing Gate and other side-effect paths are still disabled.

Once repository-wide acceptance passes, resume Issue #66's Blog Managed Media
acceptance against representative published Posts. A successful Staging result
does not close #66's Production acceptance and does not authorize Gate C.

## Gate C handoff

Before Production promotion, perform a fresh read-only preflight. Confirm the
same digest that passed Staging, current Production health, database/CDN and
backup state, monitoring, rollback target, deployment window, all Staging
acceptance and Blog evidence, and the explicit Production runtime settings for
write enablement and indexing. Ask for Gate C approval before any Production
deployment or configuration change.
