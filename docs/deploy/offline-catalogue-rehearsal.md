# Two-domain offline catalogue recovery

## Purpose and current authorization

This runbook describes a source-only design for preserving and rehearsing the
exact encrypted LEO-560 artifact. It separates a GitHub-connected ciphertext
acquisition on a trusted operator machine from a later fully offline restore
on a disposable Linux host. There is no GitHub Actions workflow for the
secret-bearing replay.

Issue #160 comment `6252739416` approved ciphertext-only Phase A, subject to a
clean trusted checkout, read-only artifact access, and protected durable
storage. Comment `6257891738` separately authorizes the reviewed-PR route only
for exact PR #161 head `4e72417b6e87949dd3f44b96a5ead9d5b82f05dc` and its
independently verified acquisition-script hash. The route remains blocked
until its read-only credential and durable protected storage gates are met.
This follow-up branch is not an approved Phase A acquisition source. Phase B,
age-key delivery, merge, infrastructure provisioning, Supabase, Cloudflare,
DNS, and Production remain separate gates.

The GitHub artifact is pinned to run `38915575745`, artifact ID `12052107648`,
package digest
`sha256:348431a2837ae5c3f473d80f5ca8807242e5bb1e164caf71f740a4bb76049e57`,
size 9,286,999 bytes, source control SHA
`ce64e8cc7caf91b8bf2e4e2315d49e21bacdfffc`, and expiry
**2026-10-30 14:27:48 UTC**. Read-only GitHub metadata was revalidated on
2026-10-18; this is dated evidence and must be revalidated at a separately
approved acquisition. The artifact content has not been downloaded or
inspected by this change.

## Trust-domain diagram

```text
Phase A: independently verified main or reviewed PR source + read-only GitHub access
  exact run/artifact metadata -> exact ZIP digest -> encrypted-only package
             |                         no age identity
             +---- Owner-controlled physical/offline handoff ----+
                                                                 |
Phase B: disposable Linux host, network disconnected             v
  external security reviewer signs current deny-all attestation
       -> verify signature/host/boot/challenge/policy before key
       -> stage age identity in /dev/shm -> local PostgreSQL 17.6
       -> 27-table parity check -> sanitized evidence only
       -> erase tmpfs work area; operator removes staged key
```

The package digest is hard-pinned in the source contract and is checked again
offline. The provenance sidecar binds that digest to the exact GitHub run,
artifact, verified live-main SHA, and acquisition source mode/SHA. The Owner manually
controls the transfer medium and verifies the displayed digest through the
authenticated Phase A session before accepting the package. Phase B never
calls GitHub or any other remote endpoint.

## Phase A — GitHub-connected ciphertext acquisition

There are two possible source roots. Merging exact PR #161 through the normal
review/CI/Owner gate puts the reviewed code on canonical `main`; the original
main-pinned bootstrap below then applies. The alternative is an immutable PR
commit independently reviewed and approved by the Owner, with its acquisition
script SHA-256 provided through a separate trusted channel. That alternative
can avoid waiting for a merge, but its unmerged code carries a distinct trust
risk. The Owner has separately approved that route for only the exact PR #161
head and script hash recorded in comment `6257891738`; no later commit or this
follow-up branch is covered. Neither path changes the artifact, credential,
encrypted-storage, or provenance gates.

For either path, first verify the repository-scoped credential has only
**Contents: read** and **Actions: read**. In the trusted operator shell, with
command tracing disabled, receive it through a no-echo prompt rather than
typing its value into a command. The examples below use this local variable;
they never contain the token value:

```sh
set +x
printf 'Read-only GitHub token: ' >&2
IFS= read -r -s github_read_token
printf '\n' >&2
test -n "$github_read_token"
```

Keep this shell private, do not enable tracing, and `unset github_read_token`
immediately after the selected procedure (also on any abort). Use the same
read-only credential for the independent API and Git bootstrap and for the
subsequent acquisition invocation; do not fall back to an ambient broader
GitHub login or Git credential helper. Stop if any check below fails.

### Canonical-main bootstrap

The acquisition script cannot establish its own source integrity before it
starts, so never provide it a token from an arbitrary checkout. First perform a
trusted bootstrap using the system GitHub CLI and Git, without running any repo
script: obtain the live `main` SHA from the GitHub API, create a fresh canonical
clone, fetch/check out that exact SHA, and verify the clone is clean and its
`origin` is the canonical repository. Treat a stale SHA, fork, locally relabeled
branch, or modified checkout as a STOP. Only after this independent source check
may the operator pass the token to the exact-main acquisition script. This
manual bootstrap is the root of trust; the script's runtime API check detects
main moving after bootstrap but is not a substitute for it.

For example, in an empty private temporary parent directory, use the already
trusted system `gh` and `git` binaries:

```sh
trusted_sha="$(GH_TOKEN="$github_read_token" gh api repos/tranhuunguyenhuy-hue/dongphugia.com.vn/commits/main --jq .sha)"
GH_TOKEN="$github_read_token" GIT_TERMINAL_PROMPT=0 git -c credential.helper= -c credential.helper='!gh auth git-credential' clone https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn.git trusted-acquisition
GH_TOKEN="$github_read_token" GIT_TERMINAL_PROMPT=0 git -C trusted-acquisition -c credential.helper= -c credential.helper='!gh auth git-credential' fetch origin "$trusted_sha"
git -C trusted-acquisition checkout -B main "$trusted_sha"
test "$(git -C trusted-acquisition rev-parse HEAD)" = "$trusted_sha"
test "$(git -C trusted-acquisition remote get-url origin)" = 'https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn.git'
test -z "$(git -C trusted-acquisition status --porcelain --untracked-files=all)"
```

Run manually on that trusted operator workstation after all applicable Owner
approvals. Use a dedicated fine-grained token scoped to this repository with
**Contents: read** (for the commit and PR metadata/private clone) and
**Actions: read** (for run and artifact metadata/download); grant no write
permissions. Supply it only through the no-echo variable above, never as a
literal in shell history. The script immediately removes
`GH_TOKEN` from its inherited environment, scopes the token only to individual
`gh api` invocations, and unsets its private shell variable after the last API
call. Node, checksum, unzip, Git, and validation subprocesses receive no token.
No age identity, Supabase URL, Cloudflare/AWS credential, or other decrypt
material is accepted by the script.

```sh
EXPECTED_MAIN_SHA="$trusted_sha" \
GH_TOKEN="$github_read_token" \
bash trusted-acquisition/scripts/backup/acquire-offline-catalogue-ciphertext.sh \
  /absolute/new/private/output-directory
unset github_read_token
```

### Independently reviewed PR-commit bootstrap — source candidate only

The Owner must first review the final PR #161 commit and all code reachable by
the acquisition entrypoint, including the transfer, manifest, and catalogue
restore contracts. An independent reviewer records the exact PR head SHA and
the SHA-256 of `acquire-offline-catalogue-ciphertext.sh` outside the checkout.
Do not derive either approved value merely by inspecting the checkout that is
about to run. Any new push, changed review, or new SHA needs a fresh review and
Owner decision. This source candidate does not satisfy the existing
main-only operational approval by itself.

Using trusted system Git/GitHub CLI, before supplying any artifact token to
repository code, verify live `main` and PR #161 against those independently
approved pins, clone the canonical repository into a new private directory,
fetch the exact PR ref, and check out the approved commit detached:

```sh
approved_pr_sha=<independently-approved-40-character-commit>
approved_script_sha256=<independently-reviewed-64-character-sha256>
live_main_sha="$(GH_TOKEN="$github_read_token" gh api repos/tranhuunguyenhuy-hue/dongphugia.com.vn/commits/main --jq .sha)"
live_pr_sha="$(GH_TOKEN="$github_read_token" gh api repos/tranhuunguyenhuy-hue/dongphugia.com.vn/pulls/161 --jq .head.sha)"
test "$live_pr_sha" = "$approved_pr_sha"
GH_TOKEN="$github_read_token" GIT_TERMINAL_PROMPT=0 git -c credential.helper= -c credential.helper='!gh auth git-credential' clone https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn.git trusted-acquisition
GH_TOKEN="$github_read_token" GIT_TERMINAL_PROMPT=0 git -C trusted-acquisition -c credential.helper= -c credential.helper='!gh auth git-credential' fetch origin refs/pull/161/head
git -C trusted-acquisition checkout --detach "$approved_pr_sha"
test "$(git -C trusted-acquisition rev-parse HEAD)" = "$approved_pr_sha"
test "$(git -C trusted-acquisition remote get-url origin)" = 'https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn.git'
test -z "$(git -C trusted-acquisition status --porcelain --untracked-files=all)"
git -C trusted-acquisition merge-base --is-ancestor "$live_main_sha" "$approved_pr_sha"
test "$(shasum -a 256 trusted-acquisition/scripts/backup/acquire-offline-catalogue-ciphertext.sh | awk '{print $1}')" = "$approved_script_sha256"
```

These manual checks are the root of trust. The script then independently
checks the clean detached checkout, main ancestry, script hash, live main SHA,
PR number/state/base/head/repository identity, and exact artifact metadata.
Its `reviewed-pr` provenance records both the live-main SHA and the executed
PR source SHA. A rejected source check must end before any artifact request;
do not switch to a different PR head or remove a guard. Only after separate
Owner approval for this exact PR-mode invocation may the operator run:

```sh
ACQUISITION_SOURCE_MODE=reviewed-pr \
EXPECTED_MAIN_SHA="$live_main_sha" \
EXPECTED_PR_HEAD_SHA="$approved_pr_sha" \
EXPECTED_SCRIPT_SHA256="$approved_script_sha256" \
GH_TOKEN="$github_read_token" \
bash trusted-acquisition/scripts/backup/acquire-offline-catalogue-ciphertext.sh \
  /absolute/new/private/output-directory
unset github_read_token
```

PR-mode provenance intentionally fails the current Phase B `main`-only source
check. Phase B needs a separately reviewed source/provenance decision and its
own Owner approval; Phase A preservation does not imply replay readiness.

### Owner setup before either acquisition path

1. On an Owner-controlled workstation, select only this repository for a
   fine-grained credential with Contents read and Actions read; give it a short
   expiry spanning acquisition and no write permissions. Verify the selected
   repository and permissions in GitHub. Inject it locally without pasting it
   into chat, Issue, PR, process logs, or shell history.
2. From trusted system tools, confirm the credential can read the live-main
   commit, PR metadata when using the PR path, exact run metadata, and artifact
   metadata. A successful metadata read is not a download or preservation.
3. Identify an Owner-controlled encrypted persistent volume with enough free
   space and a private output parent outside the repository. Verify device or
   volume encryption, directory access restricted to the Owner, and a retention
   plan extending beyond 2026-10-30 14:27:48 UTC. Keep its actual path private.
4. Immediately before acquisition, recheck the approved source pins, GitHub
   artifact expiry, exact ID/digest/size, volume availability, and output
   directory absence. Preserve only the encrypted ZIP and sanitized provenance.
   Afterward verify file modes, rehash the saved ZIP, and privately record its
   location and retention owner. Never post the token, bytes, or path publicly.

The script refuses a non-canonical repository, mismatched source ref or SHA,
dirty checkout, live GitHub `main` mismatch, existing output directory, or output
inside the repository after canonicalizing the output parent through symlinks. It reads only
the exact pinned run and artifact metadata, checks run event/branch/workflow
identity, artifact ID/name/digest/size/expiry and run provenance, then requests
the exact artifact ZIP by ID. It checks package size and SHA-256, rejects path,
extra, duplicate, or ambiguous ZIP members, verifies the encrypted payload's
checksum and sanitized manifest/source identity, and writes only the original
encrypted artifact ZIP plus a whitelist-only `provenance.json` sidecar. It
never emits artifact bytes or manifest rows in logs.

The script does not upload a second artifact or automate transfer to Phase B.
The Owner must use an approved offline medium and preserve chain of custody.
For Phase A, use only the exact PR #161 source pin approved in comment
`6257891738`. This follow-up branch changes the offline provenance validator
and is not part of that acquisition approval.

## Phase B — Owner-controlled offline replay

Use a disposable Linux system that is not registered as any GitHub runner and
has no cloud credentials. An independent security operator (not the replay
operator) must inspect the host's external network controls using an out-of-band
host console or physical link control, disconnect all network links, verify the
policy digest, and sign a short-lived Ed25519 attestation. The private signing
key remains outside the replay host. A root process or script running inside
the guest is **not** independent evidence and cannot satisfy this gate.

The signed attestation must bind a fresh 256-bit challenge to the replay host
and boot ID, the externally reviewed policy SHA-256, operator and distinct
reviewer IDs, issue/expiry times no more than one hour apart, and these exact
controls: IPv4, IPv6, DNS, proxy, metadata, host, Docker daemon and container
egress `deny-all`; physical/network links `disconnected`; and
`physicalIsolationMaintainedThroughReplay: true`. The independent reviewer
must commit to keeping physical isolation in force from before age-key staging
until the replay process exits, the key is removed, and the operator confirms
teardown. The independent reviewer must ensure the links remain physically disconnected for the entire replay, and stay out-of-band to ensure no
link is reconnected; if continuous independent oversight cannot be guaranteed,
do not stage the key and do not run replay. Review method is
`out-of-band-host-console`. This is an external manual interlock, not a
point-in-time guest attestation or a claim that the source script can enforce
the host boundary. The operator also pins the attestation public-key
fingerprint and policy digest through a separate trusted channel. This PR
contains no such trust key, policy digest, or provisioned host: all are
**UNKNOWN / Owner setup required**.

The signed JSON shape is exactly the fields validated by
`verifySignedOfflineAttestation`: `format`, `challenge`, `hostId`, `bootId`,
`policySha256`, `issuedAt`, `expiresAt`, `operatorId`, `reviewerId`,
`verificationMethod`, and `controls`; controls include the signed-through-replay
commitment. The reviewer signs UTF-8 canonical JSON
(recursively sorted object keys, array order preserved) with Ed25519; the
separate signature file is base64. The verifier rejects extra fields, an
untrusted public-key fingerprint, a stale/mismatched host challenge, any
non-deny control, an operator/reviewer identity collision, or a signature
mismatch. The external reviewer—not the guest—must verify the policy digest
against the active host/network controls before signing.

First have the independent reviewer physically disconnect/disable every
network interface and confirm the host will remain disconnected until teardown;
only then generate a challenge. Pass the challenge
and hashed host/boot identity to the independent reviewer using a separate
out-of-band channel; receive the signed attestation back on the offline medium.
Then run `verify` with the transfer directory and attestation metadata, but
without staging the age identity:

```sh
OFFLINE_EGRESS_POLICY_SHA256=<reviewed-policy-sha256> \
bash scripts/backup/offline-catalogue-rehearsal.sh prepare-attestation

EXPECTED_MAIN_SHA=<same-main-sha-as-phase-a> \
OFFLINE_BUNDLE_DIR=<owner-controlled-transfer-directory> \
OFFLINE_ATTESTATION_FILE=<signed-attestation-json> \
OFFLINE_ATTESTATION_SIGNATURE_FILE=<signature-file> \
OFFLINE_ATTESTATION_PUBLIC_KEY_FILE=<trusted-public-key> \
OFFLINE_ATTESTATION_KEY_SHA256=<out-of-band-key-fingerprint> \
OFFLINE_EGRESS_POLICY_SHA256=<reviewed-policy-sha256> \
OFFLINE_CHALLENGE=<challenge-from-prepare-step> \
OFFLINE_OPERATOR_ID=<operator-id> \
MIN_TMPFS_BYTES=<independently-measured-required-bytes> \
bash scripts/backup/offline-catalogue-rehearsal.sh verify
```

Only after `verify` passes may the separately approved age identity be staged
as a mode-0600 regular file in `/dev/shm`. The `rehearse` invocation repeats
signature, host/boot, digest, provenance, tmpfs, capacity, and pinned-image
checks before it reads the key file. Phase B has no GitHub runner context,
GitHub/cloud token environment, proxy, network/API client, log uploader, or
artifact upload. It uses only local tools; PostgreSQL runs with `--network none`
and a digest-pinned PostgreSQL 17.6 image. Any egress availability is still a
STOP: the signed external proof and continuous out-of-band human interlock, not
the container setting or a one-time signature check, are the host boundary.

```sh
EXPECTED_MAIN_SHA=<same-main-sha-as-phase-a> \
OFFLINE_BUNDLE_DIR=<owner-controlled-transfer-directory> \
OFFLINE_ATTESTATION_FILE=<signed-attestation-json> \
OFFLINE_ATTESTATION_SIGNATURE_FILE=<signature-file> \
OFFLINE_ATTESTATION_PUBLIC_KEY_FILE=<trusted-public-key> \
OFFLINE_ATTESTATION_KEY_SHA256=<out-of-band-key-fingerprint> \
OFFLINE_EGRESS_POLICY_SHA256=<reviewed-policy-sha256> \
OFFLINE_CHALLENGE=<challenge-from-prepare-step> \
OFFLINE_OPERATOR_ID=<operator-id> \
MIN_TMPFS_BYTES=<independently-measured-required-bytes> \
AGE_IDENTITY_FILE=/dev/shm/<owner-staged-mode-0600-file> \
OFFLINE_EVIDENCE_DIR=<absolute-new-private-evidence-directory> \
bash scripts/backup/offline-catalogue-rehearsal.sh rehearse
```

Capacity is currently **UNKNOWN**. `MIN_TMPFS_BYTES` must be independently
derived from the actual restore's required space (encrypted package, expanded
dump, temporary PostgreSQL data and evidence with safety margin), not guessed
from the encrypted ZIP size. The run script fails if `/dev/shm` is not tmpfs,
if the required capacity is absent/invalid/insufficient, or if the exact image
is not already present locally. It never pulls an image.

The replay reuses the existing exact 27-table restore contract, confirms a
fresh empty target, PostgreSQL `17.6`, excluded-table emptiness, and row-count
and hash parity against the pinned manifest. It writes a sanitized summary
containing only table names, counts, filtered table total, approximate database
bytes, and duration—no row contents or per-table hashes. The restore script
removes plaintext, temporary identity copy, container and tmpfs work directory
on exit. The operator must remove the separately staged identity file from
`/dev/shm` and securely destroy/reimage the disposable host after recording the
sanitized evidence.

## Stop conditions and approval gates

Stop without retry if any run/artifact ID, repository, source SHA, package
digest/size, manifest identity, expiry, signed attestation, key fingerprint,
challenge, host ID, boot ID, policy digest, network control, tmpfs type/capacity,
image digest, empty target, allowlist, parity, or sanitized-evidence check is
missing or mismatched. Do not weaken a check or switch to a different artifact.
Issue #160 comment `6252739416` separately approved secure ciphertext
preservation beyond GitHub expiry. The GitHub expiry is the API retrieval
deadline: artifact metadata validation still rejects a download at or after
that deadline. Offline provenance verification may happen later only when the
recorded `capturedAt` is before expiry and not later than verification time;
the exact artifact identity, digest, source, and provenance checks still
apply. This permits validating a protected ciphertext copy after GitHub removes
the artifact; it does not permit claiming a late acquisition or bypass any
separate Phase B approval.

Before acquisition, revalidate the exact approved PR #161 source pin and all
credential, storage, and artifact gates. The follow-up branch itself is not an
approved acquisition source.
Before Phase B additionally obtain approval for
host/provisioning and external egress-control evidence, age-key delivery, and
offline execution. Merge remains a separate Owner gate. This source change does
not authorize a download, copy, decrypt, restore, runner/host provisioning,
Supabase/Cloudflare/AWS/DNS/Production access, or merge.
