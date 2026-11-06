# Phase 2 Admin order confirmation rollback contract

This document describes source-level rollback constraints. It does not
authorize applying a migration, changing hosted data, merging a PR or deploying
an application.

The commercial confirmation is append-only and records the staff actor,
request/idempotency hashes, shipping fee, per-item installation fees, base
total, derived confirmed total and timestamp. The original guest receipt and
order-item price snapshots are left intact. A confirmation is also the database
precondition for moving a guest request to `confirmed`.

Before any future hosted migration or rollback, the Owner must approve the exact
target and candidate. The operator must capture a recoverable backup and prove
restore for that target, inspect the migration ledger and count confirmation
rows, and stop order-status writes during the change.

If any confirmation row exists, do not drop or rewrite the snapshot table and
do not reverse the status guard. Preserve the confirmed history and use a
forward-compatible application rollback or a reviewed forward migration. If no
confirmation rows exist, code rollback may be considered only after the exact
runtime can still read guest orders and the migration ledger remains intact.
No destructive reverse SQL is provided because deleting staff confirmation
history would break the audit contract.
