import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/production-promotion.yml'), 'utf8')
const mergeWorkflow = readFileSync(resolve(process.cwd(), '.github/workflows/production-merge.yml'), 'utf8')

describe('LEO-537 Production promotion workflow contract', () => {
  it('is reusable, disabled before cutover, and protected by explicit Production approval', () => {
    expect(workflow).toContain('workflow_call:')
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain('PRODUCTION_PROMOTION_ENABLED')
    expect(workflow).toContain('BLOCKED_BY_CUTOVER_OWNER_GATE')
    expect(workflow).toContain('environment:')
    expect(workflow).toContain('name: production')
    expect(workflow).toContain("if: needs.production-enable-gate.outputs.enabled == 'true'")
    expect(mergeWorkflow).toContain('types: [closed]')
    expect(mergeWorkflow).toContain('github.event.pull_request.merged == true')
    expect(mergeWorkflow).toContain('./.github/workflows/production-promotion.yml')
  })

  it('carries the Preview artifact and complete candidate identity into promotion', () => {
    for (const marker of [
      'actions/download-artifact@v4',
      'run-id:',
      'candidate_source_sha',
      'candidate_pr_number',
      'artifact_sha256',
      'CANDIDATE_IDENTITY_FAILED',
      'dongphugia:static-preview-candidate:v1',
      'pages deploy candidate-package/dongphugia-static-preview',
      '--commit-hash=',
    ]) expect(workflow).toContain(marker)
  })

  it('provides fail-closed failure handling and a validated-candidate rollback hook', () => {
    expect(workflow).toContain('options: [promote, rollback]')
    expect(workflow).toContain('FAILED_CLOSED')
    expect(workflow).toContain('separately validated prior Preview artifact')
    expect(workflow).toContain('No retry, traffic change, DNS change, or deletion was attempted.')
  })

  it('contains no legacy AWS delivery path', () => {
    for (const forbidden of ['ssm', 'ec2', 'docker', 'coolify', 'aws ']) {
      expect(workflow.toLowerCase()).not.toContain(forbidden)
    }
  })
})
