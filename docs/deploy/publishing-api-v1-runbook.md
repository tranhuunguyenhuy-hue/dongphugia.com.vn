# Publishing API v1 runbook

For Agent integration examples and the internal pilot handoff, see the
[Publishing API v1 integration guide](../integrations/publishing-api-v1-integration-guide.vi.md).

This runbook operates the internal, single-tenant Publishing API. It does not
authorize a staging rollout, a production deployment, a database migration, or
any Bunny configuration change. Those are separate PM approval gates.

## Authority and procedure map

- Dedicated-data Staging supersedes the legacy synthetic topology. ADR 0010 and
  [`staging-coolify.md`](staging-coolify.md) are authoritative: Staging uses
  its dedicated PostgreSQL service and reviewed CDN/media boundary for
  read-only candidate validation. It must remain write-frozen for Publishing.
- The recurring procedures in this runbook operate approved Production
  integrations only.
- Disposable synthetic checks run only in isolated CI/local test databases.
- One-time Production provisioning and legacy recovery references at the end
  are inactive by default and require their own current PM-approved plan.

## Safety invariants

- Every Publishing Agent has its own Machine Identity, Integration Sponsor,
  capabilities, and Production-bound credential. Never use an admin session,
  shared key, or one credential for multiple integrations. Dedicated-data
  Staging receives no Publishing write credential.
- The migration initializes the Global Publishing Gate as disabled; do not
  treat that default as evidence of its current state. Opening the Gate requires
  applicable read-only candidate evidence and an explicit Production decision.
  Staging never opens the Gate.
- `posts:write` alone cannot publish. Grant `posts:publish` only to an approved
  zero-touch Publishing Agent.
- Credentials are opaque, shown by the control command once, and must never be
  pasted into tickets, shell history, CI logs, chat, or this repository.
- A Schedule Block is terminal for that schedule. Do not re-enable a capability
  or Gate to make it publish; submit an explicit reschedule with the current
  ETag instead.
- During `WRITE_FREEZE_MODE=true`, do not invoke the scheduler. Close the
  Global Publishing Gate before the freeze and keep it closed through the first
  post-freeze scheduler run. This avoids claiming an audit/blocked transition
  while all database writes are intentionally prohibited.

## Configuration inventory

The inventory below is for the approved Production Publishing runtime and must
be provided only through its approved secret/configuration mechanism. A
Dedicated-data Staging runtime may receive the reviewed non-secret CDN values
needed to render approved media, but it does not receive
`PUBLISHING_BUNNY_STORAGE_API_KEY`, `PUBLISHING_SCHEDULER_TOKEN`, a scheduler
task, or any other Publishing write credential. Its separate runtime role and
write freeze remain mandatory.

| Variable | Purpose | Secret |
| --- | --- | --- |
| `PUBLISHING_ENVIRONMENT` | Publishing data/media boundary; Dedicated-data Staging uses `staging` while remaining frozen by its runtime role | No |
| `PUBLISHING_EXTERNAL_LINK_HOSTNAMES` | Comma-separated, reviewed exact HTTPS citation hosts; no wildcard | No |
| `PUBLISHING_JSON_RATE_LIMIT_MAX` | Per-Machine-Identity JSON limit | No |
| `PUBLISHING_MEDIA_RATE_LIMIT_MAX` | Per-Machine-Identity media limit | No |
| `PUBLISHING_RATE_LIMIT_WINDOW_SECONDS` | Durable rate-limit window | No |
| `PUBLISHING_TRUSTED_PROTO_HEADER` | Proxy header trusted for HTTPS verification | No |
| `PUBLISHING_TRUSTED_CLIENT_IP_HEADER` | Optional proxy header for IP policy | No |
| `PUBLISHING_BUNNY_STORAGE_ENVIRONMENT` | Must exactly match the Publishing data/media boundary | No |
| `PUBLISHING_BUNNY_STORAGE_ZONE_NAME` | Publishing-only Bunny storage zone | No |
| `PUBLISHING_BUNNY_STORAGE_HOSTNAME` | Exact Bunny storage API host | No |
| `PUBLISHING_BUNNY_CDN_HOSTNAME` | Exact publishing CDN host; must be allowed by image CSP | No |
| `PUBLISHING_BUNNY_STORAGE_API_KEY` | Bunny storage write credential | Yes |
| `PUBLISHING_SCHEDULER_TOKEN` | Internal scheduler invocation credential, 32–256 chars | Yes |
| `PUBLISHING_SCHEDULER_URL` | Local/approved internal app URL for the one-shot runner | No |

Adding a citation host is a reviewed configuration/source change. It is not a
runtime wildcard or an OpenAPI enum. The Publishing API never fetches a cited
URL.

## Recurring Production control-plane operations

Run these through the separately approved Production execution path. They are
prohibited in Dedicated-data Staging. The command prints structured metadata,
except the one-time `credential` returned by issue or rotate. Capture no
plaintext credential in logs.

```bash
npm run publishing:control -- identity-create \
  --actor-admin-id <active-admin-id> --confirm yes \
  --name '<integration-name>' --sponsor-user-id <staff-id> \
  --capabilities posts:write,media:write,posts:publish

npm run publishing:control -- credential-issue \
  --actor-admin-id <active-admin-id> --confirm yes \
  --identity-id <machine-identity-uuid> --environment production
```

Grant or revoke only the specific capability required:

```bash
npm run publishing:control -- capability-grant \
  --actor-admin-id <active-admin-id> --confirm yes \
  --identity-id <machine-identity-uuid> --capability posts:publish

npm run publishing:control -- capability-revoke \
  --actor-admin-id <active-admin-id> --confirm yes \
  --identity-id <machine-identity-uuid> --capability posts:publish
```

To immediately stop new Agent API requests, either disable the identity or
revoke the affected credential. Neither action alters a published Blog Post or
drains a Schedule Block.

```bash
npm run publishing:control -- identity-disable \
  --actor-admin-id <active-admin-id> --confirm yes \
  --identity-id <machine-identity-uuid> --reason '<private-operational-reason>'

npm run publishing:control -- credential-revoke \
  --actor-admin-id <active-admin-id> --confirm yes \
  --credential-id <credential-uuid> --reason '<private-operational-reason>'
```

Rotate the Production credential before expiry. The command requires exactly
one active source credential for that identity/environment and caps overlap at
seven days; every credential still has a maximum 90-day lifetime from issue.
The implementation may retain the historical two-environment limit, but that
does not authorize issuing a Dedicated-data Staging credential.

```bash
npm run publishing:control -- credential-rotate \
  --actor-admin-id <active-admin-id> --confirm yes \
  --identity-id <machine-identity-uuid> --environment production \
  --from-credential-id <current-credential-uuid>

npm run publishing:control -- expiry-report --within-days 14
npm run publishing:control -- audit-report --limit 50
```

## Recurring Production Global Publishing Gate operation

The Gate is optimistic-concurrency protected. Read the current version from the
private operational database before changing it, then use that exact version.
The migration's `(enabled=false, version=1)` initial state is historical setup,
not current-state evidence.

```bash
npm run publishing:control -- gate-set \
  --actor-admin-id <active-admin-id> --confirm yes \
  --enabled false --expected-version <current-version>
```

This is the recurring kill switch. It blocks Agent immediate publish, new
scheduled publication, live replacement, and scheduler transitions; it does
not stop normal human CMS writes. Re-opening with `--enabled true` is a
separately approved Production launch/recovery action, not routine operation.

## Recurring Production scheduler operation

The scheduler is repository-owned and one-shot. The accepted host/Coolify path
must invoke it at least once per minute from the same environment and database.
For the Production application only, create a Coolify **Scheduled Task**
on that application with this exact configuration (the task executes in the
application runtime; it is not a public HTTP cron):

| Coolify field | Required value |
| --- | --- |
| Command | `node scripts/publishing/run-scheduler.mjs` |
| Schedule | `* * * * *` (every minute) |
| Environment | The same application environment and database as the Publishing API |
| `PUBLISHING_SCHEDULER_URL` | The approved internal application URL; default `http://127.0.0.1:3000` only when the task can reach that listener |
| `PUBLISHING_SCHEDULER_TOKEN` | A dedicated runtime secret, never logged or exposed to a Publishing Agent |
| Notifications | Enable Coolify failure notification for the task in the operating alert channel |

The image already includes `scripts/publishing/run-scheduler.mjs`; do not use
`npm` or `npx` in the Coolify task. The runner has a 55-second request timeout
and exits non-zero for an invocation failure, so Coolify records a failed task.
Its only authenticated target is the private `/api/internal/publishing-scheduler`
endpoint.

The one-shot command is:

```bash
node scripts/publishing/run-scheduler.mjs
```

The command calls the internal endpoint with `PUBLISHING_SCHEDULER_TOKEN`; do
not invoke that endpoint from public browser traffic. The scheduler rechecks
the current Machine Identity, `posts:publish`, Global Publishing Gate,
write-freeze, Post Version, stored restricted HTML/Managed Media, and
Publication Readiness Gate. A missed execution catches up a still-valid due
post. A failed recheck writes `schedule_blocked` with an audit event. A duplicate
invocation uses conditional state/version writes, so it cannot publish twice.

For recurring Production monitoring, verify privately:

1. expected approved publications appear on `/`, `/blog`, the category, post
   page and sitemap within five minutes; and
2. `publishing_scheduler_state` heartbeat and minimized audit events exist;
   after three successful one-minute runs, this command must report
   `healthy: true` and `success_age_seconds <= 120`:

   ```bash
   npm run publishing:control -- scheduler-report --max-age-seconds 120
   ```

Do not create synthetic content as a recurring health check.

## Disposable Publishing validation

Before a separately approved Production launch acceptance, run the PostgreSQL
race harness only against a fresh **disposable** PostgreSQL database bootstrapped
with the reviewed schema. It deliberately creates immutable audit evidence and
is not for Dedicated-data Staging. Supply a synthetic active admin ID through the
approved local environment mechanism; do not put a connection string or
credential in shell history, CI logs, or this repository.

```bash
PUBLISHING_CONCURRENCY_TEST_CONFIRM=disposable \
PUBLISHING_CONCURRENCY_TEST_DATABASE_URL=<disposable-postgresql-url> \
PUBLISHING_DATABASE_URL=<same-disposable-postgresql-url> \
PUBLISHING_TEST_SPONSOR_ADMIN_ID=<synthetic-active-admin-id> \
npm run publishing:test-postgres-concurrency
```

The harness verifies concurrent credential issue/rotation (maximum two active
credentials), credential revoke before the mutation boundary, capability revoke
before publication authority, and Global Publishing Gate close before a public
transition. Save only the PASS/fail result and sanitized timing evidence.

Before enabling the scheduler or Global Publishing Gate, run a dedicated-role
smoke against the same disposable PostgreSQL topology. It must connect
with `PUBLISHING_DATABASE_URL` and prove the Publishing client can read active
taxonomy, create/update a synthetic Draft, attach/recount a synthetic Blog Tag,
run the scheduler heartbeat, and then clean up the synthetic fixture through
the owner path. This is mandatory because legacy Blog tables may have RLS; ACL
provisioning alone is not proof that the dedicated non-BYPASSRLS role can use
the reviewed policies. Record only PASS/fail and sanitized timing evidence.

## Dedicated-data Staging and rollout gates

The repository-wide Staging architecture is defined in
[`staging-coolify.md`](staging-coolify.md). Dedicated-data Staging must remain
write-frozen with the scheduler disabled and the Global Publishing Gate closed.
Do not apply a Publishing migration, issue a staging credential, or run
synthetic Publishing acceptance there.

Use the reviewed SQL and synthetic harness only for disposable CI infrastructure.
Production execution requires a separate explicit PM window, backup/rollback
evidence, immutable candidate, Gate C approval, and the current control-plane
path. This runbook intentionally contains no live credentials or deployment
command.

## Inactive one-time and legacy Production references

The following sections are retained because their checksum-pinned artifacts
remain in the repository and are covered by focused contract tests. They are
not part of recurring operations, are not a current rollout plan, and must
never be used on Dedicated-data Staging. Before any use, a new scoped plan must
revalidate the exact Production state, immutable source, rollback evidence and
explicit PM authority.

### One-time Production launch acceptance

This inactive-by-default procedure never runs on Dedicated-data Staging. Under a
separately approved Production launch window, verify that a due ready post is
published once; revoked capability, closed Gate, stale version and inactive
taxonomy each produce the expected Schedule Block; and recovery requires a new
scheduled mutation with the current ETag. If the approved launch plan includes
a bounded synthetic ready publication, record its cleanup/retention decision,
Coolify task history, scheduler report, API response and public checks. This
section does not itself authorize that mutation.

### Legacy-constraint recovery (historical stop condition only)

If, and only if, the reviewed v1 migration stopped at its legacy
`blog_posts_status_check` guard after committing the additive Blog Post and
Blog Tag columns but before it created any `publishing_*` table, use the
reviewed forward recovery migration:

`docs/deploy/publishing-api-v1-production-recovery.sql`

It is a `psql` deployment artifact, not a Prisma migration. In one transaction it
checks the exact known partial schema, the reviewed editorial-byline default,
and the exact legacy lifecycle constraint; it then completes the reviewed v1
schema. Any table, column, constraint, default, or ownership state outside that
recovery target fails closed. Verify the committed SHA-256 manifest
`docs/deploy/publishing-api-v1-production-recovery.sha256` from the approved
immutable commit before execution. Do not use this recovery on Shared-data
Staging or a clean database, and do not change ownership or grant DDL privileges
to the application runtime role.

### One-time dedicated Publishing database runtime and grants

The Publishing API and its scheduler use `PUBLISHING_DATABASE_URL`, not the
CMS-wide `DATABASE_URL`. This keeps the CMS owner connection outside the
Publishing Agent trust boundary and gives the runtime-grants artifact a distinct
non-owner target role.

Before Production cutover, create that login once through
`docs/deploy/publishing-api-v1-runtime-role.sql`, then run
`publishing-api-v1-runtime-grants.sql` for the same role. The provisioning
artifact accepts the role name and reads a SCRAM verifier only from the
`PUBLISHING_RUNTIME_PASSWORD_VERIFIER` environment variable of the approved
owner-only secret runner. Neither raw password nor verifier belongs in source,
command history, output, or this runbook. It creates a fresh role only and
grants the exact existing CMS surface needed by Publishing routes/scheduler—no
ownership, role membership, schema `CREATE`, PUBLIC access, or destructive/DDL
privilege.
Verify `docs/deploy/publishing-api-v1-runtime-role.sha256` from the immutable
commit before it is invoked.

After that role exists, run the reviewed grants artifact through the approved
owner/migration execution path before invoking the Publishing API or scheduler:

```bash
psql -X -v ON_ERROR_STOP=1 \
  -v runtime_role=<dedicated-publishing-runtime-role> \
  -f docs/deploy/publishing-api-v1-runtime-grants.sql
```

Verify `docs/deploy/publishing-api-v1-runtime-grants.sha256` from the immutable
commit first. The artifact is one transaction and fails closed unless the
completed v1 schema has exactly the expected 11 Publishing tables, two identity
sequences, and the reviewed append-only audit function/trigger owned by the
migration role. The target must be the fresh non-owner login with no
role-membership path, no `CREATE` on the `public` schema, no column-level
Publishing ACL, and no Publishing-table row security. Its ACL state must be
empty or exactly the desired state from a prior successful run. It grants only
the Publishing data plane and scheduler surface: read-only authority/control
tables, no control-plane mutation, immutable-audit `INSERT` only, and audit
sequence `USAGE` only. The artifact never grants DDL, changes ownership, or
grants audit update/delete/truncate. It pins a trusted transaction-local
`search_path` and qualifies every persistent target with the `public` schema.

On production databases where the four legacy CMS Blog tables already have row
security enabled, apply the separately reviewed least-privilege bridge before
runtime smoke:

```bash
psql -X -v ON_ERROR_STOP=1 \
  -v runtime_role=<dedicated-publishing-runtime-role> \
  -f docs/deploy/publishing-api-v1-production-legacy-rls.sql
```

Verify both production legacy-RLS SHA-256 manifests first. The forward artifact
permits Category/Tag reads needed to recheck inactive taxonomy, all Tag-link
reads needed to maintain the CMS-wide `post_count`, `post_count` writes already
limited by the column ACL, and Tag-link mutations whose Blog Post has a non-null
Publishing Identity. Blog Post reads/writes remain restricted to rows owned by
a Publishing Identity. It never enables or disables RLS, grants ACLs, changes
ownership, or permits deletion of a Blog Post. Keep the matching
`publishing-api-v1-production-legacy-rls-rollback.sql` beside the fresh database
backup; it removes exactly those nine policies and no data or grants. Do not run
either artifact on Dedicated-data Staging. Any future cross-environment data
boundary exception is a new infrastructure mutation and requires its own Gate B
plan and PM authorization.

Configure `PUBLISHING_DATABASE_URL` as an encrypted Coolify runtime secret and
leave `DATABASE_URL` unchanged. A missing Publishing URL fails Publishing
routes and the scheduler closed; it never falls back to the CMS owner connection
outside tests. Before enabling the Global Publishing Gate, verify through the
dedicated role both the mandatory legacy Blog-table smoke and a scheduler
heartbeat.
