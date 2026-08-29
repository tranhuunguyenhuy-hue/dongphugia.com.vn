import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertPreviewArtifact, hashArtifact, writeCandidateEvidence } from './preview-artifact-contract.mts'

async function fixture() {
  const output = await mkdtemp(path.join(os.tmpdir(), 'dongphugia-preview-contract-'))
  await writeFile(path.join(output, 'index.html'), '<meta name="robots" content="noindex,nofollow">')
  await writeFile(path.join(output, 'blog.html'), '<meta name="robots" content="noindex,nofollow"><img src="https://cdn.dongphugia.com.vn/blog/cover.webp">')
  await writeFile(path.join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n')
  await writeFile(path.join(output, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n')
  await writeFile(path.join(output, 'static-build-report.json'), JSON.stringify({
    contract: 'dongphugia:public-static-build:v1', mode: 'preview', routes: { products: 4_033, blogPosts: 1 }, seo: { bunnyMediaPreserved: true },
  }))
  return output
}

describe('static preview artifact contract', () => {
  it('requires noindex in HTML, headers, and robots controls and emits identity evidence', async () => {
    const output = await fixture()
    const evidencePath = path.join(output, 'evidence', 'candidate.json')
    try {
      const checked = await assertPreviewArtifact(output)
      expect(checked.noindex).toEqual({ htmlMeta: true, headers: true, robots: true })
      expect(checked).toMatchObject({ blog: { staticPosts: 1 }, media: { bunnyMediaReferenced: true } })
      const firstHash = await hashArtifact(output)
      const evidence = await writeCandidateEvidence({
        output, evidencePath, sourceCommit: 'a'.repeat(40), prNumber: '535', workflowRunId: '123',
        migrationManifestPath: path.join(output, 'missing-checksums.sha256'),
      })
      expect(evidence.candidate).toMatchObject({ sourceCommit: 'a'.repeat(40), pullRequest: 535, workflowRunId: '123', shadowContractSha256: expect.stringMatching(/^[0-9a-f]{64}$/) })
      expect(evidence.candidate.artifactSha256).toBe(firstHash)
      expect(evidence.shadow).toMatchObject({ environment: 'preview', supabase: { project: 'dongphugia-runtime' }, sideEffects: { productionWritesAllowed: false } })
      await expect(readFile(evidencePath, 'utf8')).resolves.toContain('artifactSha256')
    } finally {
      await rm(output, { recursive: true, force: true })
    }
  })

  it('fails closed when one HTML document loses noindex', async () => {
    const output = await fixture()
    try {
      await writeFile(path.join(output, 'missing-noindex.html'), '<meta name="robots" content="index,follow">')
      await expect(assertPreviewArtifact(output)).rejects.toThrow('PREVIEW_ARTIFACT_NOINDEX_FAILED')
    } finally {
      await rm(output, { recursive: true, force: true })
    }
  })
})
