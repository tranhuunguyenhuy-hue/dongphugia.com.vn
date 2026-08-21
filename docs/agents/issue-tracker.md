# Issue tracker: GitHub

Engineering issues and specs for this repository live only in GitHub Issues.
Use the `gh` CLI from the canonical checkout so it infers
`tranhuunguyenhuy-hue/dongphugia.com.vn` from the remote.

Issue creation thresholds live in `docs/WORKFLOW-WITH-CODEX.md`. Do not create
an Issue merely because a task exists: clear one-session FAST_PATH work needs
none. When a spec is needed, keep it bounded to outcome, acceptance, scope,
risk, validation, and next authorized action.

## Conventions

- **Create:** `gh issue create --title "..." --body-file <path>`.
- **Read:** `gh issue view <number> --comments` and include labels.
- **List:** `gh issue list --state open --json number,title,body,labels,comments`.
- **Comment:** `gh issue comment <number> --body-file <path>`.
- **Close:** `gh issue close <number> --comment "..."`.

Use a safe temporary file for a multiline body when needed and remove it after
the command completes. Never expose credentials, tokens, environment values, or
PII in issue content or command output.

## Skill adapter

- When a skill says **publish to the issue tracker**, create a GitHub Issue.
- When a skill says **fetch the relevant ticket**, read the full GitHub Issue and
  its comments.
- This repository does not install `triage` and does not use triage roles or a
  `ready-for-agent` label. Omit that label when upstream skill text requests it.
- Do not copy or synchronize task state to another tracker.
