import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  collectAppArtifact,
  recomputeAppArtifactDigest,
} from './app-artifact'

async function makeBuildOutput(files: Record<string, string>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dongphugia-leo563-build-'))
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath)
    await import('node:fs/promises').then(({ mkdir }) => mkdir(path.dirname(filePath), { recursive: true }))
    await writeFile(filePath, content, 'utf8')
  }
  return root
}

describe('LEO-563 deterministic application artifacts', () => {
  const sourceCommit = '8b96aecb8c34cc46079f292369aa961d9e5c2020'

  it('produces stable, distinct Public/Admin artifact identities', async () => {
    const publicBuild = await makeBuildOutput({
      'server/app/page.js': 'public-shell',
      'BUILD_ID': sourceCommit,
      'cache/ignored': 'volatile',
      'diagnostics/ignored.json': 'volatile',
      'required-server-files.json': 'machine-local',
      'trace-build/ignored': 'volatile',
      'types/ignored.d.ts': 'generated',
    })
    const adminBuild = await makeBuildOutput({
      'server/app/page.js': 'admin-shell',
      'BUILD_ID': sourceCommit,
      'build/ignored.js': 'builder-local',
      'trace/ignored': 'volatile',
    })
    const artifactRoot = await mkdtemp(path.join(os.tmpdir(), 'dongphugia-leo563-artifacts-'))

    try {
      const publicManifest = await collectAppArtifact({
        application: 'public',
        buildDir: publicBuild,
        artifactRoot: path.join(artifactRoot, 'public'),
        sourceCommit,
        buildTarget: 'public-worker-static-assets',
        previewNoindex: true,
      })
      const adminManifest = await collectAppArtifact({
        application: 'admin',
        buildDir: adminBuild,
        artifactRoot: path.join(artifactRoot, 'admin'),
        sourceCommit,
        buildTarget: 'admin-independent-private-runtime',
        previewNoindex: true,
      })

      expect(publicManifest.artifactSha256).not.toBe(adminManifest.artifactSha256)
      expect(publicManifest.artifactSha256).toBe(
        (await recomputeAppArtifactDigest(path.join(artifactRoot, 'public'), publicManifest)).artifactSha256,
      )
      expect(adminManifest.artifactSha256).toBe(
        (await recomputeAppArtifactDigest(path.join(artifactRoot, 'admin'), adminManifest)).artifactSha256,
      )
      expect(publicManifest.sourceCommit).toBe(sourceCommit)
      expect(publicManifest.preview.noindex).toEqual({ htmlMeta: true, headers: true, robots: true })
      expect(JSON.parse(await readFile(path.join(artifactRoot, 'public', 'artifact-manifest.json'), 'utf8')).payload.fileCount).toBe(2)
    } finally {
      await Promise.all([rm(publicBuild, { recursive: true, force: true }), rm(adminBuild, { recursive: true, force: true }), rm(artifactRoot, { recursive: true, force: true })])
    }
  })
})
