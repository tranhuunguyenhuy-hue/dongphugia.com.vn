import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const acquisitionPath =
  "scripts/backup/acquire-offline-catalogue-ciphertext.sh";
const replayPath = "scripts/backup/offline-catalogue-rehearsal.sh";
const restorePath = "scripts/backup/restore-catalogue-runtime.sh";
const runbookPath = "docs/deploy/offline-catalogue-rehearsal.md";

describe("two-domain offline catalogue recovery", () => {
  it("uses a manually run trusted-main acquisition tool with read-only GitHub metadata access", async () => {
    const acquisition = await readFile(acquisitionPath, "utf8");
    expect(acquisition).toContain("symbolic-ref --short HEAD");
    expect(acquisition).toContain("EXPECTED_MAIN_SHA");
    expect(acquisition).toContain("GH_TOKEN");
    expect(acquisition).toContain("commits/main");
    expect(acquisition).toContain('GH_TOKEN="$github_read_token" gh api');
    expect(acquisition).toContain("unset GH_TOKEN");
    expect(acquisition).toContain("pwd -P");
    expect(acquisition).toContain("/actions/runs/");
    expect(acquisition).toContain("/actions/artifacts/");
    expect(acquisition).toContain("/zip");
    expect(acquisition).not.toMatch(
      /\bAGE_IDENTITY\b|\bBACKUP_AGE_PRIVATE_KEY\b|age --decrypt|secrets\./i,
    );
    expect(acquisition).not.toMatch(
      /gh issue|gh pr|workflow_dispatch|upload-artifact|actions: write/i,
    );
  });

  it("acquires only the exact pinned archive package and validates its metadata and bundle members", async () => {
    const acquisition = await readFile(acquisitionPath, "utf8");
    const contract = await readFile(
      "scripts/backup/offline-catalogue-transfer-contract.mjs",
      "utf8",
    );
    expect(acquisition).toContain("validate-metadata");
    expect(acquisition).toContain("validate-archive-members");
    expect(acquisition).toContain("sha256sum");
    expect(acquisition).toContain("provenance.json");
    expect(acquisition).toContain("umask 077");
    expect(acquisition).toContain(
      'gh api "repos/$repo/actions/artifacts/$artifact_id/zip"',
    );
    expect(contract).toContain("PINNED_ARTIFACT");
    expect(contract).toContain("validateArtifactMetadata");
    expect(contract).toContain("validateArtifactArchiveMembers");
  });

  it("runs Phase B manually and refuses GitHub runner/API context before receiving age material", async () => {
    const replay = await readFile(replayPath, "utf8");
    const externalAttestation = replay.indexOf("verify-attestation");
    const ageIdentity = replay.indexOf("AGE_IDENTITY_FILE");
    expect(replay).toContain("GITHUB_*");
    expect(replay).toContain("RUNNER_*");
    expect(replay).toContain("GH_TOKEN");
    expect(replay).toContain("github_runner_context_detected");
    expect(replay).toContain("MODE=rehearsal");
    expect(externalAttestation).toBeGreaterThan(-1);
    expect(ageIdentity).toBeGreaterThan(externalAttestation);
  });

  it("has no GitHub/network/upload path while the offline replay is in scope", async () => {
    const [replay, restore] = await Promise.all([
      readFile(replayPath, "utf8"),
      readFile(restorePath, "utf8"),
    ]);
    expect(replay).not.toMatch(
      /gh api|gh run|curl|wget|upload-artifact|GITHUB_STEP_SUMMARY/i,
    );
    expect(replay).toContain(
      "findmnt --noheadings --output FSTYPE --target /dev/shm",
    );
    expect(replay).toContain("MIN_TMPFS_BYTES");
    expect(replay).toContain("docker image inspect");
    expect(restore).toContain("--network none");
    expect(replay).toContain("OFFLINE_REPLAY status=FAIL");
  });

  it("keeps the offline restore path rehearsal-only, local, allowlisted, and sanitized", async () => {
    const [replay, restore] = await Promise.all([
      readFile(replayPath, "utf8"),
      readFile(restorePath, "utf8"),
    ]);
    expect(replay).toContain("EXPECTED_WORKFLOW_RUN_ID");
    expect(replay).toContain('catalogue-restore-contract.mjs" validate-source');
    expect(replay).toContain("AGE_IDENTITY_FILE");
    expect(replay).toContain("sanitized-summary.json");
    expect(replay).toContain("MODE=rehearsal");
    expect(restore).toContain("AGE_IDENTITY_FILE");
    expect(restore).toContain("test \"$server_version_num\" = '170006'");
    expect(restore).toContain("test \"$empty_target_objects\" = '0'");
    expect(restore).toContain("--network none");
    expect(replay).not.toMatch(/\.tables\[\].*sha256|\.tables\[\].*hash/i);
  });

  it("removes the GitHub-connected secret-bearing candidate workflow and static runner label", async () => {
    const workflowFiles = await readdir(".github/workflows");
    expect(workflowFiles).not.toContain("offline-catalogue-rehearsal.yml");
    await expect(readFile(".github/actionlint.yaml", "utf8")).rejects.toThrow();
  });

  it("documents separate trust domains, explicit owner handoff, external egress proof, and unknown capacity", async () => {
    const runbook = await readFile(runbookPath, "utf8");
    expect(runbook).toContain("Phase A");
    expect(runbook).toContain("Owner-controlled");
    expect(runbook).toContain("Phase B");
    expect(runbook).toContain("independent security operator");
    expect(runbook).toContain("deny-all");
    expect(runbook).toContain(
      "remain physically disconnected for the entire replay",
    );
    expect(runbook).toContain("trusted bootstrap");
    expect(runbook).toContain("UNKNOWN");
    expect(runbook).toContain("2026-10-30 14:27:48 UTC");
    expect(runbook).toContain("There is no GitHub Actions workflow");
  });
});
