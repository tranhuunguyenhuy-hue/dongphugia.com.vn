import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  PINNED_ARTIFACT,
  buildSanitizedReplayEvidence,
  canonicalJson,
  createTransferProvenance,
  validateArtifactMetadata,
  validateArtifactArchiveMembers,
  validateArtifactPackage,
  validateTmpfsCapacity,
  validateTransferProvenance,
  verifySignedOfflineAttestation,
} from "./offline-catalogue-transfer-contract.mjs";
import { CATALOGUE_RESTORE_ORDER } from "./catalogue-restore-contract.mjs";

const validRun = {
  id: 38915575745,
  conclusion: "success",
  event: "workflow_dispatch",
  head_branch: "main",
  head_sha: "ce64e8cc7caf91b8bf2e4e2315d49e21bacdfffc",
  created_at: "2026-10-16T14:24:58Z",
  workflow_id: 344651291,
  path: ".github/workflows/runtime-backup.yml",
  repository: { id: 1157762683 },
};

const validArtifact = {
  id: 12052107648,
  name: "leo540-runtime-backup-38915575745",
  digest:
    "sha256:348431a2837ae5c3f473d80f5ca8807242e5bb1e164caf71f740a4bb76049e57",
  size_in_bytes: 9286999,
  created_at: "2026-10-16T14:27:49Z",
  expired: false,
  expires_at: "2026-10-30T14:27:48Z",
  workflow_run: {
    id: 38915575745,
    head_branch: "main",
    head_sha: "ce64e8cc7caf91b8bf2e4e2315d49e21bacdfffc",
    repository_id: 1157762683,
  },
};

const archiveMembers = [
  "leo540-38915575745.dump.age",
  "leo540-38915575745.manifest.json",
  "leo540-38915575745.checksums.sha256",
];

function signedEvidence(overrides = {}) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const attestation = {
    format: "dpg-offline-egress-attestation-v1",
    challenge: "a".repeat(64),
    hostId: "airgap-host-01",
    bootId: "boot-2026-10-18-01",
    policySha256: "b".repeat(64),
    issuedAt: "2026-10-18T10:00:00.000Z",
    expiresAt: "2026-10-18T11:00:00.000Z",
    operatorId: "operator-01",
    reviewerId: "independent-reviewer-02",
    verificationMethod: "out-of-band-host-console",
    controls: {
      ipv4Egress: "deny-all",
      ipv6Egress: "deny-all",
      dnsEgress: "deny-all",
      proxyEgress: "deny-all",
      metadataEgress: "deny-all",
      hostEgress: "deny-all",
      dockerDaemonEgress: "deny-all",
      dockerContainerEgress: "deny-all",
      networkLinks: "disconnected",
      physicalIsolationMaintainedThroughReplay: true,
    },
    ...overrides,
  };
  const publicKeyPem = publicKey
    .export({ type: "spki", format: "pem" })
    .toString();
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
  const signature = sign(
    null,
    Buffer.from(canonicalJson(attestation)),
    privateKeyPem,
  ).toString("base64");
  return { attestation, signature, publicKeyPem };
}

describe("offline catalogue transfer contract", () => {
  it("accepts only the exact still-retained successful main backup run and artifact metadata", () => {
    expect(
      validateArtifactMetadata(
        validRun,
        validArtifact,
        new Date("2026-10-18T10:00:00Z"),
      ),
    ).toEqual({
      runId: "38915575745",
      artifactId: "12052107648",
      artifactName: "leo540-runtime-backup-38915575745",
      artifactDigest:
        "sha256:348431a2837ae5c3f473d80f5ca8807242e5bb1e164caf71f740a4bb76049e57",
      artifactSizeBytes: 9286999,
      expiresAt: "2026-10-30T14:27:48Z",
      sourceControlSha: "ce64e8cc7caf91b8bf2e4e2315d49e21bacdfffc",
    });
  });

  it.each([
    ["wrong run id", { id: 7 }, validArtifact],
    ["wrong workflow event", { event: "pull_request" }, validArtifact],
    ["wrong source branch", { head_branch: "untrusted" }, validArtifact],
    ["wrong control sha", { head_sha: "0".repeat(40) }, validArtifact],
    ["wrong workflow identity", { workflow_id: 7 }, validArtifact],
  ])("rejects %s", (_name, runOverrides, artifact) => {
    expect(() =>
      validateArtifactMetadata(
        { ...validRun, ...runOverrides },
        artifact,
        new Date("2026-10-18"),
      ),
    ).toThrow();
  });

  it.each([
    ["artifact id", { id: 7 }],
    ["artifact name", { name: "another" }],
    ["artifact digest", { digest: `sha256:${"0".repeat(64)}` }],
    ["artifact size", { size_in_bytes: 1 }],
    ["artifact creation time", { created_at: "2026-10-16T14:27:50Z" }],
    ["expiry", { expires_at: "2026-10-31T00:00:00Z" }],
    ["expired state", { expired: true }],
    [
      "associated run",
      { workflow_run: { ...validArtifact.workflow_run, id: 7 } },
    ],
    [
      "associated control sha",
      {
        workflow_run: {
          ...validArtifact.workflow_run,
          head_sha: "0".repeat(40),
        },
      },
    ],
  ])("rejects changed %s", (_name, overrides) => {
    expect(() =>
      validateArtifactMetadata(
        validRun,
        { ...validArtifact, ...overrides },
        new Date("2026-10-18"),
      ),
    ).toThrow();
  });

  it("rejects artifacts after the exact retention deadline", () => {
    expect(() =>
      validateArtifactMetadata(
        validRun,
        validArtifact,
        new Date("2026-10-30T14:27:48Z"),
      ),
    ).toThrow(/expired/);
  });

  it("accepts only the exact three-file encrypted bundle, with no paths or extras", () => {
    expect(validateArtifactArchiveMembers(archiveMembers)).toEqual(
      [...archiveMembers].sort(),
    );
    expect(() =>
      validateArtifactArchiveMembers([...archiveMembers, "unexpected.txt"]),
    ).toThrow();
    expect(() =>
      validateArtifactArchiveMembers(
        archiveMembers.map((name) => `../${name}`),
      ),
    ).toThrow();
    expect(() =>
      validateArtifactArchiveMembers(
        archiveMembers.map((name) => `folder/${name}`),
      ),
    ).toThrow();
    expect(() =>
      validateArtifactArchiveMembers([...archiveMembers, archiveMembers[0]]),
    ).toThrow();
  });

  it("requires the exact immutable ZIP digest and API-reported package size", () => {
    expect(
      validateArtifactPackage(
        PINNED_ARTIFACT.artifactDigest.slice("sha256:".length),
        PINNED_ARTIFACT.artifactSizeBytes,
      ),
    ).toEqual({ status: "verified", artifactId: "12052107648" });
    expect(() =>
      validateArtifactPackage(
        "0".repeat(64),
        PINNED_ARTIFACT.artifactSizeBytes,
      ),
    ).toThrow();
    expect(() =>
      validateArtifactPackage(
        PINNED_ARTIFACT.artifactDigest.slice("sha256:".length),
        PINNED_ARTIFACT.artifactSizeBytes + 1,
      ),
    ).toThrow();
  });

  it("requires a real tmpfs and explicit positive headroom before offline work", () => {
    expect(validateTmpfsCapacity("tmpfs", 2000, 1000)).toEqual({
      status: "verified",
      requiredBytes: 1000,
    });
    expect(() => validateTmpfsCapacity("ext4", 2000, 1000)).toThrow(
      /tmpfs_required/,
    );
    expect(() => validateTmpfsCapacity("tmpfs", 500, 1000)).toThrow(
      /capacity_insufficient/,
    );
    expect(() => validateTmpfsCapacity("tmpfs", 2000, 0)).toThrow(
      /capacity_invalid/,
    );
    expect(() => validateTmpfsCapacity("tmpfs", "unknown", 1000)).toThrow(
      /capacity_invalid/,
    );
  });

  it("pins the exact immutable artifact values in source", () => {
    expect(PINNED_ARTIFACT).toMatchObject({
      runId: "38915575745",
      artifactId: "12052107648",
      artifactName: "leo540-runtime-backup-38915575745",
      artifactDigest:
        "sha256:348431a2837ae5c3f473d80f5ca8807242e5bb1e164caf71f740a4bb76049e57",
      artifactSizeBytes: 9286999,
      expiresAt: "2026-10-30T14:27:48Z",
    });
  });

  it("binds the immutable artifact digest and trusted source revision into transfer provenance", () => {
    const metadata = validateArtifactMetadata(
      validRun,
      validArtifact,
      new Date("2026-10-18T10:00:00Z"),
    );
    const provenance = createTransferProvenance(
      metadata,
      PINNED_ARTIFACT.artifactDigest.slice("sha256:".length),
      "2026-10-18T10:00:00Z",
      "a".repeat(40),
    );
    expect(
      validateTransferProvenance(
        provenance,
        PINNED_ARTIFACT.artifactDigest.slice("sha256:".length),
        "a".repeat(40),
        new Date("2026-10-18T10:30:00Z"),
      ),
    ).toMatchObject({ status: "verified", artifactId: "12052107648" });
    expect(() =>
      validateTransferProvenance(
        provenance,
        "0".repeat(64),
        "a".repeat(40),
        new Date("2026-10-18T10:30:00Z"),
      ),
    ).toThrow(/provenance_mismatch/);
    expect(() =>
      validateTransferProvenance(
        provenance,
        PINNED_ARTIFACT.artifactDigest.slice("sha256:".length),
        "b".repeat(40),
        new Date("2026-10-18T10:30:00Z"),
      ),
    ).toThrow(/provenance_mismatch/);
    expect(() =>
      validateTransferProvenance(
        { ...provenance, privateKey: "must-not-be-accepted" },
        PINNED_ARTIFACT.artifactDigest.slice("sha256:".length),
        "a".repeat(40),
        new Date("2026-10-18T10:30:00Z"),
      ),
    ).toThrow(/provenance_mismatch/);
    expect(() =>
      validateTransferProvenance(
        provenance,
        PINNED_ARTIFACT.artifactDigest.slice("sha256:".length),
        "a".repeat(40),
        new Date("2026-10-30T14:27:48Z"),
      ),
    ).toThrow(/expired/);
  });

  it("emits only sanitized 27-table names and row counts from rehearsal evidence", () => {
    const manifest = {
      contract: "dongphugia:catalogue-filtered-restore:v1",
      excludedRows: [],
      tables: CATALOGUE_RESTORE_ORDER.map((tableName, index) => ({
        tableName,
        rowCount: index,
        sha256: "c".repeat(64),
      })),
    };
    const output = buildSanitizedReplayEvidence(manifest, {
      databaseBytes: 100,
      durationSeconds: 7,
    });
    expect(output.tableCount).toBe(27);
    expect(output.tables[0]).toHaveProperty("tableName");
    expect(output.tables[0]).toHaveProperty("rowCount");
    expect(JSON.stringify(output)).not.toContain("sha256");
    expect(() =>
      buildSanitizedReplayEvidence(
        { ...manifest, excludedRows: ["customers"] },
        { databaseBytes: 100, durationSeconds: 7 },
      ),
    ).toThrow();
  });

  it("accepts a fresh signed external deny-all-egress attestation bound to this offline host and challenge", () => {
    const evidence = signedEvidence();
    expect(
      verifySignedOfflineAttestation({
        ...evidence,
        expectedPublicKeySha256: createHash("sha256")
          .update(evidence.publicKeyPem)
          .digest("hex"),
        expectedChallenge: "a".repeat(64),
        expectedHostId: "airgap-host-01",
        expectedBootId: "boot-2026-10-18-01",
        expectedPolicySha256: "b".repeat(64),
        operatorId: "operator-01",
        now: new Date("2026-10-18T10:30:00Z"),
      }),
    ).toEqual({
      status: "verified",
      hostId: "airgap-host-01",
      policySha256: "b".repeat(64),
    });
  });

  it.each([
    ["challenge mismatch", { expectedChallenge: "c".repeat(64) }],
    ["host mismatch", { expectedHostId: "other-host" }],
    ["boot mismatch", { expectedBootId: "other-boot" }],
    ["policy digest mismatch", { expectedPolicySha256: "d".repeat(64) }],
    [
      "operator/reviewer identity collision",
      { operatorId: "independent-reviewer-02" },
    ],
  ])("rejects signed isolation evidence with %s", (_name, options) => {
    const evidence = signedEvidence();
    expect(() =>
      verifySignedOfflineAttestation({
        ...evidence,
        expectedPublicKeySha256: createHash("sha256")
          .update(evidence.publicKeyPem)
          .digest("hex"),
        expectedChallenge: "a".repeat(64),
        expectedHostId: "airgap-host-01",
        expectedBootId: "boot-2026-10-18-01",
        expectedPolicySha256: "b".repeat(64),
        operatorId: "operator-01",
        now: new Date("2026-10-18T10:30:00Z"),
        ...options,
      }),
    ).toThrow();
  });

  it("fails if any egress class is not denied or the evidence is stale", () => {
    const validControls = signedEvidence().attestation.controls;
    const egressEvidence = signedEvidence({
      controls: { ...validControls, ipv6Egress: "allow" },
    });
    expect(() =>
      verifySignedOfflineAttestation({
        ...egressEvidence,
        expectedPublicKeySha256: createHash("sha256")
          .update(egressEvidence.publicKeyPem)
          .digest("hex"),
        expectedChallenge: "a".repeat(64),
        expectedHostId: "airgap-host-01",
        expectedBootId: "boot-2026-10-18-01",
        expectedPolicySha256: "b".repeat(64),
        operatorId: "operator-01",
        now: new Date("2026-10-18T10:30:00Z"),
      }),
    ).toThrow();

    const staleEvidence = signedEvidence();
    expect(() =>
      verifySignedOfflineAttestation({
        ...staleEvidence,
        expectedPublicKeySha256: createHash("sha256")
          .update(staleEvidence.publicKeyPem)
          .digest("hex"),
        expectedChallenge: "a".repeat(64),
        expectedHostId: "airgap-host-01",
        expectedBootId: "boot-2026-10-18-01",
        expectedPolicySha256: "b".repeat(64),
        operatorId: "operator-01",
        now: new Date("2026-10-18T12:00:01Z"),
      }),
    ).toThrow(/expired/);
  });

  it("requires independent physical isolation to remain in force for the entire replay", () => {
    const evidence = signedEvidence({
      controls: {
        ...signedEvidence().attestation.controls,
        physicalIsolationMaintainedThroughReplay: false,
      },
    });
    expect(() =>
      verifySignedOfflineAttestation({
        ...evidence,
        expectedPublicKeySha256: createHash("sha256")
          .update(evidence.publicKeyPem)
          .digest("hex"),
        expectedChallenge: "a".repeat(64),
        expectedHostId: "airgap-host-01",
        expectedBootId: "boot-2026-10-18-01",
        expectedPolicySha256: "b".repeat(64),
        operatorId: "operator-01",
        now: new Date("2026-10-18T10:30:00Z"),
      }),
    ).toThrow(/physical_isolation_lifetime_required/);
  });

  it("rejects tampered signatures and unpinned verification keys", () => {
    const evidence = signedEvidence();
    expect(() =>
      verifySignedOfflineAttestation({
        ...evidence,
        signature: Buffer.from("tampered").toString("base64"),
        expectedPublicKeySha256: createHash("sha256")
          .update(evidence.publicKeyPem)
          .digest("hex"),
        expectedChallenge: "a".repeat(64),
        expectedHostId: "airgap-host-01",
        expectedBootId: "boot-2026-10-18-01",
        expectedPolicySha256: "b".repeat(64),
        expectedPublicKeySha256: "f".repeat(64),
        operatorId: "operator-01",
        now: new Date("2026-10-18T10:30:00Z"),
      }),
    ).toThrow();

    expect(() =>
      verifySignedOfflineAttestation({
        ...evidence,
        signature: Buffer.from("tampered").toString("base64"),
        expectedPublicKeySha256: createHash("sha256")
          .update(evidence.publicKeyPem)
          .digest("hex"),
        expectedChallenge: "a".repeat(64),
        expectedHostId: "airgap-host-01",
        expectedBootId: "boot-2026-10-18-01",
        expectedPolicySha256: "b".repeat(64),
        operatorId: "operator-01",
        now: new Date("2026-10-18T10:30:00Z"),
      }),
    ).toThrow(/signature_invalid/);
  });
});
