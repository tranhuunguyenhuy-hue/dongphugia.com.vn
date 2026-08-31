import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const repositoryRoot = process.cwd()

describe('LEO-563 Public Worker artifact contract', () => {
  it('uses the pinned vinext Worker adapter and never a Pages/static adapter', async () => {
    const publicPackage = JSON.parse(await readFile(path.join(repositoryRoot, 'apps/public/package.json'), 'utf8'))
    expect(publicPackage.dependencies.vinext).toBe('1.0.0-beta.8')
    expect(publicPackage.dependencies['@vinext/cloudflare']).toBe('1.0.0-beta.6')
    expect(publicPackage.devDependencies.wrangler).toBe('4.127.1')
    expect(publicPackage.scripts['build:worker']).toContain('build-public-worker.mts')
    expect(await readFile(path.join(repositoryRoot, 'scripts/app-foundation/build-public-worker.mts'), 'utf8')).toContain("'vinext', 'dist', 'cli.js'")
    expect(publicPackage.scripts['package:worker']).toContain('wrangler deploy --dry-run')
    expect(JSON.stringify(publicPackage)).not.toMatch(/pages|static:build/i)
  })

  it('keeps the repository candidate detached from routes, domains, and publication', async () => {
    const configText = await readFile(path.join(repositoryRoot, 'apps/public/wrangler.jsonc'), 'utf8')
    const config = JSON.parse(configText)
    expect(config.main).toBe('worker.ts')
    expect(config.assets.directory).toBe('dist/client')
    expect(config.workers_dev).toBe(false)
    expect(config.preview_urls).toBe(false)
    expect(config.routes).toBeUndefined()
    expect(config.route).toBeUndefined()
    expect(config.vars.PREVIEW_NOINDEX).toBe('true')
    expect(configText).not.toMatch(/api[_-]?token|service[_-]?role|custom[_-]?domain|dns/i)
  })

  it('generates an owner-gated Preview-only Worker config from a fixed allowlist', async () => {
    const source = await readFile(path.join(repositoryRoot, 'scripts/app-foundation/public-worker-artifact.mts'), 'utf8')
    for (const marker of [
      "name: 'dongphugia-v1-public-preview'",
      'workers_dev: false',
      'preview_urls: true',
      "previewAlias: 'pr-138'",
      "activation: 'owner-gated'",
      "'wrangler.preview.json'",
    ]) expect(source).toContain(marker)
    expect(source).not.toContain('limits:')
    expect(source).not.toContain('subrequests')
    expect(source).not.toContain('cpu_ms')
    for (const forbidden of [
      'routes:',
      'route:',
      'custom_domains:',
      'www.dongphugia.vn',
      'admin.dongphugia.vn',
      'service_role',
      'database_url',
    ]) expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase())
  })

  it('uses a hard 300-second cache window without unbounded stale serving', async () => {
    const workerSource = await readFile(path.join(repositoryRoot, 'apps/public/src/worker-policy.ts'), 'utf8')
    const workerEntry = await readFile(path.join(repositoryRoot, 'apps/public/worker.ts'), 'utf8')
    const viteConfig = await readFile(path.join(repositoryRoot, 'apps/public/vite.config.ts'), 'utf8')
    expect(workerSource).toContain('PUBLIC_EDGE_CACHE_SECONDS')
    expect(workerSource).toContain('must-revalidate')
    expect(workerEntry).toContain('X-DPG-Source-SHA')
    expect(`${workerSource}\n${workerEntry}\n${viteConfig}`).not.toContain('stale-while-revalidate')
    expect(viteConfig).not.toContain('cdnAdapter')
  })
})
