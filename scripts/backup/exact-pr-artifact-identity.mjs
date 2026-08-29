import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const SHA_PATTERN = /^[0-9a-f]{40}$/
const RUN_ID_PATTERN = /^[1-9][0-9]*$/

function assertIdentityParts(prNumber, candidateSha, controlSha, workflowRunId) {
  if (!/^[1-9][0-9]*$/.test(String(prNumber))) throw new Error('invalid_pr_number')
  if (!SHA_PATTERN.test(candidateSha) || !SHA_PATTERN.test(controlSha)) throw new Error('invalid_sha')
  if (!RUN_ID_PATTERN.test(String(workflowRunId))) throw new Error('invalid_workflow_run_id')
}

async function bundleFiles(directory) {
  const files = (await readdir(directory)).sort()
  const archives = files.filter((file) => file.endsWith('.dump.age'))
  const manifests = files.filter((file) => file.endsWith('.manifest.json'))
  const checksums = files.filter((file) => file.endsWith('.checksums.sha256'))
  if (files.length !== 3 || archives.length !== 1 || manifests.length !== 1 || checksums.length !== 1) {
    throw new Error('backup_bundle_shape_invalid')
  }
  return {
    archive: join(directory, archives[0]),
    manifest: join(directory, manifests[0]),
    checksums: join(directory, checksums[0]),
  }
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

export async function bindExactPrArtifactIdentity(directory, identity) {
  const { prNumber, candidateSha, controlSha, workflowRunId } = identity
  assertIdentityParts(prNumber, candidateSha, controlSha, workflowRunId)
  const files = await bundleFiles(directory)
  const manifest = JSON.parse(await readFile(files.manifest, 'utf8'))
  if (!Number.isInteger(manifest.formatVersion) || manifest.formatVersion < 1) throw new Error('manifest_version_invalid')
  if (typeof manifest.createdAt !== 'string' || Number.isNaN(Date.parse(manifest.createdAt))) throw new Error('backup_timestamp_invalid')

  const archiveSha256 = await sha256(files.archive)
  if (manifest.archiveSha256 !== archiveSha256) throw new Error('archive_checksum_mismatch')
  manifest.artifactIdentity = {
    prNumber: Number(prNumber),
    candidateSha,
    controlSha,
    workflowRunId: String(workflowRunId),
    backupTimestamp: manifest.createdAt,
    manifestVersion: manifest.formatVersion,
  }
  await writeFile(files.manifest, `${JSON.stringify(manifest)}\n`)
  const manifestSha256 = await sha256(files.manifest)
  await writeFile(files.checksums, `${archiveSha256}  ${files.archive.split('/').pop()}\n${manifestSha256}  ${files.manifest.split('/').pop()}\n`)
}

export async function verifyExactPrArtifactIdentity(directory, expected) {
  const { prNumber, candidateSha, controlSha, workflowRunId } = expected
  assertIdentityParts(prNumber, candidateSha, controlSha, workflowRunId)
  const files = await bundleFiles(directory)
  const manifest = JSON.parse(await readFile(files.manifest, 'utf8'))
  const identity = manifest.artifactIdentity
  if (!identity
    || identity.prNumber !== Number(prNumber)
    || identity.candidateSha !== candidateSha
    || identity.controlSha !== controlSha
    || identity.workflowRunId !== String(workflowRunId)
    || identity.backupTimestamp !== manifest.createdAt
    || identity.manifestVersion !== manifest.formatVersion) {
    throw new Error('artifact_identity_mismatch')
  }
  const archiveSha256 = await sha256(files.archive)
  if (manifest.archiveSha256 !== archiveSha256) throw new Error('archive_checksum_mismatch')
  return { manifestVersion: manifest.formatVersion, backupTimestamp: manifest.createdAt }
}

async function main() {
  const [mode, directory, prNumber, candidateSha, controlSha, workflowRunId] = process.argv.slice(2)
  if (!['bind', 'verify'].includes(mode) || !directory || !prNumber || !candidateSha || !controlSha || !workflowRunId) {
    throw new Error('usage: node exact-pr-artifact-identity.mjs bind|verify <bundle-dir> <pr-number> <candidate-sha> <control-sha> <run-id>')
  }
  const identity = { prNumber, candidateSha, controlSha, workflowRunId }
  if (mode === 'bind') await bindExactPrArtifactIdentity(directory, identity)
  else await verifyExactPrArtifactIdentity(directory, identity)
  process.stdout.write(`LEO552_ARTIFACT_IDENTITY status=PASS mode=${mode}\n`)
}

if (process.argv[1]?.endsWith('/exact-pr-artifact-identity.mjs')) void main().catch((error) => {
  process.stderr.write(`LEO552_ARTIFACT_IDENTITY status=FAIL reason=${error instanceof Error ? error.message : 'unknown'}\n`)
  process.exitCode = 1
})
