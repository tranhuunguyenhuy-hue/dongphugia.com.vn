import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const workflow = readFileSync(resolve(root, '.github/workflows/migration-preview.yml'), 'utf8')
const changeGate = readFileSync(resolve(root, 'scripts/app-foundation/preview-change-gate.mjs'), 'utf8')
const foundationDoc = readFileSync(resolve(root, 'docs/deploy/leo-563-app-foundation.md'), 'utf8')
const contracts = readFileSync(resolve(root, 'packages/app-contracts/src/index.ts'), 'utf8')
const publicConfig = readFileSync(resolve(root, 'apps/public/next.config.ts'), 'utf8')
const publicProxy = readFileSync(resolve(root, 'apps/public/proxy.ts'), 'utf8')
const publicPage = readFileSync(resolve(root, 'apps/public/app/page.tsx'), 'utf8')
const publicWorker = readFileSync(resolve(root, 'apps/public/worker.ts'), 'utf8')
const publicWorkerPolicy = readFileSync(resolve(root, 'apps/public/src/worker-policy.ts'), 'utf8')
const publicLayout = readFileSync(resolve(root, 'apps/public/app/layout.tsx'), 'utf8')
const publicRobots = readFileSync(resolve(root, 'apps/public/app/robots.txt/route.ts'), 'utf8')
const adminConfig = readFileSync(resolve(root, 'apps/admin/next.config.ts'), 'utf8')
const adminProxy = readFileSync(resolve(root, 'apps/admin/proxy.ts'), 'utf8')
const adminSessionProxy = readFileSync(resolve(root, 'apps/admin/src/supabase/proxy.ts'), 'utf8')
const adminLayout = readFileSync(resolve(root, 'apps/admin/app/layout.tsx'), 'utf8')

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = resolve(directory, entry.name)
    if (entry.isDirectory() && !['.next', 'node_modules'].includes(entry.name)) return filesUnder(filePath)
    return entry.isFile() ? [filePath] : []
  })
}

function sourceImports(directory: string) {
  return filesUnder(directory).flatMap((filePath) => {
    if (!/\.(mjs|ts|tsx)$/.test(filePath) || filePath.endsWith('.d.ts')) return []
    const source = readFileSync(filePath, 'utf8')
    return [...source.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g)].map((match) => match[2])
  })
}

describe('LEO-563 application foundation contract', () => {
  it('has independent package/config/build seams and pure shared contracts', () => {
    for (const file of [
      'apps/public/package.json',
      'apps/public/next.config.ts',
      'apps/public/tsconfig.json',
      'apps/admin/package.json',
      'apps/admin/next.config.ts',
      'apps/admin/tsconfig.json',
      'packages/app-contracts/package.json',
    ]) expect(statSync(resolve(root, file)).isFile()).toBe(true)

    expect(contracts).not.toMatch(/from\s+['"](?:next|react|node:)/)
    expect(contracts).toContain('PUBLIC_ROUTE_OWNERSHIP')
    expect(contracts).toContain('ADMIN_ROUTE_OWNERSHIP')
  })

  it('keeps Public and Admin imports/runtime/session seams separate', () => {
    expect(sourceImports(resolve(root, 'apps/public'))).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/apps\/admin|admin-auth|admin-session|supabase|service.role|prisma/i),
    ]))
    const publicSources = filesUnder(resolve(root, 'apps/public'))
    const pgImportSources = publicSources.filter((filePath) =>
      /(?:from\s+|import\s*\()(['\"])pg\1/.test(readFileSync(filePath, 'utf8')),
    )
    expect(pgImportSources).toEqual([resolve(root, 'apps/public/src/runtime/public-db.ts')])
    expect(readFileSync(resolve(root, 'apps/public/src/runtime/public-db.ts'), 'utf8'))
      .toContain('PUBLIC_DATABASE_READ_ONLY_REQUIRED')
    expect(sourceImports(resolve(root, 'apps/admin'))).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/apps\/public|public-cookie|src\/lib\/prisma|src\/lib\/auth|service.role|prisma|\bpg\b|database/i),
    ]))
    expect(readFileSync(resolve(root, 'apps/public/app/layout.tsx'), 'utf8')).toContain("runtime = 'edge'")
    expect(readFileSync(resolve(root, 'apps/admin/app/layout.tsx'), 'utf8')).toContain("runtime = 'nodejs'")
    expect(readFileSync(resolve(root, 'apps/public/src/config/env.ts'), 'utf8')).toContain('PUBLIC_PRIVILEGED_BROWSER_ENV_FORBIDDEN')
    expect(readFileSync(resolve(root, 'apps/admin/src/config/env.ts'), 'utf8')).toContain('ADMIN_PRIVILEGED_BROWSER_ENV_FORBIDDEN')
  })

  it('locks route ownership, noindex, and cache/no-store baselines', () => {
    expect(publicPage).toContain("export const dynamic = 'force-dynamic'")
    expect(publicLayout).toContain('index: false')
    expect(publicConfig).toContain("X-Robots-Tag")
    expect(publicRobots).toContain('Disallow: /')
    expect(publicProxy).toContain('s-maxage=300')
    expect(publicWorkerPolicy).toContain('public, max-age=${PUBLIC_EDGE_CACHE_SECONDS}, must-revalidate')
    expect(publicWorker).toContain("caches.open('dongphugia-public-v1')")
    expect(`${publicWorker}\n${publicWorkerPolicy}`).not.toContain('stale-while-revalidate')
    expect(adminConfig).toContain("Cache-Control', value: 'private, no-store'")
    expect(`${adminProxy}\n${adminSessionProxy}`).toContain("private, no-store")
    expect(adminConfig).toContain("X-Robots-Tag', value: 'noindex, nofollow'")
    expect(adminLayout).toContain('index: false')
  })

  it('does not introduce a Figma-dependent application implementation', () => {
    for (const filePath of [
      ...filesUnder(resolve(root, 'apps/public')),
      ...filesUnder(resolve(root, 'apps/admin')),
    ].filter((filePath) => /\.(css|mjs|ts|tsx)$/.test(filePath))) {
      expect(readFileSync(filePath, 'utf8').toLowerCase()).not.toContain('figma')
    }
  })

  it('keeps the current app CI local-only and removes the old Cloudflare Preview publisher', () => {
    for (const marker of [
      'repo-code-gate:',
      'preview_required',
      'apps/public/',
      'apps/admin/',
      'packages/app-contracts/',
      'Local-only Preview gate',
      'without external Preview publication',
      'SKIPPED_UNRELATED_CHANGE',
    ]) expect(`${workflow}\n${changeGate}`).toContain(marker)

    expect(workflow).not.toContain('workflow_dispatch:')
    expect(workflow).not.toMatch(/CLOUDFLARE|WRANGLER|workers\.dev|versions upload|wrangler deploy/i)
    expect(workflow).not.toContain('dongphugia-v1-public-preview')
  })

  it('marks the earlier independent Cloudflare Preview plan as historical', () => {
    expect(foundationDoc).toContain('(historical)')
    expect(foundationDoc).toContain('Superseded for current Preview and Staging by PR #294')
    expect(foundationDoc).toContain('preview-staging-worker-foundation.md')
  })
})
