# Offline filtered catalogue rehearsal

## Purpose and scope

This is a source-only, manual workflow for rehearsing the exact encrypted LEO-560 catalogue backup against a disposable PostgreSQL 17.6 target. It does not connect to or write to Supabase, Production, Cloudflare, AWS, DNS, or the public site. It does not import data into a remote project. A successful rehearsal proves only that the pinned artifact decrypts in the isolated runner, restores the allowlisted catalogue into a fresh local database, and matches the source catalogue manifest.

The workflow is pinned to the recorded run, artifact ID/name/digest, control/candidate/merge identities, PR number, and expiry. It also validates the checksum, manifest, and source identity before decrypting. The restore script confirms PostgreSQL 17.6, requires a truly empty target, uses the existing 27-table contract, starts PostgreSQL with `--network none`, and compares catalogue manifests. Its only persisted result is a sanitized aggregate database-size/duration file plus the GitHub step summary containing table names and row counts. Per-table content and hashes are not emitted. Artifact and evidence files are removed from `/dev/shm` in an `always()` cleanup step.

## Runner and network boundary

GitHub-hosted runners are not accepted: this workflow needs actual host-enforced egress denial, not a claim inferred from container `--network none`. It is restricted to the protected `runtime-backup` environment and runner labels `self-hosted`, `linux`, and `dpg-offline-pg17`. Before downloading the encrypted artifact or exposing the age identity, the job requires a root-owned, non-writable `/usr/local/sbin/dpg-offline-runner-attest` executable to attest the `dongphugia-catalogue-rehearsal` profile and the Supabase-egress-deny policy; it then verifies `/dev/shm` is tmpfs and the digest-pinned PostgreSQL image is preloaded.

The dedicated runner must be single-use, isolated from other workloads, have an externally enforced host/firewall policy denying Supabase APIs and database endpoints as well as all production, Cloudflare, and AWS endpoints, and allow only the minimum GitHub Actions/artifact endpoints required for this workflow. Its root-managed attestor must validate the active host policy, runner identity, immutable policy digest, and the egress-deny rules; a workflow-local test or Docker network setting is not equivalent. The runner must have no persistent workspace, use tmpfs for artifact/decrypted/evidence material, and be destroyed or reprovisioned after a job. The age identity is injected only into the single restore step and is never logged or persisted outside tmpfs.

**Current gate: NOT PROVEN.** No dedicated runner, root-owned attestor, host firewall policy, or independent egress evidence is provisioned/verified by this source change. The workflow must not be dispatched until the owner separately approves runner provisioning, the exact network policy and its evidence are reviewed, and the secret-bearing run is separately authorized. The workflow intentionally fails closed if the attestor or local prerequisites are absent. Source CI does not validate the host egress boundary or run the rehearsal.

## Invocation and acceptance

After a separately approved source merge and runner/security review, an authorized owner may dispatch this workflow only from `main`, entering the exact main SHA that GitHub is running. The `runtime-backup` environment reviewer gate applies. The workflow checks the immutable backup provenance and retention window, performs the offline restore, validates source/target parity, and writes only sanitized aggregate evidence. A green workflow is not approval to import, merge another change, alter DNS/traffic, or access Production.

Acceptance for this source PR is limited to source review and required CI. No rehearsal, Supabase connection, secret read/write, runner creation, environment change, merge, import, DNS, or traffic action is part of this PR.
