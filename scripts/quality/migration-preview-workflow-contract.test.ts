import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/migration-preview.yml'), 'utf8')
const buildGuide = readFileSync(resolve(process.cwd(), 'docs/deploy/public-static-build.md'), 'utf8')
const changeGate = readFileSync(resolve(process.cwd(), 'scripts/app-foundation/preview-change-gate.mjs'), 'utf8')
const candidateScript = readFileSync(resolve(process.cwd(), 'scripts/app-foundation/preview-candidate.mts'), 'utf8')
const cloudflareDiscovery = readFileSync(resolve(process.cwd(), 'scripts/app-foundation/cloudflare-readonly-discovery.mjs'), 'utf8')

describe('migration PR CI and Preview workflow contract', () => {
  it('runs required repository CI against the exact PR head', () => {
    for (const marker of [
      'pull_request:',
      'branches: [main]',
      'fetch-depth: 0',
      'github.event.pull_request.head.sha || github.sha',
      'npm run lint',
      'npm run typecheck',
      'npm test',
      'npm run static:check',
      'actions/upload-artifact@v4',
    ]) expect(workflow).toContain(marker)
  })

  it('builds both independent deployables and verifies immutable identities', () => {
    for (const marker of [
      'app-preview-artifact:',
      'npm run build:public-worker',
      'npm run build:admin',
      'app:collect-artifact',
      'app:create-candidate',
      'app:verify-candidate',
      'Prove deterministic Admin artifact identity',
      'sourceCommit',
      'publicArtifactSha256',
      'adminArtifactSha256',
      'artifact_ready=true',
      'noindex',
    ]) expect(`${workflow}\n${candidateScript}`).toContain(marker)

    expect(buildGuide).toContain('Worker/assets/config identities')
    expect(buildGuide).toContain('CI-only')
  })

  it('skips unrelated changes before the candidate and external Preview path', () => {
    for (const marker of [
      'APPLICATION_SOURCE_PREFIXES',
      'apps/public/',
      'apps/admin/',
      'packages/app-contracts/',
      'preview_required',
      'SKIPPED_UNRELATED_CHANGE',
      'DB/import/docs-only changes cannot reach the application candidate or Cloudflare publication path.',
    ]) expect(`${workflow}\n${changeGate}`).toContain(marker)
  })

  it('limits Cloudflare access to sanitized read-only discovery and contains no publication or traffic path', () => {
    for (const forbidden of [
      'pages project create',
      'pages deploy',
      'cloudflare/wrangler-action',
      'wrangler versions upload',
      'wrangler deploy',
      'deployments: write',
      'PRODUCTION_DATABASE_URL',
      'cloudflared tunnel',
    ]) expect(workflow.toLowerCase()).not.toContain(forbidden.toLowerCase())

    expect(workflow.match(/secrets\.CLOUDFLARE_ACCOUNT_ID/g)).toHaveLength(1)
    expect(workflow.match(/secrets\.CLOUDFLARE_API_TOKEN/g)).toHaveLength(1)
    expect(workflow).toContain('cloudflare-readonly-discovery.mjs')
    expect(workflow).toContain('Mutating API methods and Wrangler publication: not invoked.')
    expect(cloudflareDiscovery).toContain("method: 'GET'")
    for (const forbiddenMethod of ["method: 'POST'", "method: 'PUT'", "method: 'PATCH'", "method: 'DELETE'"]) {
      expect(cloudflareDiscovery).not.toContain(forbiddenMethod)
    }
    expect(workflow).toContain('BLOCKED_BY_OWNER_GATE')
    expect(`${workflow}\n${candidateScript}`).toContain('productionCustomDomain:')
    expect(`${workflow}\n${candidateScript}`).toContain('productionDnsOrTraffic:')
  })
})
