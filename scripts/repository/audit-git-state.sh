#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

printf '%s\n' '# Repository status'
git status --short --branch

printf '\n%s\n' '# Worktrees'
git worktree list --porcelain

printf '\n%s\n' '# Local and origin branches'
git for-each-ref \
  --sort=-committerdate \
  --format='%(refname:short)|%(objectname)|%(upstream:short)|%(upstream:track)|%(committerdate:iso8601)|%(subject)' \
  refs/heads refs/remotes/origin

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  printf '\n%s\n' '# Pull requests'
  gh pr list --state all --limit 100 \
    --json number,state,title,headRefName,baseRefName,mergedAt,closedAt,url
fi
