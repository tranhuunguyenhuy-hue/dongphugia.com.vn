# LUNA-01 — Worker version reconciliation

Date: 2026-10-29 ICT. Authority: current Owner request; Issues #160 and #202.
Scope: read-only Cloudflare inspection and source-only pagination correction.
Mutation owner: primary Codex, HELD during execution. No provider writes.

## Checkpoint and controls

Canonical checkout originally had main at b307d3615256850e310dcd24534fa0de4f31d0a0,
with untracked .artifacts/ and apps/. These files and all existing worktrees
were preserved. Task branch codex/luna-01-worker-versions-pagination starts
at verified remote main 23fe58358d1aaa3f9a4faa0b840987e028f8f7ab.
Existing generated artifacts are now ignored by that revision, not deleted.
No reset, duplicate upload, M1–M3 replay, Supabase, Production, DNS or billing
mutation. Issues #203–#205 remain deferred. Rollback: revert only this task's
source commit; no remote runtime rollback is needed.

## Read-only result: PASS

Cloudflare GET responses show 11 versions: page 1 has 10, page 2 has 1,
with total_count=11. Target 17fe81fb-9f43-43b9-85d0-33952cff74d6 exists.
Its alias is pr-201; message identifies source
23fe58358d1aaa3f9a4faa0b840987e028f8f7ab, matching the preserved upload receipt.
The exact version set equals the 10 IDs in the preserved remote-preflight.json
from run 40823454239 plus that one uploaded version. No extra/missing IDs.

Deployment 6e7022d5-5f4d-4f51-8ab3-01850503a711 remains unchanged, assigning
100% to bootstrap d4658ffa-2fcd-465b-bae7-7967bb1c7f78. workers.dev is disabled;
Preview URLs are enabled. No Worker routes or custom domains were observed.
Binding names/types match the checkpoint: APP_BUILD_TARGET, APP_ENV, APP_ORIGIN,
PREVIEW_NOINDEX (plain_text), ASSETS (assets). No environment values were read
into the report. Version-specific binding names/types were also checked.

Evidence: preserved sanitized files in
/tmp/dpg-pr201-preview-evidence-40823454239/ (remote-preflight.json,
upload-evidence.json); sanitized live response /tmp/dpg-luna01-live-state.json.
Local temporary paths are supporting evidence, not durable artifact custody.
Canonical run: https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/actions/runs/40823454239

## Root cause and source correction

Both preflight and post-upload inspection previously fetched only the default
first page of versions. After the eleventh upload, the oldest bootstrap falls
off that page. Exact-set comparison then throws VERSION_STATE_UNEXPECTED.
The target itself is on page 1; its absence was not the cause.

Both inspectors now use a shared GET-only paginator with explicit page/per_page,
stable total/count/page checks, required pagination metadata, unique valid IDs,
and a bounded page limit. Partial nonempty pages continue until total_count is
reached. Missing metadata, duplicate IDs, changing totals, premature empty pages
and failed reads stop inspection. Existing exact version/deployment/isolation
checks remain in force.

## Validation: PASS

Regression first failed with POST_FAILURE_VERSION_STATE_UNEXPECTED for 11 and
25 versions while the original 33 tests passed. After the fix:

`npx vitest run scripts/app-foundation/cloudflare-preview-publication.test.ts scripts/catalogue-direct/public-preview.test.mjs scripts/app-foundation/preview-change-gate.test.ts`

49/49 PASS, including partial pages, duplicates, changing totals, missing
metadata, premature empty pages and HTTP errors. Node syntax and git diff
whitespace checks PASS. The post-upload inspector also passed a sanitized
replay of the live 11-version response against the exact saved run preimage;
this replay used synthetic credentials and made no network requests.

## Remaining gates

This resolves control-plane reconciliation, not visual or runtime acceptance.
Owner UI acceptance remains FAIL / NOT ACCEPTED per #202. No browser acceptance,
full build, data operation, publication or deployment was performed. PR #206
contains the source correction; required CI and independent Standards/Spec
review are tracked separately from Preview acceptance. Production/DNS HOLD.
Any new publication requires separate Owner authorization. This reconciliation
does not resume any other task or recovery work.
