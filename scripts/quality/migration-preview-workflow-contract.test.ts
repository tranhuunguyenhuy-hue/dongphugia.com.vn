import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/migration-preview.yml'), 'utf8')
const buildGuide = readFileSync(resolve(process.cwd(), 'docs/deploy/public-static-build.md'), 'utf8')
const artifactContract = readFileSync(resolve(process.cwd(), 'scripts/static-build/preview-artifact-contract.mts'), 'utf8')

describe('migration PR CI and Preview workflow contract', () => {
  it('runs required CI and consumes the merged static build contract', () => {
    for (const marker of ['pull_request:', 'branches: [main]', 'npm run lint', 'npm run typecheck', 'npm test', 'npm run static:check', 'npm run static:build', 'npm run static:verify-preview-source', 'PUBLIC_STATIC_BUILD_READ_ONLY', 'PUBLIC_STATIC_BUILD_DB_ROLE: dpg_readonly', 'PUBLIC_STATIC_BUILD_SCHEMA: dpg_app', 'MIGRATION_PREVIEW_DATABASE_URL', 'actions/upload-artifact@v4']) {
      expect(workflow).toContain(marker)
    }
  })

  it('locks free-tier, immutable identity, and noindex checks', () => {
    for (const marker of ['static:verify-preview', 'artifactSha256', 'sourceCommit', 'workflowRunId', 'migrationManifestSha256', 'CLOUDFLARE_PAGES_PREVIEW_ENABLED', 'CLOUDFLARE_PAGES_PREVIEW_PROJECT', 'noindex, nofollow', 'noindex,nofollow', 'Disallow: /', '20_000', '25 * 1024 * 1024']) {
      expect(`${workflow}\n${buildGuide}\n${artifactContract}`).toContain(marker)
    }
  })

  it('contains no deletion, traffic, or elevated GitHub permission path', () => {
    for (const forbidden of ['pages secret', 'pages deployment delete', 'deployments: write', 'cloudflared tunnel', 'aws ', 'PRODUCTION_DATABASE_URL']) {
      expect(workflow.toLowerCase()).not.toContain(forbidden.toLowerCase())
    }
    expect(workflow).toContain('production_branch: "main"')
    expect(workflow).toContain('Custom domains: none')
    expect(workflow).toContain('BLOCKED_BY_OWNER_GATE')
    expect(workflow).toContain('CI failure blocks the Preview/merge path.')
  })
})
