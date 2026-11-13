import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { digestEnvironmentWorkerArtifact } from './environment-worker-artifact-digest.mjs'
import { verifyAdminReleaseArtifact } from './admin-release-profile.mjs'

const [root, sourceSha] = process.argv.slice(2)
if (!root || !sourceSha) throw new Error('ADMIN_RELEASE_REVIEW_INPUT_INVALID')
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'))
await verifyAdminReleaseArtifact(root, manifest, { sourceSha })
const digest = await digestEnvironmentWorkerArtifact(root)
process.stdout.write(`${JSON.stringify({ sourceSha, artifactSha256: digest.sha256, fileCount: digest.fileCount, totalBytes: digest.totalBytes })}\n`)
