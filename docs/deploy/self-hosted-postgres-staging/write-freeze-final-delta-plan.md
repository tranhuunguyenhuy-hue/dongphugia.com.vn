# Write-freeze and final-delta plan

Status: plan only. Do not freeze production writes, export data, import data, or
change traffic without a separate approval.

## Why this is required

Orders, quote requests, customers, admin users, audit logs, and content/admin
mutations can change while a database migration is in progress. A one-time dump
from Supabase production is not enough unless writes are frozen or a final delta
is captured and replayed safely.

The current application has `MAINTENANCE_MODE`, but the proxy bypasses `/admin`
and `/api`. That means maintenance mode alone is not a safe write-freeze
mechanism for:

- public order submission;
- public quote request submission;
- admin create/update/delete actions;
- admin login/session writes;
- admin audit log writes.

## Tables that need freeze or final delta

Critical writes:

- `orders`
- `order_items`
- `quote_requests`
- `quote_items`
- `customers`
- `admin_users`
- `admin_sessions`
- `audit_logs`

Content/editorial writes:

- `blog_posts`
- `blog_post_tags`
- `blog_categories`
- `blog_tags`
- `banners`
- `partners`
- `projects`
- `redirects`
- catalogue/product tables if admin product editing remains enabled

Session state:

- `admin_sessions` must not be migrated. Admins should log in again after
  cutover.

## Source draft included in this branch

This branch includes a default-off write-freeze guard:

- `src/lib/write-freeze.ts`
- `src/lib/prisma.ts`
- explicit route guards for cache/image side effects:
  - `src/app/api/revalidate/route.ts`
  - `src/app/api/admin/revalidate/route.ts`
  - `src/app/api/upload-image/route.ts`

The guard is controlled by `WRITE_FREEZE_MODE=true`. Leaving the variable unset
or set to any other value keeps current runtime behavior unchanged.

Coverage:

- Prisma model mutations are blocked centrally.
- Raw Prisma execute operations are blocked centrally.
- Public order and quote writes are blocked through Prisma mutation interception.
- Admin server-action database writes are blocked through Prisma mutation
  interception.
- Admin login/session writes are blocked through Prisma mutation interception.
- Bunny image upload is blocked through an explicit route guard.
- Cache revalidation endpoints are blocked through explicit route guards.

Known draft limitation:

- Some server actions currently catch all errors and return their existing
  generic Vietnamese error message. The write itself is still blocked, but a
  future UX polish pass can map `WRITE_FREEZE_ACTIVE` to a consistent friendly
  message in every admin form.

## Recommended freeze model

Use the application-level write guard for the final cutover window. Operational
maintenance mode is useful for visitors, but it is not sufficient by itself
because admin and API routes are currently bypassed.

Minimum future operational step before production cutover:

- block public POST routes that create orders or quote requests;
- block admin server actions/API mutations except safe reads;
- keep login behavior explicit: either block admin login during freeze, or allow
  login but block mutations and accept that sessions are not migrated;
- return a friendly 503/maintenance response for public write attempts;
- record no secrets in logs.

## Rehearsal sequence

T-24h:

1. Announce an internal staging migration rehearsal window.
2. Confirm Supabase production remains the source of truth.
3. Confirm no DNS, Cloudflare, or production traffic changes are planned.
4. Confirm backup/restore drill has passed.

T-2h:

1. Verify latest schema bootstrap checksum.
2. Verify target self-hosted staging DB is healthy and private.
3. Run source/target count queries in read-only mode.
4. Confirm pending admin/editor work is paused.

T-15m:

1. Enable the future write guard after approval.
2. Confirm public order and quote request writes return the expected
   maintenance response.
3. Confirm admin mutation attempts are blocked while admin read paths still
   behave as expected.
4. Capture the approved data export.

Import window:

1. Restore into the self-hosted target with `--single-transaction` and
   `--exit-on-error`.
2. Reset/preserve sequences through the restore.
3. Run reconciliation queries from `reconciliation-queries.sql`.
4. Do not cut traffic if count/checksum differences are unexplained.

Final delta:

1. If writes remained fully frozen, final delta is empty by design.
2. If any writes were intentionally allowed, export only rows changed after the
   initial export watermark.
3. Apply final delta in one transaction.
4. Re-run reconciliation.

Unfreeze:

1. Only after PM approval for the next gate.
2. Keep a record of freeze start/end times and the source export watermark.

## Rollback during rehearsal

If the rehearsal fails before traffic changes:

1. Keep production on Vercel/Supabase.
2. Keep or discard the self-hosted staging DB only after explicit approval.
3. Disable the future write guard if it was enabled.
4. Re-open public/admin writes on the current production path.
5. Preserve logs, counts, and failed reconciliation output for review.

## Rollback after a future cutover

Rollback is only simple if no writes have landed on the self-hosted DB. If
writes have occurred after cutover, choose one path:

- export/replay the self-hosted write delta back to Supabase before repointing;
- or keep the self-hosted DB as source of truth and roll forward.

Do not silently switch back after post-cutover writes without a reconciliation
decision.
