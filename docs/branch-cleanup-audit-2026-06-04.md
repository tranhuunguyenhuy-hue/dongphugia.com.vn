# Branch Cleanup Audit — 2026-06-04

## Summary

- `main` is the only canonical branch and current production source.
- `refactor-product-detail-ui` remains intentionally untouched because its worktree contains uncommitted PDP refactor work.
- The remaining legacy branches were reviewed before cleanup to determine whether they still contain anything missing from `main`.

## Review Results

### `fix/p0-quick-wins`

Classification:

- Already present in `main`: the useful P0 fixes from commit `88feb89`
  - cleaned metadata titles to avoid duplicated `| Đông Phú Gia`
  - contact page map embed update
  - app-level `not-found.tsx`
- Minor wording / metadata polish: page title text normalization across public pages
- Missing behavior worth importing: none found during review

Decision:

- Safe to archive and delete after tagging because its intent has already been incorporated into `main` through later commits.

### `fix-p0-quick-wins` and `fix-search-crash`

Classification:

- Both local branches point to the same historical commit `d87bfe8`.
- They do not represent clean, ready-to-merge work and were superseded by later changes already on `main`.

Decision:

- Preserve via backup tag, then delete local branch names to reduce confusion.

### `refactor-project-folder-cleanup`

Classification:

- Large historical cleanup branch with wide repo churn.
- Not suitable for direct merge because the scope is too broad and overlaps with many later changes.
- No urgent single change was identified as worth extracting in this cleanup pass.

Decision:

- Preserve via backup tag only.
- Delete the branch reference after tagging.

### `optimize-pdp`

Classification:

- Production baseline was already unified into `main`.
- Remote branch was previously removed.
- Local worktree only held local helper files:
  - `.codex/config.toml`
  - `AGENTS.md` placeholder redirecting to `docs/AGENTS.md`

Decision:

- Move local helper files to an external backup location.
- Remove the obsolete worktree and local branch.

## Remaining Intentionally Kept

- `main`
- `refactor-product-detail-ui`

## Acceptance Snapshot

- Cleanup should end with `origin/main` as the only required remote branch.
- No worktree with uncommitted changes is removed.
- Deleted legacy branches are recoverable through backup tags.
