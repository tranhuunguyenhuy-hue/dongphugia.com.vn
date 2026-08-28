# LEO-543 pg_cron scheduler runbook

This runbook describes the source contract for the isolated `dongphugia-runtime`
Preview target in `ap-southeast-1`. It does not authorize Production, DNS,
traffic, credentials, paid features, or a scheduler activation.

## Source contract

`supabase/migrations/20260829100000_leo543_scheduler.sql` creates:

- a one-minute `pg_cron` job named `leo543-publishing-scheduler`, kept
  `active = false` by the migration;
- a singleton advisory-locked tick and one unique ledger row per minute;
- bounded response retries with backoff and explicit `STALE_RUN_RECOVERY`;
- a 10,000-row ledger hard stop that prevents unbounded free-tier growth and
  records `LEDGER_RETENTION_OWNER_DECISION_REQUIRED`;
- a sanitized status/freshness ledger and `leo543_scheduler_report()`; and
- `leo543_publishing_freshness`, which measures scheduler transport freshness,
  not public route or browser freshness.

The migration does not install `pg_cron`/`pg_net`, create Vault secrets, or
return any secret. With the default `enabled = false`, a tick records a
disabled state and performs no HTTP request.

## Owner decision package before activation

Revalidate and record all of the following for the exact isolated Preview
candidate:

1. The target contract still identifies `dongphugia-runtime`,
   `ap-southeast-1`, `preview`, and `production_writes_allowed = false`.
2. Current Supabase plan, database/egress/cron/`pg_net` allowance, and the
   scheduler budget are known and within the free-tier policy.
3. Existing `pg_cron` and `pg_net` are available. Do not install or upgrade an
   extension as a workaround for a missing Owner gate.
4. The exact internal HTTPS scheduler URL is approved, reachable from the
   target, and is not a public traffic cutover. Record it in the owner-managed
   `dpg_control.leo543_scheduler_config.endpoint_url` value; it is not read
   from an arbitrary URL secret.
5. The existing approved Vault entry named `leo543_scheduler_token` is present.
   The token must be the already approved scheduler credential; this issue
   creates or rotates no credential. The database function sends it only to the
   reviewed `endpoint_url` value.
6. The exact candidate is validated with the SQL acceptance test, the internal
   scheduler endpoint, and a separate noindex Preview/public-surface freshness
   check. A green SQL test alone is not end-to-end acceptance.

Only after that package is approved may the Owner activate the named job and
set the existing scheduler configuration to enabled. Keep the same candidate,
target, and rollback owner throughout the check.

## Disarm and rollback

The normal rollback is a forward, non-destructive disarm. With the exact
Owner-approved migration identity, set `enabled = false` for the singleton and
deactivate the named `pg_cron` job with `cron.alter_job`. Then confirm the
sanitized report says `SCHEDULER_DISABLED` and no new dispatch is recorded.
The migration does not provide a drop/delete rollback: removing ledger history,
extensions, Vault entries, or target data requires a separate Owner decision and
recovery evidence. A source rollback must preserve this disarm-first procedure.

## Read-only report

The migration exposes only sanitized status to `dpg_readonly`:

```sql
select dpg_control.leo543_scheduler_report();
select * from dpg_control.leo543_publishing_freshness limit 20;
```

Response bodies, URLs, Vault values, customer data, and database rows outside
the bounded scheduler metrics are not part of the evidence record.

The scheduler intentionally does not delete old ledger rows. Reaching the
10,000-row bound is a visible stop, not silent compaction; any retention or
deletion policy requires a separate Owner decision and recovery evidence.
