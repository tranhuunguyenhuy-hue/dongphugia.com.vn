import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertPreviewArtifact, hashArtifact, writeCandidateEvidence } from './preview-artifact-contract.mts'

async function fixture() {
  const output = await mkdtemp(path.join(os.tmpdir(), 'dongphugia-preview-contract-'))
  await mkdir(path.join(output, 'assets'), { recursive: true })
  await mkdir(path.join(output, 'images'), { recursive: true })
  const shell = '<link rel="stylesheet" data-static-ui-asset="stylesheet" href="/assets/static-ui.css"><div data-static-ui="application-shell"><header data-static-ui="header"></header><main data-static-ui="main"><div data-static-ui="homepage-hero"></div><div data-static-ui="category-listing"></div><div data-static-ui="subcategory-listing"></div><div data-static-ui="product-detail"></div><div data-static-ui="brand-listing"></div><div data-static-ui="blog-listing"></div><div data-static-ui="blog-article"></div></main><footer data-static-ui="footer"></footer></div>'
  await writeFile(path.join(output, 'index.html'), `<meta name="robots" content="noindex,nofollow">${shell}`)
  await writeFile(path.join(output, 'blog.html'), `<meta name="robots" content="noindex,nofollow">${shell}<img src="https://cdn.dongphugia.com.vn/blog/cover.webp">`)
  await writeFile(path.join(output, 'assets', 'static-ui.css'), '.dpg-static-header{} @media (max-width: 700px){}')
  await writeFile(path.join(output, 'images', 'Logo.png'), 'fixture')
  await writeFile(path.join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n')
  await writeFile(path.join(output, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n')
  await writeFile(path.join(output, 'static-build-report.json'), JSON.stringify({
    contract: 'dongphugia:public-static-build:v1', mode: 'preview', routes: { products: 4_033, blogPosts: 1 }, seo: { bunnyMediaPreserved: true },
    ui: { renderer: 'current-ui-static-adapter:v1', stylesheet: '/assets/static-ui.css', publicAssetsCopied: true },
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
      expect(checked).toMatchObject({ ui: { stylesheet: true, publicAssets: true, applicationShell: true, responsive: true } })
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
