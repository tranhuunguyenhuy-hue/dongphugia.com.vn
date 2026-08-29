# LEO-553 trusted Preview scheduler bridge

Status: source-only and unconfigured. This document does not authorize a
deployment, secret change, extension install, scheduler activation, merge, or
Production action.

## Fixed architecture

The isolated Preview path is:

`LEO-543 pg_net -> publishing-scheduler Edge Function -> LEO-553 narrow RPC -> LEO-542 Publishing authority -> fixed GitHub repository dispatch -> trusted main static build -> existing Cloudflare Pages Preview project`

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

## Refresh behavior

- `published_count = 0`: no GitHub request and no static build/deploy.
- `published_count > 0`: one transactionally claimed refresh request.
- duplicate/retry after the claim: no second dispatch.
- GitHub request failure: fixed sanitized failure code in the Edge response and
  durable `failed` refresh status; no credential or response body is stored.
- trusted refresh failure: the GitHub run fails with
  `TRUSTED_STATIC_REFRESH_FAILED` and retains normal Actions evidence.

The refresh workflow is triggered by the fixed `leo553-preview-refresh`
`repository_dispatch` event. GitHub runs this event from the default branch;
the workflow additionally checks out `refs/heads/main`, requires the checkout
SHA to equal `GITHUB_SHA`, and accepts no repository, ref, workflow, branch,
deployment command, project, or target input. Secret-bearing steps execute only
the trusted main workflow and trusted main scripts. Candidate executable
surface with privileged secrets is **NONE**.

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

The 2026-08-29 read-only GitHub Actions inventory contained no repository-
dispatch credential. Supabase Edge secret inventory remains `UNKNOWN` because
authenticated list-only access was unavailable; no secret values were
requested. Runtime enablement therefore requires a separate Owner security
decision for exactly one new credential:

- provider: GitHub fine-grained personal access token, or preferably a
  dedicated GitHub App installation token when an existing approved App can
  issue it without widening another integration;
- repository scope: only `tranhuunguyenhuy-hue/dongphugia.com.vn`;
- minimum API permission: repository `Contents: write`, because GitHub's
  repository-dispatch endpoint requires that permission; no organization,
  administration, Actions, pull-request, environment, package, or account-wide
  permission;
- storage: Supabase Edge Function secret named
  `LEO553_GITHUB_DISPATCH_TOKEN` on the exact `dongphugia-runtime` Preview
  project only;
- use: one fixed `POST /repos/tranhuunguyenhuy-hue/dongphugia.com.vn/dispatches`
  event; the endpoint accepts HTTP 204 only;
- rotation/revocation: revoke the token/App installation first, replace the
  Edge secret by a secret-safe mechanism, verify no dispatch, then issue the
  replacement and run bounded no-change/change acceptance;
- blast radius: compromise can exercise GitHub APIs allowed by `Contents:
  write` in this one repository. Branch protection remains required; this is
  why the runtime credential and enablement are an explicit Owner gate.

The existing Vault scheduler token is not copied into Edge secrets, rotated,
or exposed. It is supplied at invocation and compared inside the database.

## Future Owner mutation package

After this source PR is approved and merged, record one exact package before
any mutation:

1. Revalidate the exact Supabase project identity, Free plan, region, target
   contract, existing Vault secret name, and existing Pages project/domain
   contract.
2. Approve/create the exact GitHub credential above and configure only
   `LEO553_GITHUB_DISPATCH_TOKEN` by a secret-safe mechanism.
3. Apply the LEO-553 migration and deploy `publishing-scheduler` from the exact
   trusted main SHA; do not deploy candidate code.
4. Set `LEO553_PREVIEW_REFRESH_CONTRACT=trusted-main-fixed-preview` and only
   then set `LEO553_PREVIEW_REFRESH_ENABLED=true`.
5. Run one invalid-auth probe, one no-change invocation (zero dispatch), and
   one synthetic accepted publication change (one dispatch and refreshed
   stable noindex URL).
6. Record sanitized counts, exact trusted main SHA, workflow run, artifact
   hash, stable URL noindex checks, and rollback evidence.
7. Only after that acceptance may LEO-543 reconcile PR #127 and request its own
   separate extension/migration/scheduler activation gate.

## Disarm and rollback

Disarm in this order: set `LEO553_PREVIEW_REFRESH_ENABLED=false`, revoke the
GitHub credential, disable or remove the Edge secret, and undeploy/disable the
Edge Function. LEO-543 must remain disabled. Database rollback is a separately
reviewed migration that revokes the three public RPC grants and leaves the
append-only run/audit evidence intact; it must not delete publication rows or
ledger history.
