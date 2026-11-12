import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const workflow = readFileSync(path.join(here, '../../.github/workflows/environment-worker-publish.yml'), 'utf8')
const ciWorkflow = readFileSync(path.join(here, '../../.github/workflows/environment-worker-ci.yml'), 'utf8')
const buildScript = readFileSync(path.join(here, 'build-environment-worker.mts'), 'utf8')
const localRunner = readFileSync(path.join(here, 'run-local-preview.mjs'), 'utf8')

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

  it('keeps Cloudflare credentials out of candidate builds and gates publication on reviewed scope evidence', () => {
    const [buildJob, publishJob = ''] = workflow.split('  publish-candidate:')
    expect(buildJob).not.toMatch(/CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID/)
    expect(buildJob.match(/GITHUB_TOKEN: \$\{\{ github\.token \}\}/g)).toHaveLength(1)
    expect(buildJob.indexOf('GITHUB_TOKEN: ${{ github.token }}'))
      .toBeGreaterThan(buildJob.indexOf('Validate the source commit and approval'))
    expect(publishJob).toContain('secrets.CLOUDFLARE_API_TOKEN')
    expect(publishJob).toContain('verify-environment-worker-token-scope.mjs')
    expect(publishJob).toContain('prepare-environment-worker-publication.mjs')
    expect(publishJob).toContain('CLOUDFLARE_WORKER_POLICY_SCOPE')
    expect(publishJob).toContain('individual-worker:dpg-staging:editor')
    expect(publishJob).not.toContain('scripts/dongphugia-v1-public-production/settings')
  })

  it('publishes only the fixed Staging Worker and its matching workers.dev origin', () => {
    expect(workflow).not.toContain("'dpg-preview'")
    expect(workflow).toContain('APP_WORKER_NAME: dpg-staging')
    expect(workflow).toContain('https://dpg-staging.tranhuunguyenhuy.workers.dev')
    expect(workflow).toContain('d54f3402b9d112ab64d6135e0e3f1fb1')
    expect(workflow).toContain('fixed Production catalogue asset paths')
    expect(workflow).toContain('Admin authentication, private data and writes are unavailable')
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
  })
})
