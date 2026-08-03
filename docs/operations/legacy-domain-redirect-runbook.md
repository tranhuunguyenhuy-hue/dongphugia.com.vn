# Legacy `.com.vn` redirect runbook

This runbook is intentionally not active in the current deployment. The
`.com.vn` Vercel baseline remains reachable and source-write-frozen until the
seven-day observation gate passes.

## Activation gate

Require all of the following before a redirect deployment:

1. Seven consecutive days without a Sev-1 or Sev-2 production incident.
2. CloudWatch availability, health, error and resource alarms are deployed and
   tested.
3. AWS remains the only writable production and `.com.vn` invalid write probes
   remain blocked by `WRITE_FREEZE_ACTIVE`.
4. Fresh private S3 backup and immutable AWS image rollback references are
   verified.
5. `scripts/seo/verify-redirect-safety.mjs` passes on the reviewed URL
   inventory.
6. PM signs the redirect and rollback window.

## Exact behavior

- `dongphugia.com.vn` and `www.dongphugia.com.vn` each return one HTTP `308` to
  `https://www.dongphugia.vn`.
- The original path and query string are preserved.
- The final canonical host returns `200` without a loop or chain.
- `cdn.dongphugia.com.vn` is never redirected or moved.
- Vercel keeps the prior read-only deployment available as rollback; rollback
  means restoring the old Vercel aliases, not reopening Supabase writes while
  AWS is healthy.

## Rollback

If any route, media, canonical, TLS or error gate fails, promote the recorded
Vercel baseline deployment, verify `.com.vn` `200`, verify the source guard is
still ON, and remove only the newly introduced web redirect configuration.
Do not modify the Bunny CDN record or AWS `.vn` records as part of this
redirect-only rollback.
