# LEO-553 trusted Preview scheduler bridge

Status: source-only, unconfigured, and fail-closed on unresolved Publishing
parity. This document does not authorize a deployment, secret change,
extension install, scheduler activation, merge, or Production action.

## Fixed architecture

The isolated Preview path is:

`LEO-543 pg_net -> publishing-scheduler Edge Function -> LEO-553 narrow RPC -> LEO-542 Publishing authority -> fixed GitHub workflow dispatch -> trusted main static build -> existing Cloudflare Pages Preview project`

The Edge Function accepts only `POST`, the existing
`x-publishing-scheduler-token`, and the LEO-543 body fields `source`, `run_id`,
and `slot_at`. It uses a publishable Supabase key, never a secret/service-role
key. The narrow RPC compares the supplied token with the existing
`leo543_scheduler_token` inside Vault and returns only `result_code`,
`processed_count`, `published_count`, `blocked_count`, plus one internal
boolean that the Edge Function removes before replying.

The Publishing transition reuses the LEO-542 global gate, identity capability,
advisory-lock order, scheduled-post tables, and append-only Publishing audit.
It does not create another Machine Identity or capability model. A run UUID is
the durable idempotency key. The RPC processes at most 100 due rows; a duplicate
run returns its bounded stored result and cannot repeat a publish transition.

## LEO-542 Supabase parity contradiction

The accepted canonical application scheduler rechecks restricted HTML, exact
HTTPS citation-host allowlisting, canonical Managed Media URLs, media
purpose/ownership/readiness, the 20-asset ceiling, thumbnail/cover requirements,
active taxonomy, readiness lengths, Machine Identity authority, version, and
the Global Publishing Gate immediately before publication.

The accepted LEO-542 Supabase `leo542_publishing_post_put` RPC can currently
write `scheduled` or `published` content without enforcing restricted HTML,
citation-host allowlisting, media-purpose parity, the asset ceiling, or the
canonical thumbnail/cover Publication Readiness Gate. Its media-reference RPC
also accepts caller-supplied usage without checking it against media purpose.
The SQL-only LEO-553 scheduler therefore cannot reuse one canonical helper, and
copying a partial or newly invented policy into LEO-553 would create the second
Publishing authority model prohibited by this issue.

`LEO553_PUBLISHING_PARITY_APPROVED` is consequently fixed to `false`. The Edge
Function returns sanitized `PUBLISHING_PARITY_UNRESOLVED` before invoking the
publishing RPC. This is a source-level fail-closed guard, not an enablement
toggle or an Owner approval mechanism. Resolving the contradiction requires a
separate Owner decision and reviewed source change across the LEO-542 Supabase
write boundary and scheduler authority.

## Refresh behavior

- `published_count = 0`: no GitHub request and no static build/deploy.
- `published_count > 0`: one transactionally claimed refresh request.
- duplicate/retry after the claim: no second dispatch.
- GitHub request failure: fixed sanitized failure code in the Edge response and
  durable failed transport status; no credential or raw response body is stored.
- trusted refresh failure: the GitHub run fails with
  `TRUSTED_STATIC_REFRESH_FAILED` and retains normal Actions evidence.

The Edge Function calls only the hard-coded
`/actions/workflows/preview-publishing-refresh.yml/dispatches` endpoint with
exact payload `ref: main` and one sanitized `refresh_id` input. The workflow
supports only `workflow_dispatch`; it checks out `refs/heads/main`, requires
the checkout SHA to equal `GITHUB_SHA`, and accepts no repository, ref,
workflow, branch, deployment command, environment, project, or target input.
Secret-bearing steps execute only the trusted main workflow and trusted main
scripts. Candidate executable surface with privileged secrets is **NONE**.

Transport and completion are deliberately separate. HTTP 200 plus a validated
GitHub `workflow_run_id` records only `refresh_transport_status=accepted`.
The database then records
`refresh_completion_status=external_evidence_required`; it never calls this
freshness completion. Workflow success or failure remains observable in GitHub
Actions by the stored sanitized run ID. A durable database callback would need
another authenticated write boundary, so this source change does not add one.

The workflow reuses `npm run static:verify-preview-source`,
`npm run static:build -- --mode=preview`, and
`npm run static:verify-preview`. The canonical artifact contract is unchanged.
It deploys only the fixed `publishing-refresh` branch of the existing configured
Pages project. The stable measurement URL is:

`https://publishing-refresh.<existing-preview-project>.pages.dev`

HTML metadata, `X-Robots-Tag`, and `robots.txt` are rechecked on every refresh.
The workflow cannot create a project, use a custom domain, change DNS/traffic,
or select Production.

## Credential Owner gate

The 2026-08-29 read-only GitHub Actions inventory contained no workflow-
dispatch credential. Supabase Edge secret inventory remains `UNKNOWN` because
authenticated list-only access was unavailable; no secret values were
requested. Runtime enablement therefore requires a separate Owner security
decision for exactly one new credential, but only after the Publishing parity
contradiction is resolved:

- preferred provider: a fine-grained personal access token with an explicit
  expiry. It can be limited to one repository and one permission, is easy to
  revoke, requires one Edge secret, and avoids GitHub App private-key, App ID,
  and token-minting machinery. A GitHub App installation token is preferable
  only if an approved token broker already exists; storing one is not viable
  because it is short-lived, while minting it increases secret count and
  operational burden;
- repository scope: only `tranhuunguyenhuy-hue/dongphugia.com.vn`;
- minimum API permission: repository `Actions: write`, because the fixed
  workflow-dispatch endpoint requires that permission; no `Contents: write`,
  no `Workflows: write`, no Administration, and no organization, pull-request,
  environment, package, or account-wide permission;
- storage: Supabase Edge Function secret named
  `LEO553_GITHUB_DISPATCH_TOKEN` on the exact `dongphugia-runtime` Preview
  project only;
- use: one fixed `POST /repos/tranhuunguyenhuy-hue/dongphugia.com.vn/actions/workflows/preview-publishing-refresh.yml/dispatches`
  with `ref=main`; the pinned API contract requires HTTP 200 and a valid
  numeric workflow run ID;
- rotation/revocation: revoke the token/App installation first, replace the
  Edge secret by a secret-safe mechanism, verify no dispatch, then issue the
  replacement and run bounded no-change/change acceptance;
- blast radius: compromise can exercise GitHub APIs allowed by repository
  `Actions: write` in this one repository, including dispatching other
  workflows and manipulating eligible Actions runs/artifacts. It cannot write
  repository contents under the proposed permission. The hard-coded Edge path
  narrows normal use but does not narrow what a stolen credential can do; this
  is why issuance remains an explicit Owner gate.

The existing Vault scheduler token is not copied into Edge secrets, rotated,
or exposed. It is supplied at invocation and compared inside the database.

## Future Owner mutation package

After this source PR is approved and merged, record one exact package before
any mutation:

1. Decide the canonical Publishing authority direction: either bring the
   LEO-542 Supabase write/readiness boundary to exact canonical parity with one
   reusable authority, or route scheduled publication through the canonical
   application scheduler. Approve a reviewed source change that removes the
   fixed parity guard; do not toggle it at runtime.
2. Revalidate the exact Supabase project identity, Free plan, region, target
   contract, existing Vault secret name, and existing Pages project/domain
   contract.
3. Approve/create the exact GitHub credential above and configure only
   `LEO553_GITHUB_DISPATCH_TOKEN` by a secret-safe mechanism.
4. Apply the LEO-553 migration and deploy `publishing-scheduler` from the exact
   trusted main SHA; do not deploy candidate code.
5. Set `LEO553_PREVIEW_REFRESH_CONTRACT=trusted-main-fixed-preview` and only
   then set `LEO553_PREVIEW_REFRESH_ENABLED=true`.
6. Run one invalid-auth probe, one no-change invocation (zero dispatch), and
   one synthetic accepted publication change (one dispatch and refreshed
   stable noindex URL).
7. Record sanitized counts, exact trusted main SHA, workflow run, artifact
   hash, stable URL noindex checks, and rollback evidence.
8. Only after that acceptance may LEO-543 reconcile PR #127 and request its own
   separate extension/migration/scheduler activation gate.

## Disarm and rollback

Disarm in this order: set `LEO553_PREVIEW_REFRESH_ENABLED=false`, revoke the
GitHub credential, disable or remove the Edge secret, and undeploy/disable the
Edge Function. LEO-543 must remain disabled. Database rollback is a separately
reviewed migration that revokes the three public RPC grants and leaves the
append-only run/audit evidence intact; it must not delete publication rows or
ledger history.
