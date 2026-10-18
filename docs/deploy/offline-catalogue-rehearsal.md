# Two-domain offline catalogue recovery

## Purpose and current authorization

This runbook describes a source-only design for preserving and rehearsing the
exact encrypted LEO-560 artifact. It separates a GitHub-connected ciphertext
acquisition on a trusted operator machine from a later fully offline restore
on a disposable Linux host. There is no GitHub Actions workflow for the
secret-bearing replay.

The source change does **not** authorize either phase to run. Current approval
is limited to editing this PR and running source/static tests. Artifact download,
copy/preservation, decryption, age-key delivery, runner/host provisioning,
Supabase access, merge, or production changes each remain prohibited until the
Owner approves that exact phase separately.

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
Phase A: trusted main checkout + read-only GitHub access
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
artifact, source revision, and acquisition checkout SHA. The Owner manually
controls the transfer medium and verifies the displayed digest through the
authenticated Phase A session before accepting the package. Phase B never
calls GitHub or any other remote endpoint.

## Phase A — GitHub-connected ciphertext acquisition

Run manually on a trusted operator workstation from a clean, exact `main`
checkout after a separate Owner approval for artifact acquisition and
preservation. Use a dedicated read-only GitHub token scoped to repository
Actions/artifact metadata and contents read; do not use a write-capable token.
No age identity, Supabase URL, Cloudflare/AWS credential, or other decrypt
material is accepted by the script.

```sh
EXPECTED_MAIN_SHA=<exact-trusted-main-sha> \
GH_TOKEN=<read-only-github-token> \
bash scripts/backup/acquire-offline-catalogue-ciphertext.sh \
  /absolute/new/private/output-directory
```

The script refuses a non-canonical repository, non-`main` ref, dirty checkout,
wrong SHA, existing output directory, or output inside the repository. It reads
only the exact pinned run and artifact metadata, checks run event/branch/workflow
identity, artifact ID/name/digest/size/expiry and run provenance, then requests
the exact artifact ZIP by ID. It checks package size and SHA-256, rejects path,
extra, duplicate, or ambiguous ZIP members, verifies the encrypted payload's
checksum and sanitized manifest/source identity, and writes only the original
encrypted artifact ZIP plus a whitelist-only `provenance.json` sidecar. It
never emits artifact bytes or manifest rows in logs.

The script does not upload a second artifact or automate transfer to Phase B.
The Owner must use an approved offline medium and preserve chain of custody.
Do not execute Phase A under this source-only approval.

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
egress `deny-all`; physical/network links `disconnected`; review method
`out-of-band-host-console`. The operator also pins the attestation public-key
fingerprint and policy digest through a separate trusted channel. This PR
contains no such trust key, policy digest, or provisioned host: all are
**UNKNOWN / Owner setup required**.

The signed JSON shape is exactly the fields validated by
`verifySignedOfflineAttestation`: `format`, `challenge`, `hostId`, `bootId`,
`policySha256`, `issuedAt`, `expiresAt`, `operatorId`, `reviewerId`,
`verificationMethod`, and `controls`. The reviewer signs UTF-8 canonical JSON
(recursively sorted object keys, array order preserved) with Ed25519; the
separate signature file is base64. The verifier rejects extra fields, an
untrusted public-key fingerprint, a stale/mismatched host challenge, any
non-deny control, an operator/reviewer identity collision, or a signature
mismatch. The external reviewer—not the guest—must verify the policy digest
against the active host/network controls before signing.

First disconnect the host network and generate a challenge. Pass the challenge
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
STOP: the signed external proof, not the container setting, is the host boundary.

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
Do not preserve the artifact beyond its current expiry by another mechanism
without a separate Owner decision.

Before either operation, obtain separate Owner approval for artifact
acquisition/preservation. Before Phase B additionally obtain approval for
host/provisioning and external egress-control evidence, age-key delivery, and
offline execution. Merge remains a separate Owner gate. This source change does
not authorize a download, copy, decrypt, restore, runner/host provisioning,
Supabase/Cloudflare/AWS/DNS/Production access, or merge.
