#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "OFFLINE_REPLAY status=FAIL reason=$1" >&2
  exit 1
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
contract="$repo_root/scripts/backup/offline-catalogue-transfer-contract.mjs"
postgres_image='postgres:17.6-bookworm@sha256:45cd22f8d32e189d245403954882f88e7a8714301fda80dab6da90f1265b25a3'

if [[ "${1:-}" = 'prepare-attestation' ]]; then
  [[ -n "${OFFLINE_EGRESS_POLICY_SHA256:-}" && "$OFFLINE_EGRESS_POLICY_SHA256" =~ ^[a-f0-9]{64}$ ]] \
    || fail offline_egress_policy_digest_required
  [[ -r /etc/machine-id && -r /proc/sys/kernel/random/boot_id ]] || fail linux_host_identity_unavailable
  host_id="$(sha256sum /etc/machine-id | awk '{print $1}')"
  boot_id="$(</proc/sys/kernel/random/boot_id)"
  node --input-type=module - "$host_id" "$boot_id" "$OFFLINE_EGRESS_POLICY_SHA256" <<'NODE'
import { randomBytes } from 'node:crypto'
const [hostId, bootId, policySha256] = process.argv.slice(2)
process.stdout.write(`${JSON.stringify({
  format: 'dpg-offline-egress-challenge-v1',
  challenge: randomBytes(32).toString('hex'),
  hostId,
  bootId,
  policySha256,
})}\n`)
NODE
  exit 0
fi

mode="${1:-}"
[[ ( "$mode" = 'verify' || "$mode" = 'rehearse' ) && "$#" = '1' ]] || fail usage_invalid

while IFS= read -r blocked_name; do
  case "$blocked_name" in
    GITHUB_*|RUNNER_*|ACTIONS_*) fail github_runner_context_detected ;;
    GH_TOKEN|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|http_proxy|https_proxy|all_proxy) fail github_or_proxy_context_detected ;;
    AWS_*|SUPABASE_*|CLOUDFLARE_*) fail cloud_credential_context_detected ;;
    AGE_IDENTITY|BACKUP_AGE_PRIVATE_KEY|AGE_PRIVATE_KEY|DATABASE_URL|PGPASSWORD|PGPASSFILE) \
      fail secret_environment_forbidden ;;
  esac
done < <(compgen -e)

: "${EXPECTED_MAIN_SHA:?EXPECTED_MAIN_SHA is required}"
: "${OFFLINE_BUNDLE_DIR:?OFFLINE_BUNDLE_DIR is required}"
: "${OFFLINE_ATTESTATION_FILE:?OFFLINE_ATTESTATION_FILE is required}"
: "${OFFLINE_ATTESTATION_SIGNATURE_FILE:?OFFLINE_ATTESTATION_SIGNATURE_FILE is required}"
: "${OFFLINE_ATTESTATION_PUBLIC_KEY_FILE:?OFFLINE_ATTESTATION_PUBLIC_KEY_FILE is required}"
: "${OFFLINE_ATTESTATION_KEY_SHA256:?OFFLINE_ATTESTATION_KEY_SHA256 is required}"
: "${OFFLINE_EGRESS_POLICY_SHA256:?OFFLINE_EGRESS_POLICY_SHA256 is required}"
: "${OFFLINE_CHALLENGE:?OFFLINE_CHALLENGE is required}"
: "${OFFLINE_OPERATOR_ID:?OFFLINE_OPERATOR_ID is required}"
: "${MIN_TMPFS_BYTES:?MIN_TMPFS_BYTES is required}"
[[ -f "$OFFLINE_ATTESTATION_FILE" && ! -L "$OFFLINE_ATTESTATION_FILE" ]] || fail attestation_file_invalid
[[ -f "$OFFLINE_ATTESTATION_SIGNATURE_FILE" && ! -L "$OFFLINE_ATTESTATION_SIGNATURE_FILE" ]] \
  || fail attestation_signature_file_invalid
[[ -f "$OFFLINE_ATTESTATION_PUBLIC_KEY_FILE" && ! -L "$OFFLINE_ATTESTATION_PUBLIC_KEY_FILE" ]] \
  || fail attestation_public_key_file_invalid

[[ "$EXPECTED_MAIN_SHA" =~ ^[a-f0-9]{40}$ ]] || fail expected_main_sha_invalid
[[ "$MIN_TMPFS_BYTES" =~ ^[1-9][0-9]*$ ]] || fail tmpfs_capacity_requirement_missing
[[ "$OFFLINE_ATTESTATION_KEY_SHA256" =~ ^[a-f0-9]{64}$ ]] || fail attestation_key_pin_invalid
[[ "$OFFLINE_EGRESS_POLICY_SHA256" =~ ^[a-f0-9]{64}$ ]] || fail egress_policy_pin_invalid
remote_url="$(git -C "$repo_root" remote get-url origin 2>/dev/null || true)"
case "$remote_url" in
  https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn.git|https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn|git@github.com:tranhuunguyenhuy-hue/dongphugia.com.vn.git) ;;
  *) fail canonical_repository_required ;;
esac
[[ "$(git -C "$repo_root" symbolic-ref --short HEAD 2>/dev/null || true)" = 'main' ]] || fail trusted_main_ref_required
[[ "$(git -C "$repo_root" rev-parse HEAD)" = "$EXPECTED_MAIN_SHA" ]] || fail trusted_main_sha_mismatch
[[ -z "$(git -C "$repo_root" status --porcelain --untracked-files=all)" ]] || fail clean_trusted_checkout_required

for command in age docker findmnt jq node sha256sum unzip; do
  command -v "$command" >/dev/null 2>&1 || fail "missing_${command}"
done
[[ -d "$OFFLINE_BUNDLE_DIR" && ! -L "$OFFLINE_BUNDLE_DIR" ]] || fail transfer_directory_invalid
[[ -f "$OFFLINE_BUNDLE_DIR/artifact-12052107648.zip" && ! -L "$OFFLINE_BUNDLE_DIR/artifact-12052107648.zip" ]] \
  || fail encrypted_package_missing
[[ -f "$OFFLINE_BUNDLE_DIR/provenance.json" && ! -L "$OFFLINE_BUNDLE_DIR/provenance.json" ]] \
  || fail transfer_provenance_missing
tmpfs_type="$(findmnt --noheadings --output FSTYPE --target /dev/shm | xargs)"
available_tmpfs_bytes="$(df --output=avail -B1 /dev/shm | tail -n 1 | tr -d ' ')"
node "$contract" validate-tmpfs "$tmpfs_type" "$available_tmpfs_bytes" "$MIN_TMPFS_BYTES" \
  >/dev/null || fail tmpfs_capacity_or_filesystem_invalid

[[ -r /etc/machine-id && -r /proc/sys/kernel/random/boot_id ]] || fail linux_host_identity_unavailable
current_host_id="$(sha256sum /etc/machine-id | awk '{print $1}')"
current_boot_id="$(</proc/sys/kernel/random/boot_id)"
node "$contract" verify-attestation \
  "$OFFLINE_ATTESTATION_FILE" "$OFFLINE_ATTESTATION_SIGNATURE_FILE" \
  "$OFFLINE_ATTESTATION_PUBLIC_KEY_FILE" "$OFFLINE_ATTESTATION_KEY_SHA256" \
  "$OFFLINE_EGRESS_POLICY_SHA256" "$OFFLINE_CHALLENGE" \
  "$current_host_id" "$current_boot_id" "$OFFLINE_OPERATOR_ID" >/dev/null \
  || fail independent_external_egress_attestation_invalid

identity="$(node "$contract" pinned-json)"
run_id="$(jq -r '.runId' <<<"$identity")"
artifact_id="$(jq -r '.artifactId' <<<"$identity")"
backup_id="$(jq -r '.backupId' <<<"$identity")"
expected_digest="$(jq -r '.artifactDigest | sub("^sha256:"; "")' <<<"$identity")"
actual_size="$(wc -c <"$OFFLINE_BUNDLE_DIR/artifact-12052107648.zip" | tr -d ' ')"
expected_size="$(jq -r '.artifactSizeBytes' <<<"$identity")"
[[ "$actual_size" = "$expected_size" ]] || fail transferred_package_size_mismatch
actual_digest="$(sha256sum "$OFFLINE_BUNDLE_DIR/artifact-12052107648.zip" | awk '{print $1}')"
[[ "$actual_digest" = "$expected_digest" ]] || fail transferred_package_digest_mismatch
node "$contract" verify-package "$actual_digest" "$actual_size" >/dev/null \
  || fail transferred_package_identity_mismatch
node "$contract" validate-provenance "$OFFLINE_BUNDLE_DIR/provenance.json" \
  "$actual_digest" "$EXPECTED_MAIN_SHA" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  >/dev/null || fail transfer_chain_of_custody_invalid

tmp_dir="$(mktemp -d /dev/shm/dpg-offline-catalogue.XXXXXXXX)"
evidence_created='false'
cleanup() {
  rm -rf -- "$tmp_dir"
  if [[ "$evidence_created" = 'true' ]]; then
    rm -f -- "$OFFLINE_EVIDENCE_DIR/sanitized-summary.json"
    rmdir -- "$OFFLINE_EVIDENCE_DIR" 2>/dev/null || true
  fi
}
trap cleanup EXIT
mkdir -m 700 "$tmp_dir/bundle" "$tmp_dir/evidence"
cp -- "$OFFLINE_BUNDLE_DIR/artifact-12052107648.zip" "$tmp_dir/artifact.zip" || fail ciphertext_stage_failed
unzip -Z1 "$tmp_dir/artifact.zip" >"$tmp_dir/archive-members.txt" || fail encrypted_package_invalid
node "$contract" validate-archive-members "$tmp_dir/archive-members.txt" >/dev/null \
  || fail encrypted_package_members_invalid
for suffix in dump.age manifest.json checksums.sha256; do
  member="$backup_id.$suffix"
  unzip -p "$tmp_dir/artifact.zip" "$member" >"$tmp_dir/bundle/$member" \
    || fail encrypted_member_stage_failed
done
(cd "$tmp_dir/bundle" && sha256sum -c "$backup_id.checksums.sha256" >/dev/null 2>&1) \
  || fail encrypted_bundle_checksum_mismatch
node "$repo_root/scripts/backup/manifest-contract.mjs" validate "$tmp_dir/bundle/$backup_id.manifest.json" \
  >/dev/null 2>&1 || fail backup_manifest_invalid
node "$repo_root/scripts/backup/catalogue-restore-contract.mjs" validate-source \
  "$tmp_dir/bundle/$backup_id.manifest.json" \
  "$(jq -r '.prNumber' <<<"$identity")" \
  "$(jq -r '.candidateSha' <<<"$identity")" \
  "$(jq -r '.controlSha' <<<"$identity")" "$run_id" \
  "$(jq -r '.mergeSha' <<<"$identity")" >/dev/null 2>&1 \
  || fail backup_source_identity_invalid

docker image inspect "$postgres_image" >/dev/null 2>&1 || fail pinned_postgres_image_not_preloaded

if [[ "$mode" = 'verify' ]]; then
  echo "OFFLINE_REPLAY_PREFLIGHT status=PASS artifact_id=$artifact_id tmpfs=verified attestation=verified"
  exit 0
fi

: "${AGE_IDENTITY_FILE:?AGE_IDENTITY_FILE is required after successful verify mode}"
: "${OFFLINE_EVIDENCE_DIR:?OFFLINE_EVIDENCE_DIR is required}"
[[ -f "$AGE_IDENTITY_FILE" && ! -L "$AGE_IDENTITY_FILE" && "$AGE_IDENTITY_FILE" = /dev/shm/* ]] \
  || fail age_identity_must_be_operator_staged_on_tmpfs
identity_mode="$(stat -c '%a' "$AGE_IDENTITY_FILE")"
(( (8#$identity_mode & 077) == 0 )) || fail age_identity_permissions_too_open
[[ -s "$AGE_IDENTITY_FILE" ]] || fail age_identity_empty
output_parent="$(dirname "$OFFLINE_EVIDENCE_DIR")"
[[ "$OFFLINE_EVIDENCE_DIR" = /* && -d "$output_parent" && ! -L "$output_parent" ]] \
  || fail evidence_parent_invalid
case "$OFFLINE_EVIDENCE_DIR/" in "$repo_root/"*) fail evidence_must_be_outside_repository ;; esac
[[ ! -e "$OFFLINE_EVIDENCE_DIR" && ! -L "$OFFLINE_EVIDENCE_DIR" ]] || fail evidence_directory_already_exists

MODE=rehearsal \
  BACKUP_DIR="$tmp_dir/bundle" \
  OUTPUT_DIR="$tmp_dir/evidence" \
  EXPECTED_PR_NUMBER="$(jq -r '.prNumber' <<<"$identity")" \
  EXPECTED_CANDIDATE_SHA="$(jq -r '.candidateSha' <<<"$identity")" \
  EXPECTED_CONTROL_SHA="$(jq -r '.controlSha' <<<"$identity")" \
  EXPECTED_MERGE_SHA="$(jq -r '.mergeSha' <<<"$identity")" \
  EXPECTED_WORKFLOW_RUN_ID="$run_id" \
  POSTGRES_IMAGE="$postgres_image" \
  AGE_IDENTITY_FILE="$AGE_IDENTITY_FILE" \
  bash "$repo_root/scripts/backup/restore-catalogue-runtime.sh" \
  >"$tmp_dir/restore.stdout" 2>"$tmp_dir/restore.stderr" || fail filtered_restore_failed

node "$contract" sanitize-evidence \
  "$tmp_dir/evidence/catalogue-expected.json" \
  "$tmp_dir/evidence/rehearsal-metrics.json" \
  "$tmp_dir/sanitized-summary.json" >/dev/null || fail sanitized_evidence_invalid
mkdir -m 700 -- "$OFFLINE_EVIDENCE_DIR" || fail evidence_directory_creation_failed
evidence_created='true'
cp -- "$tmp_dir/sanitized-summary.json" "$OFFLINE_EVIDENCE_DIR/sanitized-summary.json" \
  || fail sanitized_evidence_copy_failed
evidence_created='false'
echo "OFFLINE_REPLAY status=PASS artifact_id=$artifact_id filtered_tables=27 evidence=sanitized"
