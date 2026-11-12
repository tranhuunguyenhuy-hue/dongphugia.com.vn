import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const workflow = readFileSync(path.join(here, '../../.github/workflows/environment-worker-publish.yml'), 'utf8')

describe('unified Worker publication workflow trust boundaries', () => {
  it('serializes both environments and gates pre-merge source at the exact approved PR head', () => {
    expect(workflow).toContain('group: dpg-shared-preview-staging-publication')
    expect(workflow).toContain('options: [main, approved-pr]')
    expect(workflow).toContain('validate-environment-worker-source.mjs')
    expect(workflow).toContain('cloudflare-${{ inputs.environment }}')
    expect(workflow).toContain('dpg-${{ inputs.environment }}-build')
  })

  it('does not expose any Cloudflare credential to the candidate build job', () => {
    const [buildJob, publishJob = ''] = workflow.split('  publish-candidate:')
    expect(buildJob).not.toMatch(/CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID/)
    expect(buildJob.match(/GITHUB_TOKEN: \$\{\{ github\.token \}\}/g)).toHaveLength(1)
    expect(buildJob.indexOf('GITHUB_TOKEN: ${{ github.token }}'))
      .toBeGreaterThan(buildJob.indexOf('Validate the source commit and approval'))
    expect(publishJob).toContain('secrets.CLOUDFLARE_API_TOKEN')
    expect(publishJob).toContain('verify-environment-worker-token-scope.mjs')
    expect(publishJob).toContain('prepare-environment-worker-publication.mjs')
  })

  it('publishes only the two fixed workers and the matching workers.dev origins', () => {
    expect(workflow).toContain("'dpg-preview'")
    expect(workflow).toContain("'dpg-staging'")
    expect(workflow).toContain('https://dpg-preview.tranhuunguyenhuy.workers.dev')
    expect(workflow).toContain('https://dpg-staging.tranhuunguyenhuy.workers.dev')
    expect(workflow).toContain('d54f3402b9d112ab64d6135e0e3f1fb1')
  })
})
