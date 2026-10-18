import { createHash, createPublicKey, verify } from "node:crypto";
import { CATALOGUE_RESTORE_ORDER } from "./catalogue-restore-contract.mjs";

export const PINNED_ARTIFACT = Object.freeze({
  runId: "38915575745",
  runConclusion: "success",
  runEvent: "workflow_dispatch",
  runBranch: "main",
  runCreatedAt: "2026-10-16T14:24:58Z",
  workflowId: 344651291,
  workflowPath: ".github/workflows/runtime-backup.yml",
  controlSha: "ce64e8cc7caf91b8bf2e4e2315d49e21bacdfffc",
  repositoryId: 1157762683,
  artifactId: "12052107648",
  artifactName: "leo540-runtime-backup-38915575745",
  artifactDigest:
    "sha256:348431a2837ae5c3f473d80f5ca8807242e5bb1e164caf71f740a4bb76049e57",
  artifactSizeBytes: 9286999,
  artifactCreatedAt: "2026-10-16T14:27:49Z",
  expiresAt: "2026-10-30T14:27:48Z",
  backupId: "leo540-38915575745",
  prNumber: 156,
  candidateSha: "d300eb696a94acfa557fbaf7a8c0e66876dafb63",
  mergeSha: "59d9ea02dbceb5a3b83d00f929a8ee3a8f70cc35",
});

const ARCHIVE_MEMBERS = Object.freeze([
  `${PINNED_ARTIFACT.backupId}.dump.age`,
  `${PINNED_ARTIFACT.backupId}.manifest.json`,
  `${PINNED_ARTIFACT.backupId}.checksums.sha256`,
]);

const ATTESTATION_FORMAT = "dpg-offline-egress-attestation-v1";
const REQUIRED_DENY_ALL_CONTROLS = Object.freeze({
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
});

function fail(reason) {
  throw new Error(reason);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonical(value));
}

export function validateArtifactMetadata(run, artifact, now = new Date()) {
  const expected = PINNED_ARTIFACT;
  if (
    !run ||
    String(run.id) !== expected.runId ||
    run.conclusion !== expected.runConclusion ||
    run.event !== expected.runEvent ||
    run.head_branch !== expected.runBranch ||
    run.head_sha !== expected.controlSha ||
    run.created_at !== expected.runCreatedAt ||
    run.path !== expected.workflowPath ||
    Number(run.workflow_id) !== expected.workflowId ||
    Number(run.repository?.id) !== expected.repositoryId
  )
    fail("backup_run_identity_mismatch");

  const artifactRun = artifact?.workflow_run;
  if (
    !artifact ||
    String(artifact.id) !== expected.artifactId ||
    artifact.name !== expected.artifactName ||
    artifact.digest !== expected.artifactDigest ||
    Number(artifact.size_in_bytes) !== expected.artifactSizeBytes ||
    artifact.created_at !== expected.artifactCreatedAt ||
    artifact.expired !== false ||
    artifact.expires_at !== expected.expiresAt ||
    !artifactRun ||
    String(artifactRun.id) !== expected.runId ||
    artifactRun.head_branch !== expected.runBranch ||
    artifactRun.head_sha !== expected.controlSha ||
    Number(artifactRun.repository_id) !== expected.repositoryId
  )
    fail("backup_artifact_identity_mismatch");

  const expiryTime = Date.parse(artifact.expires_at);
  if (
    !Number.isFinite(expiryTime) ||
    !(now instanceof Date) ||
    !Number.isFinite(now.getTime())
  ) {
    fail("backup_artifact_expiry_invalid");
  }
  if (now.getTime() >= expiryTime) fail("backup_artifact_expired");

  return {
    runId: expected.runId,
    artifactId: expected.artifactId,
    artifactName: expected.artifactName,
    artifactDigest: expected.artifactDigest,
    artifactSizeBytes: expected.artifactSizeBytes,
    expiresAt: expected.expiresAt,
    sourceControlSha: expected.controlSha,
  };
}

export function createTransferProvenance(
  metadata,
  archiveSha256,
  capturedAt,
  trustedMainSha,
) {
  if (
    !metadata ||
    archiveSha256 !== PINNED_ARTIFACT.artifactDigest.slice("sha256:".length) ||
    metadata.runId !== PINNED_ARTIFACT.runId ||
    metadata.artifactId !== PINNED_ARTIFACT.artifactId ||
    metadata.artifactName !== PINNED_ARTIFACT.artifactName ||
    metadata.artifactDigest !== PINNED_ARTIFACT.artifactDigest ||
    metadata.artifactSizeBytes !== PINNED_ARTIFACT.artifactSizeBytes ||
    metadata.expiresAt !== PINNED_ARTIFACT.expiresAt ||
    metadata.sourceControlSha !== PINNED_ARTIFACT.controlSha ||
    !/^[a-f0-9]{40}$/.test(trustedMainSha ?? "")
  ) {
    fail("backup_archive_digest_mismatch");
  }
  const capturedTime = Date.parse(capturedAt);
  if (!Number.isFinite(capturedTime) || capturedTime > Date.now())
    fail("backup_acquisition_time_invalid");
  return {
    format: "dpg-encrypted-artifact-transfer-v1",
    repository: "tranhuunguyenhuy-hue/dongphugia.com.vn",
    runId: metadata.runId,
    artifactId: metadata.artifactId,
    artifactName: metadata.artifactName,
    artifactDigest: metadata.artifactDigest,
    artifactSizeBytes: metadata.artifactSizeBytes,
    archiveSha256,
    trustedMainSha,
    expiresAt: metadata.expiresAt,
    capturedAt,
    sourceControlSha: metadata.sourceControlSha,
    prNumber: PINNED_ARTIFACT.prNumber,
    candidateSha: PINNED_ARTIFACT.candidateSha,
    mergeSha: PINNED_ARTIFACT.mergeSha,
  };
}

export function validateTransferProvenance(
  provenance,
  archiveSha256,
  trustedMainSha,
  now = new Date(),
) {
  const expectedFields = [
    "format",
    "repository",
    "runId",
    "artifactId",
    "artifactName",
    "artifactDigest",
    "artifactSizeBytes",
    "archiveSha256",
    "trustedMainSha",
    "expiresAt",
    "capturedAt",
    "sourceControlSha",
    "prNumber",
    "candidateSha",
    "mergeSha",
  ].sort();
  if (
    !provenance ||
    typeof provenance !== "object" ||
    Array.isArray(provenance) ||
    canonicalJson(Object.keys(provenance).sort()) !==
      canonicalJson(expectedFields) ||
    provenance.format !== "dpg-encrypted-artifact-transfer-v1" ||
    provenance.repository !== "tranhuunguyenhuy-hue/dongphugia.com.vn" ||
    provenance.runId !== PINNED_ARTIFACT.runId ||
    provenance.artifactId !== PINNED_ARTIFACT.artifactId ||
    provenance.artifactName !== PINNED_ARTIFACT.artifactName ||
    provenance.artifactDigest !== PINNED_ARTIFACT.artifactDigest ||
    provenance.artifactSizeBytes !== PINNED_ARTIFACT.artifactSizeBytes ||
    provenance.archiveSha256 !==
      PINNED_ARTIFACT.artifactDigest.slice("sha256:".length) ||
    provenance.trustedMainSha !== trustedMainSha ||
    !/^[a-f0-9]{40}$/.test(trustedMainSha ?? "") ||
    archiveSha256 !== PINNED_ARTIFACT.artifactDigest.slice("sha256:".length) ||
    provenance.expiresAt !== PINNED_ARTIFACT.expiresAt ||
    provenance.sourceControlSha !== PINNED_ARTIFACT.controlSha ||
    provenance.prNumber !== PINNED_ARTIFACT.prNumber ||
    provenance.candidateSha !== PINNED_ARTIFACT.candidateSha ||
    provenance.mergeSha !== PINNED_ARTIFACT.mergeSha
  )
    fail("backup_transfer_provenance_mismatch");
  const capturedTime = Date.parse(provenance.capturedAt);
  const expiryTime = Date.parse(PINNED_ARTIFACT.expiresAt);
  if (!Number.isFinite(capturedTime) || !Number.isFinite(now?.getTime?.()))
    fail("backup_transfer_time_invalid");
  if (
    capturedTime > now.getTime() ||
    now.getTime() >= expiryTime ||
    capturedTime >= expiryTime
  ) {
    fail("backup_transfer_expired_or_future");
  }
  return {
    status: "verified",
    artifactId: PINNED_ARTIFACT.artifactId,
    archiveSha256,
    expiresAt: PINNED_ARTIFACT.expiresAt,
  };
}

export function validateArtifactArchiveMembers(members) {
  if (
    !Array.isArray(members) ||
    members.length !== ARCHIVE_MEMBERS.length ||
    members.some(
      (member) =>
        typeof member !== "string" ||
        member.includes("/") ||
        member.includes("\\") ||
        member === "." ||
        member === "..",
    ) ||
    new Set(members).size !== ARCHIVE_MEMBERS.length ||
    ARCHIVE_MEMBERS.some((expected) => !members.includes(expected))
  )
    fail("backup_archive_members_invalid");
  return [...members].sort();
}

export function validateArtifactPackage(actualDigest, actualSizeBytes) {
  if (
    actualDigest !== PINNED_ARTIFACT.artifactDigest.slice("sha256:".length) ||
    Number(actualSizeBytes) !== PINNED_ARTIFACT.artifactSizeBytes
  )
    fail("backup_artifact_package_mismatch");
  return { status: "verified", artifactId: PINNED_ARTIFACT.artifactId };
}

export function validateTmpfsCapacity(
  filesystemType,
  availableBytes,
  requiredBytes,
) {
  const available = Number(availableBytes);
  const required = Number(requiredBytes);
  if (filesystemType !== "tmpfs") fail("offline_tmpfs_required");
  if (
    !Number.isSafeInteger(available) ||
    available < 0 ||
    !Number.isSafeInteger(required) ||
    required <= 0
  )
    fail("offline_tmpfs_capacity_invalid");
  if (available < required) fail("offline_tmpfs_capacity_insufficient");
  return { status: "verified", requiredBytes: required };
}

export function verifySignedOfflineAttestation({
  attestation,
  signature,
  publicKeyPem,
  expectedPublicKeySha256,
  expectedPolicySha256,
  expectedChallenge,
  expectedHostId,
  expectedBootId,
  operatorId,
  now = new Date(),
}) {
  if (
    !attestation ||
    typeof attestation !== "object" ||
    Array.isArray(attestation)
  ) {
    fail("offline_attestation_invalid");
  }
  const expectedFields = [
    "format",
    "challenge",
    "hostId",
    "bootId",
    "policySha256",
    "issuedAt",
    "expiresAt",
    "operatorId",
    "reviewerId",
    "verificationMethod",
    "controls",
  ].sort();
  if (
    canonicalJson(Object.keys(attestation).sort()) !==
    canonicalJson(expectedFields)
  ) {
    fail("offline_attestation_fields_invalid");
  }
  if (
    attestation.format !== ATTESTATION_FORMAT ||
    attestation.challenge !== expectedChallenge ||
    attestation.hostId !== expectedHostId ||
    attestation.bootId !== expectedBootId ||
    attestation.policySha256 !== expectedPolicySha256 ||
    !/^[a-f0-9]{64}$/.test(expectedChallenge ?? "") ||
    !/^[a-f0-9]{64}$/.test(expectedPolicySha256 ?? "") ||
    !expectedHostId ||
    !expectedBootId
  )
    fail("offline_attestation_binding_mismatch");
  if (
    attestation.operatorId !== operatorId ||
    !attestation.reviewerId ||
    attestation.reviewerId === operatorId ||
    attestation.verificationMethod !== "out-of-band-host-console"
  ) {
    fail("offline_attestation_independent_review_missing");
  }
  if (attestation.controls?.physicalIsolationMaintainedThroughReplay !== true) {
    fail("physical_isolation_lifetime_required");
  }
  if (
    canonicalJson(attestation.controls) !==
    canonicalJson(REQUIRED_DENY_ALL_CONTROLS)
  ) {
    fail("offline_attestation_egress_policy_not_deny_all");
  }

  const issuedAt = Date.parse(attestation.issuedAt);
  const expiresAt = Date.parse(attestation.expiresAt);
  if (
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    !Number.isFinite(now?.getTime?.())
  ) {
    fail("offline_attestation_time_invalid");
  }
  const maximumValidityMs = 60 * 60 * 1000;
  if (
    issuedAt > now.getTime() ||
    expiresAt <= now.getTime() ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > maximumValidityMs
  )
    fail("offline_attestation_expired");

  if (
    typeof publicKeyPem !== "string" ||
    typeof expectedPublicKeySha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(expectedPublicKeySha256)
  )
    fail("offline_attestation_key_pin_required");
  const actualKeyPin = createHash("sha256").update(publicKeyPem).digest("hex");
  if (actualKeyPin !== expectedPublicKeySha256)
    fail("offline_attestation_key_pin_mismatch");
  const publicKey = createPublicKey(publicKeyPem);
  if (publicKey.asymmetricKeyType !== "ed25519")
    fail("offline_attestation_key_type_invalid");
  if (
    typeof signature !== "string" ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      signature,
    )
  ) {
    fail("offline_attestation_signature_invalid");
  }
  const signatureBytes = Buffer.from(signature, "base64");
  if (
    !verify(
      null,
      Buffer.from(canonicalJson(attestation)),
      publicKey,
      signatureBytes,
    )
  ) {
    fail("offline_attestation_signature_invalid");
  }
  return {
    status: "verified",
    hostId: attestation.hostId,
    policySha256: attestation.policySha256,
  };
}

export function buildSanitizedReplayEvidence(manifest, metrics) {
  if (
    !manifest ||
    manifest.contract !== "dongphugia:catalogue-filtered-restore:v1" ||
    !Array.isArray(manifest.tables) ||
    manifest.tables.length !== 27 ||
    !Array.isArray(manifest.excludedRows) ||
    manifest.excludedRows.length !== 0 ||
    !metrics ||
    !Number.isSafeInteger(metrics.databaseBytes) ||
    metrics.databaseBytes < 0 ||
    !Number.isSafeInteger(metrics.durationSeconds) ||
    metrics.durationSeconds < 0
  ) {
    fail("offline_replay_evidence_contract_invalid");
  }
  const tableNames = manifest.tables.map((entry) => entry?.tableName);
  if (
    new Set(tableNames).size !== CATALOGUE_RESTORE_ORDER.length ||
    CATALOGUE_RESTORE_ORDER.some((tableName) => !tableNames.includes(tableName))
  ) {
    fail("offline_replay_evidence_table_set_invalid");
  }
  const tables = manifest.tables
    .map((entry) => {
      if (
        !entry ||
        !/^[a-z][a-z0-9_]*$/.test(entry.tableName ?? "") ||
        !Number.isSafeInteger(entry.rowCount) ||
        entry.rowCount < 0 ||
        !/^[a-f0-9]{64}$/.test(entry.sha256 ?? "")
      )
        fail("offline_replay_evidence_table_invalid");
      return { tableName: entry.tableName, rowCount: entry.rowCount };
    })
    .sort((left, right) =>
      left.tableName < right.tableName
        ? -1
        : left.tableName > right.tableName
          ? 1
          : 0,
    );
  return {
    contract: manifest.contract,
    tableCount: tables.length,
    excludedRows: 0,
    databaseBytes: metrics.databaseBytes,
    durationSeconds: metrics.durationSeconds,
    tables,
  };
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === "pinned-json") {
    process.stdout.write(`${JSON.stringify(PINNED_ARTIFACT)}\n`);
    return;
  }
  if (mode === "validate-metadata") {
    const [runPath, artifactPath, nowText] = args;
    const [runText, artifactText] = await Promise.all([
      (await import("node:fs/promises")).readFile(runPath, "utf8"),
      (await import("node:fs/promises")).readFile(artifactPath, "utf8"),
    ]);
    const result = validateArtifactMetadata(
      JSON.parse(runText),
      JSON.parse(artifactText),
      new Date(nowText),
    );
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (mode === "validate-archive-members") {
    const { readFile } = await import("node:fs/promises");
    const members = (await readFile(args[0], "utf8"))
      .split(/\r?\n/)
      .filter(Boolean);
    process.stdout.write(
      `${JSON.stringify(validateArtifactArchiveMembers(members))}\n`,
    );
    return;
  }
  if (mode === "verify-package") {
    process.stdout.write(
      `${JSON.stringify(validateArtifactPackage(args[0], args[1]))}\n`,
    );
    return;
  }
  if (mode === "validate-tmpfs") {
    const result = validateTmpfsCapacity(args[0], args[1], args[2]);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (mode === "create-provenance") {
    const { readFile, writeFile } = await import("node:fs/promises");
    const metadata = JSON.parse(await readFile(args[0], "utf8"));
    const result = createTransferProvenance(
      metadata,
      args[1],
      args[2],
      args[3],
    );
    await writeFile(args[4], `${JSON.stringify(result, null, 2)}\n`, {
      mode: 0o600,
      flag: "wx",
    });
    process.stdout.write("OFFLINE_CATALOGUE_PROVENANCE status=PASS\n");
    return;
  }
  if (mode === "validate-provenance") {
    const { readFile } = await import("node:fs/promises");
    const result = validateTransferProvenance(
      JSON.parse(await readFile(args[0], "utf8")),
      args[1],
      args[2],
      new Date(args[3]),
    );
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (mode === "verify-attestation") {
    const { readFile } = await import("node:fs/promises");
    const [
      attestationPath,
      signaturePath,
      publicKeyPath,
      keyPin,
      policySha,
      challenge,
      hostId,
      bootId,
      operatorId,
    ] = args;
    const [attestationText, signatureText, publicKeyPem] = await Promise.all([
      readFile(attestationPath, "utf8"),
      readFile(signaturePath, "utf8"),
      readFile(publicKeyPath, "utf8"),
    ]);
    const result = verifySignedOfflineAttestation({
      attestation: JSON.parse(attestationText),
      signature: signatureText.trim(),
      publicKeyPem,
      expectedPublicKeySha256: keyPin,
      expectedPolicySha256: policySha,
      expectedChallenge: challenge,
      expectedHostId: hostId,
      expectedBootId: bootId,
      operatorId,
    });
    process.stdout.write(
      `OFFLINE_EGRESS_ATTESTATION status=PASS host=${result.hostId} policy_sha256=${result.policySha256}\n`,
    );
    return;
  }
  if (mode === "sanitize-evidence") {
    const { readFile, writeFile } = await import("node:fs/promises");
    const manifest = JSON.parse(await readFile(args[0], "utf8"));
    const metrics = JSON.parse(await readFile(args[1], "utf8"));
    const evidence = buildSanitizedReplayEvidence(manifest, metrics);
    await writeFile(args[2], `${JSON.stringify(evidence, null, 2)}\n`, {
      mode: 0o600,
      flag: "wx",
    });
    process.stdout.write(
      "OFFLINE_REPLAY_EVIDENCE status=PASS sanitized=true\n",
    );
    return;
  }
  fail("usage_invalid");
}

if (process.argv[1]?.endsWith("/offline-catalogue-transfer-contract.mjs")) {
  void main().catch((error) => {
    const reason =
      error instanceof Error && /^[a-z0-9_-]+$/.test(error.message)
        ? error.message
        : "contract_validation_failed";
    process.stderr.write(
      `OFFLINE_CATALOGUE_CONTRACT status=FAIL reason=${reason}\n`,
    );
    process.exitCode = 1;
  });
}
