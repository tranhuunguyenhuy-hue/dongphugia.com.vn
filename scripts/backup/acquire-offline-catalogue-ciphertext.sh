#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "OFFLINE_CATALOGUE_ACQUISITION status=FAIL reason=$1" >&2
  exit 1
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
contract="$repo_root/scripts/backup/offline-catalogue-transfer-contract.mjs"
expected_main_sha="${EXPECTED_MAIN_SHA:-}"
output_dir="${1:-}"

[[ "$expected_main_sha" =~ ^[a-f0-9]{40}$ ]] || fail expected_main_sha_required
[[ -n "$output_dir" && "$output_dir" = /* ]] || fail absolute_new_output_directory_required
[[ -n "${GH_TOKEN:-}" ]] || fail read_only_gh_token_required

repo='tranhuunguyenhuy-hue/dongphugia.com.vn'
remote_url="$(git -C "$repo_root" remote get-url origin 2>/dev/null || true)"
case "$remote_url" in
  https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn.git|https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn|git@github.com:tranhuunguyenhuy-hue/dongphugia.com.vn.git) ;;
  *) fail canonical_repository_required ;;
esac
[[ "$(git -C "$repo_root" symbolic-ref --short HEAD 2>/dev/null || true)" = 'main' ]] || fail trusted_main_ref_required
[[ "$(git -C "$repo_root" rev-parse HEAD)" = "$expected_main_sha" ]] || fail trusted_main_sha_mismatch
[[ -z "$(git -C "$repo_root" status --porcelain --untracked-files=all)" ]] || fail clean_trusted_checkout_required

for command in gh node jq unzip; do
  command -v "$command" >/dev/null 2>&1 || fail "missing_${command}"
done

output_parent="$(dirname "$output_dir")"
[[ -d "$output_parent" && ! -L "$output_parent" ]] || fail output_parent_missing_or_symlink
[[ ! -e "$output_dir" && ! -L "$output_dir" ]] || fail output_directory_already_exists
case "$output_dir/" in "$repo_root/"*) fail output_must_be_outside_repository ;; esac

umask 077
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/dpg-ciphertext-acquisition.XXXXXXXX")"
output_created='false'
cleanup() {
  rm -rf -- "$tmp_dir"
  if [[ "$output_created" = 'true' ]]; then
    rm -f -- "$output_dir/artifact-12052107648.zip" "$output_dir/provenance.json"
    rmdir -- "$output_dir" 2>/dev/null || true
  fi
}
trap cleanup EXIT

identity="$(node "$contract" pinned-json)"
run_id="$(jq -r '.runId' <<<"$identity")"
artifact_id="$(jq -r '.artifactId' <<<"$identity")"
artifact_digest="$(jq -r '.artifactDigest' <<<"$identity")"
artifact_bytes="$(jq -r '.artifactSizeBytes' <<<"$identity")"
backup_id="$(jq -r '.backupId' <<<"$identity")"

gh api "repos/$repo/actions/runs/$run_id" >"$tmp_dir/run.json" || fail github_run_metadata_unavailable
gh api "repos/$repo/actions/artifacts/$artifact_id" >"$tmp_dir/artifact.json" || fail github_artifact_metadata_unavailable
date_now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
node "$contract" validate-metadata "$tmp_dir/run.json" "$tmp_dir/artifact.json" "$date_now" \
  >"$tmp_dir/verified-metadata.json" || fail pinned_artifact_provenance_mismatch

gh api "repos/$repo/actions/artifacts/$artifact_id/zip" --output "$tmp_dir/artifact.zip" \
  || fail exact_artifact_download_failed
actual_bytes="$(wc -c <"$tmp_dir/artifact.zip" | tr -d ' ')"
[[ "$actual_bytes" = "$artifact_bytes" ]] || fail artifact_package_size_mismatch
if command -v sha256sum >/dev/null 2>&1; then
  actual_digest="$(sha256sum "$tmp_dir/artifact.zip" | awk '{print $1}')"
else
  actual_digest="$(shasum -a 256 "$tmp_dir/artifact.zip" | awk '{print $1}')"
fi
[[ "sha256:$actual_digest" = "$artifact_digest" ]] || fail artifact_package_digest_mismatch
node "$contract" verify-package "$actual_digest" "$actual_bytes" >/dev/null \
  || fail artifact_package_identity_mismatch

unzip -Z1 "$tmp_dir/artifact.zip" >"$tmp_dir/archive-members.txt" || fail artifact_package_invalid
node "$contract" validate-archive-members "$tmp_dir/archive-members.txt" \
  >"$tmp_dir/verified-members.json" || fail artifact_package_members_invalid

for suffix in dump.age manifest.json checksums.sha256; do
  member="$backup_id.$suffix"
  unzip -p "$tmp_dir/artifact.zip" "$member" >"$tmp_dir/$member" || fail artifact_member_extract_failed
done
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$tmp_dir" && sha256sum -c "$backup_id.checksums.sha256" >/dev/null 2>&1) \
    || fail encrypted_bundle_checksum_mismatch
else
  (cd "$tmp_dir" && shasum -a 256 -c "$backup_id.checksums.sha256" >/dev/null 2>&1) \
    || fail encrypted_bundle_checksum_mismatch
fi
node "$repo_root/scripts/backup/manifest-contract.mjs" validate "$tmp_dir/$backup_id.manifest.json" \
  >/dev/null 2>&1 || fail encrypted_bundle_manifest_invalid
node "$repo_root/scripts/backup/catalogue-restore-contract.mjs" validate-source \
  "$tmp_dir/$backup_id.manifest.json" \
  "$(jq -r '.prNumber' <<<"$identity")" \
  "$(jq -r '.candidateSha' <<<"$identity")" \
  "$(jq -r '.controlSha' <<<"$identity")" \
  "$run_id" "$(jq -r '.mergeSha' <<<"$identity")" >/dev/null 2>&1 \
  || fail encrypted_bundle_source_identity_invalid

mkdir -m 700 -- "$output_dir" || fail output_directory_creation_failed
output_created='true'
cp -- "$tmp_dir/artifact.zip" "$output_dir/artifact-12052107648.zip" || fail ciphertext_copy_failed
node "$contract" create-provenance "$tmp_dir/verified-metadata.json" "$actual_digest" "$date_now" \
  "$expected_main_sha" "$output_dir/provenance.json" >/dev/null || fail sanitized_provenance_creation_failed
output_created='false'
printf 'OFFLINE_CATALOGUE_ACQUISITION status=PASS artifact_id=%s package_sha256=%s bytes=%s output=ciphertext_only\n' \
  "$artifact_id" "$actual_digest" "$actual_bytes"
