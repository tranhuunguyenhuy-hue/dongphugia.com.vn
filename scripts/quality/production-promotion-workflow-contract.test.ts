import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/production-promotion.yml'), 'utf8')
const workflowsDirectory = resolve(process.cwd(), '.github/workflows')
const workflowFiles = readdirSync(workflowsDirectory)
  .filter((file) => /\.(?:yml|yaml)$/.test(file))
  .map((file) => ({ file, source: readFileSync(resolve(workflowsDirectory, file), 'utf8') }))

function hasClosedPullRequestTrigger(source: string) {
  const lines = source.split(/\r?\n/)
  let pullRequestIndent = -1
  let typesIndent = -1
  let readingTypes = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const indent = line.length - line.trimStart().length
    if (/^(?:pull_request|pull_request_target):\s*(?:#.*)?$/.test(trimmed)) {
      pullRequestIndent = indent
      typesIndent = -1
      readingTypes = false
      continue
    }
    if (/^(?:pull_request|pull_request_target):\s*\{[^}]*\bclosed\b[^}]*\}/.test(trimmed)) return true
    if (pullRequestIndent < 0) continue
    if (indent <= pullRequestIndent) {
      pullRequestIndent = -1
      typesIndent = -1
      readingTypes = false
      continue
    }
    const types = trimmed.match(/^types:\s*(.*)$/)
    if (types) {
      typesIndent = indent
      readingTypes = true
      if (/\bclosed\b/.test(types[1])) return true
      continue
    }
    if (readingTypes && indent > typesIndent && /^-\s*(?:closed|'closed'|"closed")\s*(?:#.*)?$/.test(trimmed)) return true
    if (readingTypes && indent <= typesIndent) readingTypes = false
  }
  return false
}

function reachesProductionPromotion(source: string) {
  return (
    source.includes('./.github/workflows/production-promotion.yml') ||
    source.includes('cloudflare/wrangler-action@') ||
    /\b(?:wrangler|pages)\s+deploy\b/.test(source)
  )
}

describe('LEO-537 Production promotion workflow contract', () => {
  it('is reusable, disabled before cutover, and protected by explicit Production approval', () => {
    expect(workflow).toContain('workflow_call:')
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain('PRODUCTION_PROMOTION_ENABLED')
    expect(workflow).toContain('BLOCKED_BY_CUTOVER_OWNER_GATE')
    expect(workflow).toContain('environment:')
    expect(workflow).toContain('name: production')
    expect(workflow).toContain("if: needs.production-enable-gate.outputs.enabled == 'true'")
    expect(workflow).toContain('owner_confirmation:')
    expect(workflow).toContain('DISPATCH_ACTOR: ${{ github.actor }}')
    expect(workflow).toContain('TRIGGERING_ACTOR: ${{ github.triggering_actor }}')
    expect(workflow).toContain('EVENT_NAME: ${{ github.event_name }}')
    expect(workflow).toContain('EVENT_REF: ${{ github.ref }}')
    expect(workflow).toContain("\"$DISPATCH_ACTOR\" == 'tranhuunguyenhuy-hue'")
    expect(workflow).toContain("\"$TRIGGERING_ACTOR\" == 'tranhuunguyenhuy-hue'")
    expect(workflow).toContain('OWNER_CONFIRMATION')
    expect(workflow).toContain('OWNER_CONFIRMATION\" == \"true\"')
    expect(workflow).toContain('\"$EVENT_NAME\" == \"workflow_dispatch\"')
    expect(workflow).toContain('\"$EVENT_REF\" == \'refs/heads/main\'')
  })

  it('cannot promote from a merged pull-request trigger', () => {
    const automaticMergePromotionWorkflows = workflowFiles
      .filter(({ source }) => hasClosedPullRequestTrigger(source))
      .filter(({ source }) => reachesProductionPromotion(source))
      .map(({ file }) => file)

    expect(automaticMergePromotionWorkflows).toEqual([])
    expect(existsSync(resolve(workflowsDirectory, 'production-merge.yml'))).toBe(false)
  })

  it.each([
    ['plain block item', 'types:\n      - closed'],
    ['single-quoted block item', "types:\n      - 'closed'"],
    ['double-quoted block item', 'types:\n      - "closed"'],
    ['flow sequence', 'types: ["closed", opened]'],
    ['flow mapping with single quotes', "pull_request: { types: ['closed'] }"],
    ['pull_request_target flow mapping', 'pull_request_target: { types: ["closed", opened] }'],
  ])('detects %s merged-PR trigger syntax', (_label, trigger) => {
    const event = trigger.startsWith('pull_request')
      ? trigger.replace(/\n/g, '\n  ')
      : `pull_request:\n    ${trigger}`
    const syntheticMergedPromotionWorkflow = `
on:
  ${event.replace(/\n/g, '\n  ')}
env:
  PRODUCTION_PROMOTION_ENABLED: true
jobs:
  promote:
    uses: ./.github/workflows/production-promotion.yml
    with:
      preview_artifact_name: dongphugia-preview-deadbeef
`
    expect(hasClosedPullRequestTrigger(syntheticMergedPromotionWorkflow)).toBe(true)
    expect(reachesProductionPromotion(syntheticMergedPromotionWorkflow)).toBe(true)
  })

  it('does not treat pull_request triggers without a closed activity type as merged triggers', () => {
    expect(hasClosedPullRequestTrigger('on:\n  pull_request:\n    branches: [main]')).toBe(false)
  })

  it('validates merged candidate provenance before requesting the Production environment', () => {
    expect(workflow).toContain('candidate-provenance-gate:')
    expect(workflow).toContain('pull-requests: read')
    expect(workflow).toContain('gh api "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER"')
    expect(workflow).toContain('gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main"')
    expect(workflow).toContain('gh api "repos/$GITHUB_REPOSITORY/compare/$merge_sha...$EVENT_SHA"')
    expect(workflow).toContain("pr.merged !== true")
    expect(workflow).toContain("typeof pr.merged_at !== 'string'")
    expect(workflow).toContain("pr.base?.ref !== 'main'")
    expect(workflow).toContain('pr.head?.sha !== sourceSha')
    expect(workflow).toContain('pr.merge_commit_sha')
    expect(workflow).toContain('comparison.merge_base_commit?.sha !== mergeSha')
    expect(workflow).toContain("candidate-provenance-gate.result == 'success'")
    expect(workflow).not.toContain('test "${{ inputs.target_ref')
  })

  it('keeps normal main quality and manual promotion paths available', () => {
    const qualityWorkflow = workflowFiles.find(({ file }) => file === 'quality.yml')?.source ?? ''
    expect(qualityWorkflow).toContain('push:')
    expect(qualityWorkflow).toContain('- main')
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain('actions/download-artifact@v4')
    expect(workflow).toContain('name: production')
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
