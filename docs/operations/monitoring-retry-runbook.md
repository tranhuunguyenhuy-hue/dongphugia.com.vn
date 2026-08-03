# Production monitoring retry runbook

This runbook is preparation only. It does not authorize an AWS, EC2, DNS,
Vercel, Coolify, database or traffic change. Execute it only inside a fresh,
exact PM window with the monitoring deployment explicitly approved.

## Preconditions

- Re-read the handoff files and confirm the old coordinator is released.
- Confirm AWS account, region, SSM reachability, current production and apex
  container names, and their exact immutable digests.
- Confirm `.com.vn` remains reachable and write-frozen, `.vn` DNS is unchanged,
  and the private backup/manifest controls still pass.
- Load the AWS secret-safety instructions before any credential task. This
  package must not read Secrets Manager or application environment variables.

## Compatibility requirements

- The current production agent family is `1.300067.1`.
- Do not call `validate-config`; that action is not available in the installed
  control script.
- Do not set `agent.run_as_user`; it is not exposed by the installed agent
  schema and caused the previous configuration attempt to fail.
- Use the documented `fetch-config` action only after the exact package and
  container guards pass. Treat a non-zero result as a mandatory NO-GO.

## Bounded deployment order

1. Create the approved aggregate-only CloudFormation resources and verify the
   stack reaches `CREATE_COMPLETE`. Do not create an email subscription unless
   PM supplies an address and the human confirmation flow is understood.
2. On EC2, stage only the reviewed agent JSON, sanitizer, environment file and
   systemd units. Populate the allowlist with the exact verified production
   container names only; leave the collector fail-closed if identity checks do
   not match.
3. Apply the agent configuration with `fetch-config`. Verify only sanitized
   service status, config presence, timer state and aggregate sample shape.
   Never emit raw agent/Docker logs, environment values or request content.
4. Run one bounded sanitizer sample. Accept only numeric aggregate fields and
   the expected event marker; any raw-log path, missing allowlist, digest
   mismatch or telemetry error is NO-GO.
5. Verify the log group, dashboard, query, alarms and metric publication using
   aggregate metadata only. Do not run load, rollout or DNS work from this
   runbook.

## Failure and rollback

- On any failed guard, stop mutation immediately and preserve `.vn`, Vercel and
  `.com.vn` rollback availability.
- Remove only the newly installed sanitizer, environment file and systemd
  units. Keep the pre-existing CloudWatch Agent state unchanged unless the
  failed `fetch-config` operation changed it; if so, restore the previously
  recorded config through the approved rollback path.
- Delete only the newly created monitoring stack/resources, then verify the
  stack, alarms, SNS topic and retained empty log group state with aggregate
  checks.
- Recheck `.vn` home/health, `.com.vn` home and the non-mutating freeze guard.
- Update `LIVING_CONTEXT.md` and `SESSION_LOG.md` with sanitized evidence and
  stop. A failed retry requires another exact PM window.

## Acceptance boundary

Monitoring is not PASS until all of the following are verified: the agent is
active with the repaired config, the sanitizer timer is active, the aggregate
sample contains no raw lines, the log group receives only aggregate events,
alarms and dashboard exist, and rollback baseline/DNS invariants remain PASS.
