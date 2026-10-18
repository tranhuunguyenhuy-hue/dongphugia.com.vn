import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workflow = await readFile(
  resolve(process.cwd(), '.github/workflows/codex-auto-dispatcher.yml'),
  'utf8',
)

function job(name, nextName) {
  const start = workflow.indexOf(`  ${name}:`)
  const end = nextName ? workflow.indexOf(`  ${nextName}:`, start) : workflow.length
  return workflow.slice(start, end)
}

describe('Codex auto-dispatcher workflow trust boundary', () => {
  it('uses only created issue comments on the default branch with per-issue serialization', () => {
    expect(workflow).toContain('issue_comment:')
    expect(workflow).toContain('types: [created]')
    expect(workflow).not.toContain('pull_request_target')
    expect(workflow).toContain('codex-auto-dispatch-${{ github.repository_id }}-${{ github.event.issue.number }}')
    expect(workflow).not.toContain('queue:')
    expect(workflow).toContain('cancel-in-progress: false')
    expect(workflow).toContain('CODEX_AUTO_DISPATCH_RUNNING')
  })

  it('keeps Codex read-only at GitHub and gives write authority only to the publisher job', () => {
    const execute = job('execute', 'publish')
    const publish = job('publish')

    expect(execute).toContain('contents: read')
    expect(execute).not.toContain('contents: write')
    expect(execute).not.toContain('pull-requests: write')
    expect(execute).not.toContain('CODEX_PUBLISHER_APP')
    expect(execute).not.toContain('${{ github.event.comment.body }}')
    expect(execute).toContain('OPENAI_API_KEY')
    expect(execute).toContain('model: gpt-5.3-codex')
    expect(execute).toContain('sandbox: workspace-write')
    expect(execute).toContain('safety-strategy: drop-sudo')
    expect(execute).toContain('chmod 000 /var/run/docker.sock')
    expect(execute).toContain('chmod -R a-w .git')
    expect(execute).toContain('${{ runner.temp }}/trusted-dispatch')
    expect(execute).toContain('${{ runner.temp }}/codex.patch')
    expect(execute).not.toMatch(/^\s+dispatch\.json$/m)

    expect(publish).not.toContain('OPENAI_API_KEY')
    expect(publish).toContain('CODEX_PUBLISHER_APP_ID')
    expect(publish).toContain('CODEX_PUBLISHER_APP_PRIVATE_KEY')
    expect(publish).toContain('Reload trusted dispatch independently of model output')
    expect(publish).toContain('$RUNNER_TEMP/trusted-dispatch/dispatch.json')
    expect(publish).toContain('$RUNNER_TEMP/generated-result/codex.patch')
    expect(publish).toContain('gh pr create --draft')
    expect(workflow).not.toMatch(/(?:gh pr merge|git merge|enable-auto-merge)/)
  })

  it('pins every third-party action to an immutable commit', () => {
    const uses = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gm)].map(
      (match) => match[1],
    )
    expect(uses.length).toBeGreaterThan(0)
    for (const action of uses) {
      expect(action).toMatch(/@[0-9a-f]{40}$/)
    }
  })
})
