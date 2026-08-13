# Publishing API v1 runbook

This runbook operates the internal, single-tenant Publishing API. It does not
authorize a staging rollout, a production deployment, a database migration, or
any Bunny configuration change. Those are separate PM approval gates.

## Safety invariants

- Every Publishing Agent has its own Machine Identity, Integration Sponsor,
  capabilities, and environment-bound credential. Never use an admin session,
  shared key, or one credential for multiple integrations.
- The Global Publishing Gate is disabled by the migration and stays disabled
  until a staging acceptance record and explicit PM decision exist.
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

Provide the following only through the approved runtime secret/configuration
mechanism. Values in the two storage entries are separate for staging and
production. Do not copy staging storage credentials or CDN hosts into
production, or vice versa.

| Variable | Purpose | Secret |
| --- | --- | --- |
| `PUBLISHING_ENVIRONMENT` | Exact `staging` or `production` boundary | No |
| `PUBLISHING_EXTERNAL_LINK_HOSTNAMES` | Comma-separated, reviewed exact HTTPS citation hosts; no wildcard | No |
| `PUBLISHING_JSON_RATE_LIMIT_MAX` | Per-Machine-Identity JSON limit | No |
| `PUBLISHING_MEDIA_RATE_LIMIT_MAX` | Per-Machine-Identity media limit | No |
| `PUBLISHING_RATE_LIMIT_WINDOW_SECONDS` | Durable rate-limit window | No |
| `PUBLISHING_TRUSTED_PROTO_HEADER` | Proxy header trusted for HTTPS verification | No |
| `PUBLISHING_TRUSTED_CLIENT_IP_HEADER` | Optional proxy header for IP policy | No |
| `PUBLISHING_BUNNY_STORAGE_ENVIRONMENT` | Must exactly match `PUBLISHING_ENVIRONMENT` | No |
| `PUBLISHING_BUNNY_STORAGE_ZONE_NAME` | Publishing-only Bunny storage zone | No |
| `PUBLISHING_BUNNY_STORAGE_HOSTNAME` | Exact Bunny storage API host | No |
| `PUBLISHING_BUNNY_CDN_HOSTNAME` | Exact publishing CDN host; must be allowed by image CSP | No |
| `PUBLISHING_BUNNY_STORAGE_API_KEY` | Bunny storage write credential | Yes |
| `PUBLISHING_SCHEDULER_TOKEN` | Internal scheduler invocation credential, 32–256 chars | Yes |
| `PUBLISHING_SCHEDULER_URL` | Local/approved internal app URL for the one-shot runner | No |

Adding a citation host is a reviewed configuration/source change. It is not a
runtime wildcard or an OpenAPI enum. The Publishing API never fetches a cited
URL.

## Control-plane commands

Run these with a direct non-production database only during staging acceptance,
or with the separately approved production database execution path. The command
prints structured metadata, except the one-time `credential` returned by issue
or rotate. Capture no plaintext credential in logs.

```bash
npm run publishing:control -- identity-create \
  --actor-admin-id <active-admin-id> --confirm yes \
  --name '<integration-name>' --sponsor-user-id <staff-id> \
  --capabilities posts:write,media:write,posts:publish

npm run publishing:control -- credential-issue \
  --actor-admin-id <active-admin-id> --confirm yes \
  --identity-id <machine-identity-uuid> --environment staging
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

Rotate before expiry. The command requires exactly one active source credential
for that identity/environment and caps overlap at seven days; every credential
still has a maximum 90-day lifetime from issue. A Machine Identity has at most
two active credentials across both environments, so rotate only after an
unneeded environment credential is revoked or expires.

```bash
npm run publishing:control -- credential-rotate \
  --actor-admin-id <active-admin-id> --confirm yes \
  --identity-id <machine-identity-uuid> --environment production \
  --from-credential-id <current-credential-uuid>

npm run publishing:control -- expiry-report --within-days 14
npm run publishing:control -- audit-report --limit 50
```

## Global Publishing Gate

The Gate is optimistic-concurrency protected. Read the current version from the
private operational database before changing it, then use that exact version.
The migration creates `(enabled=false, version=1)`.

```bash
npm run publishing:control -- gate-set \
  --actor-admin-id <active-admin-id> --confirm yes \
  --enabled true --expected-version <current-version>
```

Use `--enabled false` for the kill switch. It blocks Agent immediate publish,
new scheduled publication, live replacement, and scheduler transitions; it does
not stop normal human CMS writes.

## Scheduler

The scheduler is repository-owned and one-shot. The accepted host/Coolify path
must invoke it at least once per minute from the same environment and database.
For each staging or production application, create a Coolify **Scheduled Task**
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

After enabling the scheduler in staging, verify privately:

1. a due ready post becomes `published` once;
2. revoked capability, closed Gate, stale version and inactive taxonomy each
   become a Schedule Block;
3. resubmitting a scheduled mutation with the current ETag is required to
   recover a blocked post;
4. `/`, `/blog`, the category, post page and sitemap reflect publication within
   five minutes; and
5. `publishing_scheduler_state` heartbeat and minimized audit events exist;
   after three successful one-minute runs, this command must report
   `healthy: true` and `success_age_seconds <= 120`:

   ```bash
   npm run publishing:control -- scheduler-report --max-age-seconds 120
   ```

6. Create a synthetic ready publication due in the next minute. Its post page,
   `/`, `/blog`, category page, and sitemap must reflect the result within five
   minutes of the declared time. Record the Coolify task history, scheduler
   report, API response, and public checks as the staging SLA acceptance
   evidence.

Before this staging acceptance, run the PostgreSQL race harness only against a
fresh **disposable** PostgreSQL database bootstrapped with the reviewed schema.
It deliberately creates immutable audit evidence and is not for a shared
staging database. Supply a synthetic active admin ID through the approved local
environment mechanism; do not put a connection string or credential in shell
history, CI logs, or this repository.

```bash
PUBLISHING_CONCURRENCY_TEST_CONFIRM=disposable \
PUBLISHING_CONCURRENCY_TEST_DATABASE_URL=<disposable-postgresql-url> \
PUBLISHING_TEST_SPONSOR_ADMIN_ID=<synthetic-active-admin-id> \
npm run publishing:test-postgres-concurrency
```

The harness verifies concurrent credential issue/rotation (maximum two active
credentials), credential revoke before the mutation boundary, capability revoke
before publication authority, and Global Publishing Gate close before a public
transition. Save only the PASS/fail result and sanitized timing evidence.

## Staging and rollout gates

Before enabling the staging Gate:

1. Apply the reviewed additive migration
   `prisma/migrations/20260812205000_publishing_api_v1/migration.sql` through
   the approved staging DB path. Never use `prisma migrate` blindly: historic
   migration metadata is not the PostgreSQL deployment authority here.
2. Configure an isolated staging Publishing storage zone/CDN hostname and run
   upload, post and scheduler acceptance with synthetic content only.
3. Verify image CSP and remote image policy include the staging publishing CDN.
4. Keep production Gate disabled. A staging success does not authorize a merge
   or a production migration/deployment.

Production requires a new explicit PM approval for its execution window,
backup/rollback evidence, immutable ARM64 candidate and current Coolify control
plane path. This runbook intentionally contains no production secret or live
control-plane command.

## Bounded production recovery after the legacy-constraint stop

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
immutable commit before execution. Do not use this recovery on staging or a
clean database, and do not change ownership or grant DDL privileges to the
application runtime role.
