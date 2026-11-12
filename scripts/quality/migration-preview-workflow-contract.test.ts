import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/migration-preview.yml'), 'utf8')
const qualityWorkflow = readFileSync(resolve(process.cwd(), '.github/workflows/quality.yml'), 'utf8')
const changeGate = readFileSync(resolve(process.cwd(), 'scripts/app-foundation/preview-change-gate.mjs'), 'utf8')
const buildGuide = readFileSync(resolve(process.cwd(), 'docs/deploy/public-static-build.md'), 'utf8')

describe('application CI workflow contract', () => {
  it('keeps required and risk-specific CI while selecting the exact PR head', () => {
    for (const marker of [
      'pull_request:',
      'branches: [main]',
      'fetch-depth: 0',
      'github.event.pull_request.base.sha',
      'github.event.pull_request.head.sha || github.sha',
      'preview-change-gate.mjs',
      'npm run static:check',
      "needs.repo-code-gate.outputs.ci_required == 'true'",
      "needs.repo-code-gate.outputs.integration_required == 'true'",
      "needs.repo-code-gate.outputs.b11_required == 'true'",
      'Database, Auth and commerce integration tests',
      'Check Public Worker fail-closed contracts',
      'Local-only Preview gate',
    ]) expect(workflow).toContain(marker)

    for (const general of ['npm run lint', 'npm run typecheck', 'npm test']) {
      expect(qualityWorkflow).toContain(general)
    }
    expect(workflow).not.toContain('run: npm run lint')
    expect(workflow).not.toContain('run: npm run typecheck\n')
    expect(workflow).toContain('run: npm test')
    expect(changeGate).toContain('source_sha: headSha')
  })

  it('has no external Preview trigger, candidate artifact upload, token, or Cloudflare API call', () => {
    expect(workflow).not.toContain('workflow_dispatch:')
    expect(workflow).not.toContain('actions/upload-artifact')
    expect(workflow).not.toMatch(/CLOUDFLARE|WRANGLER|workers\.dev|versions upload|wrangler deploy/i)
    expect(workflow).not.toContain('dongphugia-v1-public-preview')
    expect(workflow).not.toContain('public-preview.invalid')
    expect(workflow).toContain('without external Preview publication')
    expect(workflow).toContain('SKIPPED_UNRELATED_CHANGE')
  })

  it('documents local Preview separately from the serialized Staging publisher', () => {
    expect(buildGuide).toContain('npm run preview:local')
    expect(buildGuide).toContain('http://127.0.0.1:8787')
    expect(buildGuide).toContain('single `dpg-staging` Worker')
    expect(buildGuide).not.toContain('CLOUDFLARE_READONLY_DISCOVERY_TOKEN')
    expect(buildGuide).not.toContain('dongphugia-v1-public-preview')
  })
})
