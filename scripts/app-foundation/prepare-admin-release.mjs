import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { digestEnvironmentWorkerArtifact } from './environment-worker-artifact-digest.mjs'
import { reconstructAdminCapabilities, verifyAdminHyperdriveMetadata, verifyAdminReleaseArtifact } from './admin-release-profile.mjs'

// Trusted preparation only. Metadata and expected digest must come from a
// reviewed source independent of the candidate; this does not deploy anything.
export async function prepareAdminRelease({ root, sourceSha, artifactSha256, accountId, hyperdrive, expectedHyperdrive }) {
  if (accountId !== 'd54f3402b9d112ab64d6135e0e3f1fb1' || !/^[a-f0-9]{64}$/.test(artifactSha256 || '')) throw new Error('ADMIN_RELEASE_TRUSTED_IDENTITY_INVALID')
  const actual = await digestEnvironmentWorkerArtifact(root)
  if (actual.sha256 !== artifactSha256) throw new Error('ADMIN_RELEASE_ARTIFACT_DIGEST_MISMATCH')
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'))
  await verifyAdminReleaseArtifact(root, manifest, { sourceSha })
  verifyAdminHyperdriveMetadata(hyperdrive, expectedHyperdrive)
  return buildAdminWranglerConfig(expectedHyperdrive.id)
}

export function buildAdminWranglerConfig(hyperdriveId) {
  return {
    name: 'dongphugia-v1-public-production', compatibility_date: '2026-08-30', compatibility_flags: ['nodejs_compat'],
    workers_dev: true, preview_urls: false, no_bundle: true,
    rules: [
      { type: 'ESModule', globs: ['public/server/**/*.mjs', 'admin/server/**/*.mjs', 'public/server/**/*.js', 'admin/server/**/*.js'], fallthrough: false },
      { type: 'CommonJS', globs: ['public/server/**/*.cjs', 'admin/server/**/*.cjs'], fallthrough: false },
      { type: 'Text', globs: ['public/server/**/*.txt', 'admin/server/**/*.txt'], fallthrough: false },
      { type: 'Data', globs: ['public/server/**/*.bin', 'admin/server/**/*.bin'], fallthrough: false },
      { type: 'CompiledWasm', globs: ['public/server/**/*.wasm', 'admin/server/**/*.wasm'], fallthrough: false },
    ],
    ...reconstructAdminCapabilities(hyperdriveId),
  }
}

