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
still has a maximum 90-day lifetime from issue.

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
must invoke it at least once per minute from the same environment and database:

```bash
npm run publishing:scheduler
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
5. `publishing_scheduler_state` heartbeat and minimized audit events exist.

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
