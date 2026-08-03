# Dongphugia minimum monitoring

This directory contains the deployable, secret-free monitoring package for the
single production EC2 instance in `ap-southeast-1`.

## Contents

- `cloudwatch-agent.json` collects CPU, memory, root-disk and swap metrics and
  forwards only the aggregate JSONL output of
  `sanitize-docker-observation.sh` to a 14-day CloudWatch log group. It never
  tails `/var/lib/docker/containers/*/*.log` directly. The configuration pins
  the deployment region and avoids newer agent-only fields and the unsupported
  inode metric so it remains compatible with the installed production agent
  family; the service runs the agent with its default privileged account.
- `sanitize-docker-observation.sh` requires an explicit
  `DPG_MONITOR_CONTAINERS` allowlist and emits only numeric counts for 5xx,
  DB, TLS, OOM and health-failure markers. Missing or stale allowlists produce
  a `monitoring_configuration_missing` event and a non-zero exit. Its
  append-only aggregate file is created with restrictive local permissions.
- `dpg-sanitized-observation.service` and `.timer` run the sanitizer once per
  minute. `monitoring.env.example` is intentionally empty and must be filled
  only after exact production container names and digests are verified.
- `ec2-cloudwatch-agent-policy.json` is the least-privilege policy to add to
  the existing EC2 instance role. It cannot read Secrets Manager or application
  environment variables.
- `cloudwatch-monitoring.yaml` creates the aggregate log group, metric filters, alarms,
  dashboard, query definition and SNS topic. The optional email subscription
  requires the operator to confirm the email from AWS.
- `npm run monitor:verify-package` is a CI preflight that rejects raw-log paths,
  secret-read permissions, unsupported `run_as_user` configuration and missing
  fail-closed collector wiring.

## Safe deployment boundary

The template has not been deployed by this change. Deploying it changes AWS
resources and requires a fresh PM maintenance window plus an IAM preflight. The
operator must first confirm that the existing EC2 instance profile can publish
the `Dongphugia/EC2` metrics and Docker logs, or apply the reviewed policy to
that role. Do not attach a new role blindly and do not inspect or print runtime
environment variables.

Before applying the stack, validate it locally with:

```sh
aws cloudformation validate-template \
  --profile dongphugia-admin \
  --region ap-southeast-1 \
  --template-body file://infra/monitoring/cloudwatch-monitoring.yaml
```

The operator must also install the sanitizer and timer through the reviewed
change procedure, then run one bounded manual invocation and verify that the
aggregate file contains JSON counters only. Do not copy Docker log files into
the CloudWatch Agent path. A missing allowlist must remain an alerting failure,
not be replaced with a wildcard.

The production alert thresholds are intentionally symptom-oriented and
conservative:

- EC2 status failure: two consecutive one-minute periods.
- CPU: above 80% for three five-minute periods.
- Memory: above 85% for three five-minute periods.
- Root disk: above 80% for three five-minute periods.
- Application dependency health failure: one event in five minutes.

Missing agent metrics are treated as breaching so a silent monitoring failure
cannot look healthy. The collector and log group must never receive raw Docker
stdout/stderr, request bodies, connection strings, tokens or PII. The
CloudWatch queries operate only on the numeric aggregate fields emitted by the
collector.
