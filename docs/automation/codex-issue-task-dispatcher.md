# Codex Issue task dispatcher: research and dry-run prototype

## Decision

The repository's current Codex connection is user-authorized and interactive; an
Issue comment or assignment is not documented as a trigger for an existing
Codex coding task. OpenAI's current Work event-trigger documentation supports
selected GitHub pull-request activity, but does not list issue assignment or
Issue #160 task dispatch. It is a plausible zero-new-secret option for PR
monitoring only, not a verified replacement for a source-code task dispatcher.

For Issue #160, the simplest verifiable eventual design is a GitHub Actions
event that validates a narrowly scoped Owner approval, then invokes the official
`openai/codex-action` on a fresh GitHub-hosted runner. The Codex job must have
workspace-only sandboxing and read-only GitHub access; a separate publisher
job would be the only component allowed to create a branch/PR. No merge is ever
automatic. The action requires an OpenAI API credential; this PR does not
create/configure one or call the action. Its exact usage cost depends on model
and task tokens, and GitHub Actions minutes are subject to the account's current
plan/quota. Both are UNKNOWN here.

This PR implements only a safe dry-run validator. Its workflow is not on
`main`, does not invoke Codex, has no API key reference, does not write GitHub,
and has no PR/fork/comment trigger. It is not active until Owner separately
approves merge and later setup.

## Options

| Option                                                                          | Trigger and fit                                                                                                                                                                                                                                                         | Authentication, cost and setup                                                                                                                                                                                                                                                                             | Trust / limits                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing ChatGPT Work/Codex integration                                         | Work supports eligible webhook-triggered tasks for selected GitHub PR activity (e.g. PR opened/reviews/comments/updates/merge). Official docs do not document Issue assignment as a trigger or a webhook that automatically creates a Codex coding task for Issue #160. | Uses connected-app permissions and eligible ChatGPT plan/workspace features; no API key required for that Work path. Setup is in Work UI, not a repo PR. Plan/feature availability must be checked in Owner's account.                                                                                     | Good for PR monitoring/task prompting; not verified for owner-approved Issue #160 dispatch or controlled source PR publishing. A GitHub comment by itself should not be assumed to start Codex.                                                                                                           |
| GitHub Actions + official `openai/codex-action` (**recommended eventual path**) | Exact issue-label event, only Issue #160; validator verifies actor's repository permission through GitHub REST.                                                                                                                                                         | GitHub-hosted ephemeral runner; pinned action/CLI; action currently documents an OpenAI API key as input. API usage is metered; GitHub minutes/quota depend on plan. Initial setup ~1–3 hours is an assumption for environment review, secrets/variables and tests.                                        | Strong event auditability and no spare runner; public issue text must remain untrusted input. API key and write token must be separated from Codex workspace; no `pull_request_target`, fork code, or secret on PR paths. A controlled publisher must review/test an exact patch before branch/PR writes. |
| Codex CLI on a trusted dispatcher/executor                                      | GitHub App webhook or broker would receive approved event, validate it, enqueue work, and dispatch to a dedicated executor. This is more flexible but not a built-in GitHub issue trigger.                                                                              | Requires a continuously available trusted ingress/queue/executor, GitHub App credentials and an OpenAI authentication method. A headless API path is metered; using interactive ChatGPT sign-in unattended is not assumed supported. Setup and operating cost are materially higher and currently unknown. | More infrastructure and credential surface; secure sandbox, queue durability, webhook signature checks, retries, single-use workspaces and safe publisher are owner-operated. Not the simplest option for this repo.                                                                                      |

**Recommendation:** keep the Work event integration for eligible PR follow-up if
the Owner's plan exposes it; for actual Issue #160 source tasks, use GitHub
Actions only after Owner accepts API billing/credential setup and the separate
publisher/security design. The CLI dispatcher is not justified unless Actions
cannot meet an identified requirement.

## Prototype contract (public seam under test)

`evaluateTaskEvent({eventName, event, context})` is a pure decision seam. It
accepts only all of the following: repository exactly
`tranhuunguyenhuy-hue/dongphugia.com.vn`, Issue 160 still open and not a PR,
`issues:labeled` for `codex:dispatch-approved`, workflow ref exactly this file
on `main`, and actor permission exactly `admin` as returned by the GitHub
collaborator-permission endpoint. The label itself is not a security boundary;
the API role check is. It does not parse or copy issue/comment text
into a prompt. It returns a deterministic hash task key and rejects a key
already in the supplied processed-ID set. The API identity is the authenticated
event sender resolved by GitHub REST, never a text allowlist.

The workflow in this PR invokes only that validator, with `contents:read` and
`issues:read`, a five-minute timeout, one concurrency group per Issue, and a
sanitized Actions summary. It intentionally has no durable ledger or publisher;
the processed-ID input is a testable seam, not yet durable deduplication across
separate GitHub event runs. Before enabling execution, a publisher must persist
the task key/status (for example as a restricted GitHub Check run), atomically
claim one active task per Issue, and make reruns/re-deliveries idempotent. Never
infer that concurrency alone is durable deduplication.

## Required execution/publisher design before activation

1. Event gate: fixed repository/Issue/label/workflow/ref; authenticated REST
   permission check must resolve to admin. Reject missing permissions, API
   errors, closed Issue, pull request payloads, wrong labels, non-default ref,
   and unsupported event names. Do not run from issue/PR body, comment, branch,
   or fork code. A label is only a request signal, not authority by itself.
2. State: a separate publisher first creates a durable task record with the
   stable key, state `accepted`, then atomically transitions
   `accepted → running → succeeded|failed|rejected`; one active task per Issue.
   Duplicate keys return the existing state without another model call. Keep a
   bounded attempt counter (maximum two retries for transient network/5xx/429,
   capped backoff); never retry authorization/policy failures. Current prototype
   does not implement persistence/retries.
3. Codex boundary: a fresh GitHub-hosted runner, no self-hosted runner, no sudo,
   Docker socket, cloud credentials, Supabase/backup context or persisted Git
   credential. Pin Actions to full commit SHAs and Codex CLI to a reviewed
   exact version. Use workspace-only sandbox; limit runtime (suggested 20 min)
   and process/resources. Prompt only the validated Owner-authored directive;
   all other issue/PR content is untrusted data. Keep the OpenAI credential in
   the action's protected secret/proxy path, never in files, output, env passed
   to the workspace, or artifacts.
4. Publisher boundary: separate job, starts only after Codex output is
   sanitized and reviewed/tested; receive only a patch artifact and task key,
   not the OpenAI credential. Re-check repository, base `main` SHA and allowed
   paths; use a distinct short-lived least-privilege GitHub App token restricted
   to repository contents + PR creation. Create one task branch/PR; never push
   to `main`, merge, deploy, or access production. If safe token isolation or
   GitHub App setup is unavailable, stop without publishing.
5. Evidence: persist task key, source issue/event/run IDs, exact base/head SHAs,
   actor permission result, model/action version, attempt count, test result,
   output PR URL and state transitions; redact directive payloads, secrets and
   arbitrary issue/comment text. Keep logs/summary bounded and sanitized.

## Dry-run acceptance and Owner setup gates

This PR must not be manually dispatched or tested by adding the label. Static
tests must prove: exact owner/repository/issue/ref/label policy; role lookup via
REST; rejection of comments, PR/fork contexts, non-admin actors, duplicates,
wrong ref and closed issue; no issue body in result; no API key, write token,
Codex action or PR trigger in the dry-run workflow; bounded concurrency and
timeout.

After PR review and merge (separate Owner approval), a safe operational dry run
would require the Owner to add the exact label to Issue #160 once. It must only
produce a sanitized validator result and no model call. Then Owner reviews the
run/permissions, tests rejected actors using a non-owner account, verifies one
task state record per event and duplicate suppression, and removes the label.
No such event is being dispatched in this source task.

To enable real execution later, the Owner must explicitly:

1. Decide whether to use Work PR triggers or approve the GitHub Actions/API
   billing path. Work's Issue-assignment trigger remains unsupported by current
   published documentation.
2. Review/approve the separate publisher design and exact GitHub App/token
   permissions; keep it disabled until its trust-boundary tests pass.
3. If choosing `codex-action`, configure an OpenAI API project/key with a usage
   limit and add it as an Actions secret (the exact secret name is a later
   design decision). This is a new credential and can incur API charges. Do not
   expose it to the Codex-visible workspace. WIF exists for OpenAI API
   authentication, but `codex-action` compatibility with short-lived WIF access
   tokens is not documented here and must not be assumed.
4. Review GitHub Actions permission settings and create/use the approval label
   (GitHub does not protect a label by itself; API role validation is the
   control),
   then approve a one-event dry run. Only after reviewing its sanitized evidence
   decide whether to separately enable model execution.

## Source references

- OpenAI Help: [ChatGPT Work and Codex — event-triggered Work tasks](https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex)
- OpenAI Help: [Connect GitHub to ChatGPT — PR-activity triggers](https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt-deep-research)
- OpenAI official action: [openai/codex-action at reviewed commit `a8d8be6`](https://github.com/openai/codex-action/tree/a8d8be6ee028bea4525bc722d16f36687b408c81) (requires API key; pin commit, not `@v1`)
- OpenAI: [GitHub Actions workload identity federation](https://developers.openai.com/api/docs/guides/workload-identity-federation/github-actions) (does not establish codex-action WIF compatibility)
- GitHub REST: [Get repository permissions for a user](https://docs.github.com/en/rest/collaborators/collaborators#get-repository-permissions-for-a-user) (fine-grained token needs Metadata read)
- GitHub: [workflow token permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) and [secure use](https://docs.github.com/en/actions/reference/security/secure-use)
