#!/usr/bin/env bash
set -euo pipefail

: "${1:?candidate commit SHA is required}"
: "${2:?candidate source directory is required}"

candidate_sha="$1"
destination="$2"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ ! "$candidate_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo 'LEO552_CANDIDATE_SOURCE status=FAIL reason=invalid_candidate_sha'
  exit 1
fi
git -C "$repo_root" cat-file -e "$candidate_sha^{commit}" 2>/dev/null

rm -rf "$destination"
mkdir -p "$destination"
candidate_paths=(
  scripts/backup/create-encrypted-backup.sh
  scripts/backup/rehearse-isolated-restore.sh
  scripts/backup/runtime-manifest.sql
  scripts/backup/validate-runtime.sql
  scripts/backup/manifest-contract.mjs
  scripts/backup/runtime-validation-contract.mjs
)
archive_paths=()
for path in "${candidate_paths[@]}"; do
  if git -C "$repo_root" cat-file -e "$candidate_sha:$path" 2>/dev/null; then
    archive_paths+=("$path")
  fi
done
test "${#archive_paths[@]}" -ge 5
git -C "$repo_root" archive --format=tar "$candidate_sha" -- "${archive_paths[@]}" | tar -x -C "$destination"

while IFS= read -r file; do
  case "$file" in
    "$destination/scripts/backup/create-encrypted-backup.sh"|\
    "$destination/scripts/backup/rehearse-isolated-restore.sh"|\
    "$destination/scripts/backup/runtime-manifest.sql"|\
    "$destination/scripts/backup/validate-runtime.sql"|\
    "$destination/scripts/backup/manifest-contract.mjs"|\
    "$destination/scripts/backup/runtime-validation-contract.mjs") ;;
    *)
      echo 'LEO552_CANDIDATE_SOURCE status=FAIL reason=unexpected_candidate_file'
      exit 1
      ;;
  esac
done < <(find "$destination" -type f -print)

for required in \
  scripts/backup/create-encrypted-backup.sh \
  scripts/backup/rehearse-isolated-restore.sh \
  scripts/backup/runtime-manifest.sql \
  scripts/backup/validate-runtime.sql \
  scripts/backup/manifest-contract.mjs; do
  test -f "$destination/$required"
done

test ! -e "$destination/.github/workflows"
echo 'LEO552_CANDIDATE_SOURCE status=PASS allowlist=backup-restore-contract-only workflow_yaml=not_loaded'
