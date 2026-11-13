# Stopped Admin release checkpoint — 2026-11-13

Owner stopped all workers and requested source backup before local cleanup.
This branch is an unfinished candidate, not a release-approved artifact.

## Required outcome

Admin is at `https://www.dongphugia.vn/admin`, sharing the existing Public
Cloudflare Worker and Supabase project `bonxyxluzlxfkdetryoo`, schema `dpg_app`.
Initial scope: legacy login, Products and Blog only. No Admin subdomain is needed.

## Source checkpoints

- Main `708c5e4c0151598d20a5e2110c6cf36da4da9230` includes merged PR300
  (Admin recovery) and PR302 (Staging terminal-redraw handling).
- Integration PR301: `codex/admin-worker-shared-db-spike-20261113-2`;
  implementation checkpoint before this note:
  `e84c5f182988ab2874222a4e66d4e72e7d11287f`.
- Publisher PR303: `codex/admin-release-profile-preparation`,
  `a51d2c4c2c3407a437ed0032254ccea3b8c5190d`; reported applicable CI passed.
- Database PR304: `codex/admin-runtime-db-role`,
  `3eff432e803e3129aa442dc0a11c368773423bc5` at stop;
  inspect current CI rather than assuming earlier passing local tests imply CI success.

## Known release blockers

The combined artifact generated at e84c5f1 is invalid for Production. Its Public
entry was the stock Vinext renderer, not canonical `apps/public/worker.ts`.
The local Public/Admin 200 responses do not establish preservation of canonical
Public caching, source identity, catalogue checkpoint or policy behavior.
Rebuild using the existing Production build/assembly contract, then independently
verify the complete module/asset trees, manifest and trusted publisher profile.

Authenticated login and Product/Blog edits have not been proved on the combined
Production artifact. Run the real built Worker with the dedicated least-privilege
database role, including denial and Public/Admin request-order/concurrency checks.
Do not deploy the existing invalid generated artifact.

At last inspection no Hyperdrive config existed in the approved Cloudflare
account. Production deployment token scope was unverified and the publisher's
Hyperdrive read-token secret was absent. Provisioning and secure credential
delivery remain unfinished. No hosted database migration or Admin deployment
was performed. Production reviewer protection was configured with the Owner
reviewer, main-only branch policy and administrator bypass disabled; reverify live.

## Local material outside Git

Generated `.vinext/`, `.wrangler/`, `dist/`, dependencies, environment files,
database contents and source capture pages are not source backups in Git.
The full capture was at `/tmp/dpg-legacy-admin-full-capture-20261113` and the
local PostgreSQL cluster at `/tmp/dpg-legacy-admin-pg-20261113`, port 55439.
Local databases included `dpg_legacy_admin_full_preview` and disposable Worker
fixtures. Capture acceptance was 17,752 Products, 10 Blog posts and 375,241
provenance rows; it was separate-query consistency, not an MVCC snapshot, and
media bytes were not verified. Preserve required data separately before deletion.

All three supervised worker tasks were explicitly stopped by the Owner.
Resume only after a new instruction; preserve remaining local files until backup
scope is verified. Existing PRs do not mean the Admin is deployed or release-ready.
