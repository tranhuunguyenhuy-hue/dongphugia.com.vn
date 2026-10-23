import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const productionConfigPath = path.join(repositoryRoot, 'apps/public/wrangler.production.jsonc')
const workflowPath = path.join(repositoryRoot, '.github/workflows/r1-public-worker-production.yml')
const runbookPath = path.join(repositoryRoot, 'docs/deploy/r1-worker-production-release.md')
const workflowSource = readFileSync(workflowPath, 'utf8')
type ProductionConfig = {
  name: string
  compatibility_date: string
  main: string
  workers_dev: boolean
  preview_urls: boolean
  assets: { directory: string, not_found_handling: string, binding: string }
  vars: { APP_ENV: string, APP_BUILD_TARGET: string, APP_ORIGIN: string, PREVIEW_NOINDEX: string }
  [key: string]: unknown
}
type ReleaseWorkflow = {
  on?: { workflow_dispatch?: { inputs: { owner_go_comment_id: { required: boolean } } } }
  jobs: { 'read-only-release-gate': { if: string, environment: { name: string } } }
}
const productionConfig = JSON.parse(readFileSync(productionConfigPath, 'utf8')) as ProductionConfig
const workflow = yaml.load(workflowSource) as ReleaseWorkflow
const releaseRunbook = readFileSync(runbookPath, 'utf8')

describe('R1 Worker Production release preparation contract', () => {
  it('keeps a distinct production candidate with only public assets and explicit production vars', () => {
    expect(productionConfig).toMatchObject({
      name: 'dongphugia-v1-public-production-candidate',
      compatibility_date: '2026-08-30',
      main: 'dist/server/index.js',
      workers_dev: false,
      preview_urls: false,
      assets: { directory: 'dist/client', not_found_handling: 'none', binding: 'ASSETS' },
      vars: {
        APP_ENV: 'production',
        APP_BUILD_TARGET: 'public',
        APP_ORIGIN: 'https://www.dongphugia.vn',
        PREVIEW_NOINDEX: 'false',
      },
    })
    expect(productionConfig.name).not.toBe('dongphugia-v1-public-preview')
    expect(productionConfig).not.toHaveProperty('routes')
    expect(productionConfig).not.toHaveProperty('route')
    expect(productionConfig).not.toHaveProperty('custom_domains')
    expect(productionConfig).not.toHaveProperty('bindings')
    expect(JSON.stringify(productionConfig)).not.toMatch(/DATABASE_URL|SUPABASE|CLOUDFLARE_API_TOKEN|secret/i)
  })

  it('is manual-only, disabled by default, Owner/environment gated, and never deploys', () => {
    const triggers = workflow.on ?? workflow['on']
    expect(Object.keys(triggers)).toEqual(['workflow_dispatch'])
    expect(triggers.workflow_dispatch.inputs.owner_go_comment_id.required).toBe(true)
    expect(workflow.jobs['read-only-release-gate'].if).toContain("github.ref == 'refs/heads/main'")
    expect(workflow.jobs['read-only-release-gate'].if).toContain("github.actor == 'tranhuunguyenhuy-hue'")
    expect(workflow.jobs['read-only-release-gate'].if).toContain("vars.R1_PUBLIC_WORKER_PRODUCTION_RELEASE_ENABLED == 'true'")
    expect(workflow.jobs['read-only-release-gate'].environment.name).toBe('production')
    expect(workflowSource).toContain('prevent_self_review == true')
    expect(workflowSource).toContain('OWNER GO — R1 WORKER PRODUCTION RELEASE')
    expect(workflowSource).toContain('WORKERS_FREE_PLAN_CONFIRMED')
    expect(workflowSource).toContain('ACTIONS_PACKAGES_ZERO_STOP_AT_LIMIT')
    expect(workflowSource).toContain('DNS_TLS_AND_EMAIL_INVENTORY_VERIFIED')
    expect(workflowSource).toContain('ROLLBACK_TARGET_VERIFIED')
    expect(workflowSource).toContain('SOURCE_SHA')
    expect(workflowSource).toContain('ARTIFACT_SHA256')
    expect(workflowSource).toContain("jq -r '.head.sha'")
    expect(workflowSource).toContain('git merge-base --is-ancestor')
    expect(workflowSource).toContain('A2_RELEASE_EXECUTION_NOT_IMPLEMENTED')
    expect(workflowSource).not.toMatch(/secrets\.[A-Z0-9_]+|CLOUDFLARE_API_TOKEN|wrangler\s+(deploy|versions\s+deploy)|api\.cloudflare\.com/i)
    expect(workflowSource).not.toMatch(/^\s*(push|pull_request):/m)
  })

  it('documents SEO, fail-closed route behavior, DNS and an evidence-backed rollback stop', () => {
    expect(releaseRunbook).toContain('PREVIEW_NOINDEX=true')
    expect(releaseRunbook).toContain('PREVIEW_NOINDEX=false')
    expect(releaseRunbook).toMatch(/robots/i)
    expect(releaseRunbook).toMatch(/sitemap/i)
    expect(releaseRunbook).toContain('503')
    expect(releaseRunbook).toContain('Retry-After')
    expect(releaseRunbook).toContain('no-store')
    expect(releaseRunbook).toContain('ns1.matbao.com')
    expect(releaseRunbook).toContain('ns2.matbao.com')
    expect(releaseRunbook).toContain('47.131.92.97')
    expect(releaseRunbook).toMatch(/timeout/i)
    expect(releaseRunbook).toMatch(/rollback/i)
    expect(releaseRunbook).toContain('DNS_CONTROL_PLANE_UNKNOWN')
    expect(releaseRunbook).toContain('A2_RELEASE_EXECUTION_NOT_IMPLEMENTED')
    expect(releaseRunbook).toMatch(/no cutover|STOP before cutover/i)
  })
})
