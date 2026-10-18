# Codex event dispatcher (proposed, inactive)

**Status:** `PROPOSED`
**Authority:** Issue #160 comment `6250663223` authorizes source-only design,
static tests, and a separate PR. It does not authorize merge, activation,
secrets, API usage, cost, infrastructure, backup access, deployment, or
Production changes.

## Recommendation

Use two adoption steps, and stop at an Owner gate between them:

1. **Pilot the native Codex GitHub integration first.** Official OpenAI
   documentation confirms that an `@codex` mention on a GitHub Issue can start
   a Codex cloud task. ChatGPT can therefore coordinate by posting the bounded
   task directly to GitHub; the Owner no longer has to copy it into Codex.
   This is the simplest path and needs no repository API key or custom runner.
   The official sources found for this design document an explicit `@codex`
   mention, not assignment by itself, as the authenticated execution trigger.
   An Issue assignment without that mention is therefore **not** a verified
   automatic trigger and must not be treated as one.
2. **Activate the GitHub Events + `openai/codex-action` dispatcher only if the
   native pilot cannot provide the required policy and evidence.** The prototype
   in this PR adds deterministic actor/ref validation, idempotency, one task per
   Issue at a time, patch-only handoff, a separate publisher identity, and a
   draft-PR-only result.

Do not deploy a persistent Codex CLI listener for this public repository. It
adds a long-lived executor, webhook/service availability, patch isolation, and
credential rotation work without improving the GitHub-hosted prototype's
ephemeral-runner boundary.

## Options and cost

| Option | Trigger and authentication | Direct cost | Main limitation | Call |
|---|---|---:|---|---|
| Native Codex GitHub integration | Authenticated GitHub connection; exact `@codex` mention on Issue/PR | Uses the Owner/workspace Codex plan, limits, or credits; exact available quota is `UNKNOWN` until checked | Official docs establish the mention trigger, but not this repository's custom admin-only schema, dedupe marker, or split publisher | **Recommended pilot** |
| GitHub Event + `openai/codex-action` | `issue_comment.created`; GitHub API verifies repository ID, actor ID + `admin` permission, and exact `main` SHA | Standard GitHub-hosted runner is free for this public repo; OpenAI API usage is billed by tokens; small one-day artifacts use storage allowance | Requires an OpenAI API key, a dedicated publisher GitHub App, repository secrets, and Owner-approved activation | **Prepared fallback** |
| Trusted executor + `codex exec` | Webhook/queue invokes CLI on an isolated maintained host | API/Codex usage plus host/operations cost | Long-lived credential and executor attack surface; availability and cleanup become Dongphugia responsibilities | **Not recommended** |

At the design date, the official API price page lists
`gpt-5.3-codex` Standard at USD 1.75 / 1M input tokens, USD 0.175 / 1M
cached input tokens, and USD 14 / 1M output tokens. This is not a per-task
quote. Model availability, project rate limits, spend limits, regional uplift,
and prices must be revalidated before activation. The prototype permits one
model attempt per accepted command and has a 45-minute job timeout; it does not
automatically retry.

## Prototype architecture

```text
trusted admin comment on Issue/PR
        |
        v
preflight job (GitHub read token only)
  - exact repo ID + default branch
  - actor ID + admin permission from GitHub API
  - exact JSON command, source-only booleans
  - protected-path denylist
  - exact current main SHA
  - deterministic branch absence (dedupe)
        |
        v
claim job (separate publisher identity)
  - atomically creates one transient lock ref per Issue
  - records RUNNING, or REJECTED_BUSY without API/model execution
  - no lossy GitHub Actions pending-run concurrency queue
        |
        v
Codex job (ephemeral hosted runner)
  - exact validated main SHA
  - contents:read; no GitHub write token
  - validated dispatch and control artifacts live outside the writable workspace
  - .git control state is read-only while the model runs
  - OpenAI key only through codex-action proxy
  - workspace-write sandbox; sudo dropped; Docker socket denied
  - produces patch + bounded final message
        |
        v
publisher job (fresh hosted runner, separate GitHub App)
  - reloads trusted policy from exact base SHA
  - checks base, file count, size, paths, binary/symlink denial
  - applies patch without running patched repository code
  - pushes deterministic task branch
  - opens DRAFT PR and comments evidence
  - never merges and never deploys
        |
        v
lock cleanup + final status (fresh jobs)
  - verifies lock SHA before deleting only the transient ref
  - records Mutation ownership: RELEASED only after successful cleanup
  - leaves HELD + a fail-closed Owner gate if cleanup fails
```

The dispatcher workflow is intentionally an `issue_comment` workflow. GitHub
only runs that event when the workflow exists on the default branch, so the
file in this unmerged PR is inert as a dispatcher. Existing PR CI may still
lint and test the source, which is the intended source-only validation.

## Trusted command schema

The event body must match exactly; arbitrary Issue body, title, earlier
comments, PR body, branch name, or hidden HTML is never sent to Codex.

````text
/codex dispatch
```json
{
  "version": 1,
  "title": "Bounded source task",
  "task": "Implement the approved source-only change and focused tests.",
  "acceptance": ["Focused tests pass", "A draft PR is opened"],
  "allowed_paths": ["apps/public/", "scripts/quality/"],
  "rollback": "Close the draft PR and delete only its task branch.",
  "mutation_owner": "HELD",
  "production": false,
  "external_writes": false
}
```
````

The command is accepted only when all of these remain true:

- repository full name and immutable repository ID match this repository;
- GitHub API returns the same actor ID and effective `admin` permission;
- event action is `created`, `GITHUB_REF` is `refs/heads/main`, and GitHub API
  confirms `GITHUB_SHA` is the current `main` ref;
- task, acceptance, and path arrays stay within fixed size limits;
- rollback position is bounded text and mutation ownership is exactly `HELD`;
- `production` and `external_writes` are exactly `false`;
- no authorized path reaches `.github/`, agent authority/workflow policy,
  dispatcher code, backup/offline-rehearsal code, `.git`, or `.artifacts`;
- the deterministic result branch does not already exist.

The workflow deliberately does not use ordinary GitHub Actions concurrency:
that mechanism keeps only one pending run and can replace an earlier pending
command. Instead, the publisher identity atomically creates
`refs/heads/codex/dispatch-lock-<issue>` at the validated base before any
OpenAI job. A competing command records `CODEX_AUTO_DISPATCH_REJECTED_BUSY` and
does not reach the model. Every terminal path verifies the lock SHA and removes
only that transient ref. A cleanup failure leaves the lock fail-closed, records
`CODEX_AUTO_DISPATCH_LOCK_RELEASE_FAILED`, and requires Owner audit before the
exact ref is removed. The draft PR and intermediate status remain `HELD` until
cleanup succeeds; only then does a separate status job record
`CODEX_AUTO_DISPATCH_RELEASED` and `Mutation ownership: RELEASED`. A completed
result branch makes re-delivery of the same comment fail closed. There is no
automatic retry.

## Trust boundaries and remaining limits

- **Untrusted events cannot incur OpenAI cost.** Preflight completes before the
  job that can read `OPENAI_API_KEY`.
- **Codex cannot publish.** Its job has `contents: read`, checkout credentials
  are not persisted, and the publisher GitHub App secret exists only in other
  jobs on fresh runners. The publisher independently downloads the immutable
  preflight dispatch artifact; it never trusts a dispatch file from the model's
  writable workspace or result artifact.
- **Publisher credentials are job-scoped.** The claim token requests only
  Contents + Issues write, the draft-PR publisher requests Contents + Issues +
  Pull requests write, and lock cleanup requests only Contents write. Status-
  only jobs use the workflow token with Issues write and never receive the App
  private key.
- **The publisher does not execute the generated change.** It validates and
  applies the patch, then relies on normal PR CI and review. The patch cannot
  add workflows, symlinks, gitlinks/submodules, binary payloads, backup changes,
  or dispatcher changes.
- **Prompt injection is reduced, not eliminated.** Only an API-authenticated
  repository admin can supply the task prompt. A compromised admin account is
  therefore still a trusted-principal compromise.
- **A draft PR is evidence, not acceptance.** Required CI, review, PM merge
  approval, candidate creation, rollout, and Production approval remain
  separate gates.
- **Logs and artifacts are not secret storage.** Tasks must not contain secret
  values or PII. Patch/final-message artifacts expire after one day.
- **No backup path is reachable.** The protected-path policy excludes PR #161's
  backup/offline-rehearsal area and this task does not touch its branch.
- GitHub API limits, OpenAI project rate limits, current model availability,
  current Codex plan quota, and repository Actions settings are `UNKNOWN` until
  the Owner revalidates them at activation.

## Owner activation gates

### Gate A — native integration pilot (preferred)

1. Connect only `tranhuunguyenhuy-hue/dongphugia.com.vn` to Codex Cloud and
   publish a repository environment with no Production, backup, or migration
   secrets. Keep network access at the minimum needed for source validation.
2. In a disposable coordination Issue, post one admin-authored `@codex` task
   restricted to a documentation-only path. Confirm the Codex reaction, linked
   cloud task, exact base, branch/PR behavior, usage accounting, and audit trail.
3. Confirm ChatGPT's GitHub connection can post the same bounded task under the
   intended human/workspace identity. Do not treat a plain comment without the
   documented `@codex` trigger as execution evidence.
4. Keep automatic merge, deployment, Production credentials, backup secrets,
   and infrastructure credentials disabled.

If Gate A meets the evidence and control needs, do not activate this custom
workflow.

### Gate B — custom dispatcher fallback

Each item needs explicit Owner approval because it changes repository or paid
control-plane state:

1. Approve and merge the exact reviewed dispatcher PR.
2. Create a dedicated OpenAI Platform project/service identity, select and pin
   an available Codex model, set a hard spend limit/alert, and add only the
   `OPENAI_API_KEY` repository secret. Never place its value in chat, Issue,
   files, logs, or outputs.
3. Create and install a dedicated GitHub App on this repository only. Grant
   repository **Contents read/write**, **Pull requests read/write**, and
   **Issues read/write**; grant no Administration, Actions, Environments,
   Secrets, Deployments, or organization permission. Add its App ID and private
   key as `CODEX_PUBLISHER_APP_ID` and
   `CODEX_PUBLISHER_APP_PRIVATE_KEY` secrets.
4. Review repository Actions policy so only the exact pinned action SHAs in the
   workflow are allowed. Keep default `GITHUB_TOKEN` read-only. Revalidate every
   pin and the chosen model before merge/activation.
5. Confirm branch protection still requires the repository's normal CI and PM
   approval, and that the publisher App has no bypass permission.

## Safe dry-run acceptance

After Gate B is separately approved and completed, use a new disposable Issue
and a documentation-only command whose sole allowed path is a new file under
`docs/agents/`.

Acceptance evidence:

1. A public non-collaborator comment, near-match command, edited comment,
   `production: true`, protected path, wrong repository/ref, or spoofed username
   fails in preflight before the OpenAI job.
2. One valid admin comment records `CODEX_AUTO_DISPATCH_RUNNING`, runs once at
   the GitHub-verified `main` SHA, and creates at most one deterministic branch.
3. Codex cannot push, comment, create a PR, use sudo/Docker, or read publisher
   credentials.
4. An out-of-scope, binary, symlink, gitlink/submodule, oversized, duplicate,
   or base-mismatched patch fails before push.
5. A valid text patch produces one draft PR, a completion comment, a run link,
   exact base SHA, ordinary required CI, a final `RELEASED` status only after
   verified lock cleanup, and no merge/deploy/Production action.
6. Two concurrent commands on one Issue produce one atomic lock winner and one
   explicit `REJECTED_BUSY` result; neither task is silently replaced in a
   pending queue. Re-delivery of a completed comment fails closed because the
   deterministic branch already exists. Failure has no automatic retry or event
   loop.
7. Logs and one-day artifacts contain no credential, secret value, PII, or
   Production data.

## Rollback and shutdown

Before any Production connection exists, shutdown is source/control-plane only:
disable the workflow, revoke the OpenAI key, uninstall or suspend the publisher
GitHub App, remove the three repository secrets, and close any generated draft
PRs after review. Verify and remove only any stale
`codex/dispatch-lock-<issue>` ref after checking its run and exact SHA. Removing
the workflow still requires a normal reviewed PR; emergency credential
revocation does not.

## Primary references

- [OpenAI: Codex GitHub Action](https://learn.chatgpt.com/docs/github-action)
- [OpenAI: non-interactive Codex mode](https://learn.chatgpt.com/docs/non-interactive-mode)
- [OpenAI changelog: `@codex` on GitHub Issues](https://learn.chatgpt.com/docs/changelog#october-2025)
- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- [GitHub: `issue_comment` workflow event](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#issue_comment)
- [GitHub: repository permission API](https://docs.github.com/en/rest/collaborators/collaborators#get-repository-permissions-for-a-user)
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub Actions billing and public-runner cost](https://docs.github.com/en/actions/concepts/billing-and-usage)
