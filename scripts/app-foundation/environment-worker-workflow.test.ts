import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const workflow = readFileSync(path.join(here, '../../.github/workflows/environment-worker-publish.yml'), 'utf8')
const tokenScopeChecker = readFileSync(path.join(here, 'verify-environment-worker-token-scope.mjs'), 'utf8')
const ciWorkflow = readFileSync(path.join(here, '../../.github/workflows/environment-worker-ci.yml'), 'utf8')
const buildScript = readFileSync(path.join(here, 'build-environment-worker.mts'), 'utf8')
const namespaceScript = readFileSync(path.join(here, 'namespace-admin-vite-rsc-globals.mjs'), 'utf8')
const localRunner = readFileSync(path.join(here, 'run-local-preview.mjs'), 'utf8')
const browserVerifier = readFileSync(path.join(here, 'environment-worker-browser.mjs'), 'utf8')
const prBuildWorkflow = readFileSync(path.join(here, '../../.github/workflows/pr-preview-build.yml'), 'utf8')

describe('Staging Worker publication workflow trust boundaries', () => {
  it('serializes one Staging target and gates pre-merge source at the exact approved PR head', () => {
    expect(workflow).toContain('group: dpg-staging-publication')
    expect(workflow).toContain('options: [main, approved-pr]')
    expect(workflow).toContain('options: [staging]')
    expect(workflow).toContain('validate-environment-worker-source.mjs')
    expect(workflow).toContain('cloudflare-${{ inputs.environment }}')
    expect(workflow).not.toContain('dpg-preview')
    expect(workflow).not.toContain('https://dpg-preview.')
  })

  it('keeps Cloudflare credentials out of candidate builds and blocks publication without supported scope proof', () => {
    const [buildJob, publishJob = ''] = workflow.split('  publish-candidate:')
    const scopeGate = publishJob.split('      - name: Block publication until supported token policy evidence is available')[1]?.split('      - name: Deploy only the selected pre-created Worker')[0] || ''
    expect(buildJob).not.toMatch(/CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID/)
    expect(buildJob.match(/GITHUB_TOKEN: \$\{\{ github\.token \}\}/g)).toHaveLength(1)
    expect(buildJob.indexOf('GITHUB_TOKEN: ${{ github.token }}'))
      .toBeGreaterThan(buildJob.indexOf('Validate the source commit and approval'))
    expect(publishJob).toContain('secrets.CLOUDFLARE_API_TOKEN')
    expect(publishJob).toContain('verify-environment-worker-token-scope.mjs')
    expect(publishJob).toContain('prepare-environment-worker-publication.mjs')
    expect(publishJob).not.toContain('CLOUDFLARE_WORKER_POLICY_SCOPE')
    expect(scopeGate).toContain('verify-environment-worker-token-scope.mjs')
    expect(scopeGate).not.toContain('secrets.CLOUDFLARE_API_TOKEN')
    expect(tokenScopeChecker).toContain('ENVIRONMENT_WORKER_TOKEN_SCOPE_PROOF_UNAVAILABLE')
    expect(publishJob.indexOf('Block publication until supported token policy evidence is available'))
      .toBeLessThan(publishJob.indexOf('Deploy only the selected pre-created Worker'))
    expect(publishJob).not.toContain('scripts/dongphugia-v1-public-production/settings')
  })

  it('publishes only the fixed Staging Worker and its matching workers.dev origin', () => {
    expect(workflow).not.toContain("'dpg-preview'")
    expect(workflow).toContain('APP_WORKER_NAME: dpg-staging')
    expect(workflow).toContain('https://dpg-staging.tranhuunguyenhuy.workers.dev')
    expect(workflow).toContain('d54f3402b9d112ab64d6135e0e3f1fb1')
    expect(workflow).toContain('fixed Production catalogue paths')
    expect(workflow).toContain('Admin auth is disabled and private data remains unavailable')
  })

  it('keeps Preview local-only and uses one origin for Public and Admin', () => {
    expect(ciWorkflow).toContain("worker_name='dpg-local-preview'")
    expect(ciWorkflow).toContain("origin='http://127.0.0.1:8787'")
    expect(ciWorkflow).not.toContain('dpg-preview')
    expect(ciWorkflow).not.toMatch(/CLOUDFLARE_(?:API_TOKEN|.*EDITOR_TOKEN)/)
    expect(buildScript).toContain("preview: { workerName: 'dpg-local-preview', origin: 'http://127.0.0.1:8787', localOnly: true }")
    expect(buildScript).toContain('workers_dev: !target.localOnly')
    expect(localRunner).toContain("const origin = 'http://127.0.0.1:8787'")
    expect(localRunner).toContain("'dev', '--local'")
    expect(prBuildWorkflow).toContain('name: PR App source build')
    expect(prBuildWorkflow).toContain('APP_ORIGIN: http://127.0.0.1:8787')
    expect(prBuildWorkflow).not.toContain('public-preview.invalid')
    expect(prBuildWorkflow).not.toContain('actions/upload-artifact')
    expect(prBuildWorkflow).not.toContain('PREVIEW_CLOUDFLARE_API_TOKEN')
  })

  it('keeps local Wrangler persistence outside the candidate before workflow upload', () => {
    expect(workflow.indexOf('environment-worker-browser.mjs'))
      .toBeLessThan(workflow.indexOf('actions/upload-artifact'))
    expect(browserVerifier).toContain("mkdtemp(path.join(os.tmpdir(), 'dpg-environment-worker-'))")
    expect(browserVerifier).toContain("'--persist-to', persistenceDirectory")
    expect(browserVerifier).toContain("rm(path.join(artifactRoot, '.wrangler'), { recursive: true, force: true })")
    expect(browserVerifier).toContain("rm(persistenceDirectory, { recursive: true, force: true })")
  })

  it('namespaces Admin RSC globals before combining both framework runtimes', () => {
    expect(buildScript).toContain('namespaceAdminViteRscGlobals')
    expect(buildScript).toContain("contract: 'dpg:combined-environment-worker:v2'")
    expect(namespaceScript).toContain('__vite_rsc_client_require__')
    expect(namespaceScript).toContain('__vite_rsc_require__')
    expect(namespaceScript).toContain('__vite_rsc_server_require__')
    expect(namespaceScript).toContain('__dpg_rsc0_')
    expect(namespaceScript).toContain('ADMIN_VITE_RSC_RUNTIME_GLOBAL_MISSING')
  })
})
