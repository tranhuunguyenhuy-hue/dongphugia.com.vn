# Isolated Staging deployment foundation

This is the canonical candidate path for database-backed delivery:
`code → PostgreSQL migration → isolated Staging → test/smoke → Production promotion`.
It is
write-enabled only inside a disposable, label-owned PostgreSQL target and is
never a Production access path.

## Dedicated host boundary (LEO-527)

The canonical isolated target is provisioned by the dedicated EC2 foundation in
[`infra/dedicated-staging/`](../../infra/dedicated-staging/). The former
`dongphugia-staging-foundation` EC2 host is the Production + legacy Staging
co-host and is superseded as a Staging target; it remains untouched until the
separate LEO-528 cleanup scope.

The dedicated host contract is Staging-only: a private tagged Staging subnet,
a separate public egress subnet containing only one NAT Gateway, a security
group, instance profile, encrypted EBS data volume, Docker network and Docker
volume. The EC2 has no public IP; its default route targets the new NAT
Gateway. The security group has no inbound ingress at all: no SSH, PostgreSQL,
Coolify-admin, HTTP, or HTTPS. Browser smoke uses the SSM local port-forward
below rather than a public frontend.
The instance role has only standing SSM/CloudWatch management permissions and
no Production backup, database, application, or write capability. The one-time
clone exception is an exact-object S3 read and is removed after restore.
PostgreSQL is published only to host loopback and the application connects
through the private `postgres` network alias.

The host must pass a bounded SSM RunCommand probe before setup continues. The
host contract, database roles, marker, runtime guardrails, exact image
provenance, and side-effect controls are attested on the host; a CloudFormation
`CREATE_COMPLETE` event alone is not acceptance evidence. Before the probe,
verify the NAT Gateway is `available` and both the public IGW route and private
Staging route target the new NAT Gateway; if any route, VPC, AZ, or public-IP
check differs, stop without host setup.

## Target identity

- PostgreSQL image: `postgres:16.10-bookworm` pinned by the digest in
  `db/postgres-migrations/manifest.json`.
- Network: `dpg-isolated-staging-backend`.
- Volume: `dpg-isolated-staging-volume`.
- Database container: `dpg-isolated-staging-postgres`.
- Application container: `dpg-isolated-staging-app`.
- Ownership label: `com.dongphugia.deployment-foundation=isolated-staging-v1`.
- Database marker: `dongphugia:isolated-staging:v1`.
- Migration role: `dpg_staging_migrator`; application role:
  `dpg_staging_app`.

Names are fixed so preflight can refuse an unowned collision. PostgreSQL is
bound to a loopback-only random host port; the application is bound to
`127.0.0.1:3000` for the SSM port-forward and uses the private `postgres`
network alias. It does not use Production credentials, data, schema or volume.

## Canonical command

From a clean protected-main checkout, the workflow receives the exact digest
from `Build production candidate` and runs:

```sh
npm ci
npm run staging:isolated -- proof --image \
  ghcr.io/<owner>/dongphugia-web@sha256:<staging-validated-digest>
```

For local, non-promotable proof while editing foundation code:

```sh
npm run staging:isolated -- proof \
  --image dpg-foundation-isolated-staging:local --allow-dirty
```

The command performs preflight, source/provider/checksum validation, fresh
baseline replay, declared migration execution, app deployment, target
identity attestation, `/api/health`, homepage and `robots.txt` noindex smoke,
and exact schema-manifest comparison. It reports the candidate commit and
image digest; it does not deploy Production.

## Private browser smoke via SSM

The dedicated workload has no public browser ingress. After the bounded SSM
start-to-success probe and app health check pass, open a temporary local
forward in one operator terminal:

```sh
aws ssm start-session \
  --target "$STAGING_INSTANCE_ID" \
  --document-name AWS-StartPortForwardingSession \
  --parameters '{"portNumber":["3000"],"localPortNumber":["18000"]}'
```

The operator must have the Session Manager plugin installed. Keep the session
open only for the smoke window. In a second terminal, execute the existing
browser suite against the loopback endpoint; the config disables its local
web-server when this bounded URL is supplied:

```sh
STAGING_BROWSER_BASE_URL=http://127.0.0.1:18000 npm run test:homepage
```

The same endpoint may be checked first with
`curl --fail http://127.0.0.1:18000/api/health`. A non-loopback value is
rejected by the Playwright config. Stop the SSM session after the smoke; no
public IP, EIP association, ALB, DNS change, or inbound SG exception is part
of this contract.

For a Production-derived dataset on the dedicated host, use the approved
source-safe daily backup object and its checksum sidecar through the temporary
exact-object `GetObject` capability described in
[`infra/dedicated-staging/README.md`](../../infra/dedicated-staging/README.md).
Restore only into the Staging-owned database, remove the temporary capability,
and remove the transient dump after restore verification. A direct
Production-database clone is allowed only after the LEO-523 principal's
effective privileges are re-attested as read-only; a role name or secret
description does not prove that boundary. No Production application/database
content or permissions are changed by this path.

## Rebuild and rollback

```sh
npm run staging:isolated -- provision --image dpg-foundation-isolated-staging:local --allow-dirty
npm run staging:isolated -- reset
npm run staging:isolated -- down
```

`reset`/`down` remove only resources carrying the exact ownership label. A
fresh `provision` creates a new database and replays Baseline v1. If any
resource name exists without the label, the command stops and does not remove
it. A migration error rolls back its transaction and leaves the target
unpromotable until it is recreated.

## MS885 normalized migration boundary

The MS885 candidate creates only the normalized Family, generic configuration
groups, and explicit Product membership relations. It does not rewrite legacy
`variant_group` fields or Product/PDP commercial data. The approved
`MS885DW4#XW` and `MS885DW18#XW` manufacturer members remain catalogue gaps when
their Product rows are absent; the migration maps existing rows only and never
fabricates those Products. If coverage or schema validation fails, discard and
recreate the isolated target with `reset`; no down migration or shared-data
repair is implied.

## Failure gates

The runner fails closed for a non-PostgreSQL provider, SQLite/Prisma origin,
checksum or manifest mismatch, unsupported SQL transaction control, wrong
database marker/role/version, wrong target URL (including query overrides),
unexpected schema drift, or a Production-looking target. The schema allowlist
is empty by default and every future entry requires an exact object identity,
expected/actual hashes, reason, owner and review date.

## Disposable proof

The end-to-end proof adds `0001_pipeline_probe.sql` to a temporary copy of the
canonical origin. It is additive, runs only on the disposable target, is
verified in the ledger and is deleted with the target. It is not an MS885
feature migration and must never be promoted.
