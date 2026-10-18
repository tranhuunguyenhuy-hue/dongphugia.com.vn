import { describe, expect, it } from 'vitest'

import {
  parseDispatchCommand,
  validateDispatchEvent,
} from './codex-dispatch-preflight.mjs'

const validCommand = `/codex dispatch
\`\`\`json
{
  "version": 1,
  "title": "Document catalogue recovery gate",
  "task": "Update the source-only recovery documentation and its static tests.",
  "acceptance": ["Focused static tests pass", "A draft pull request is opened"],
  "allowed_paths": ["docs/deploy/", "scripts/quality/"],
  "production": false,
  "external_writes": false
}
\`\`\``

describe('Codex dispatch command', () => {
  it('accepts only the exact versioned source-only JSON command', () => {
    expect(parseDispatchCommand(validCommand)).toEqual({
      version: 1,
      title: 'Document catalogue recovery gate',
      task: 'Update the source-only recovery documentation and its static tests.',
      acceptance: ['Focused static tests pass', 'A draft pull request is opened'],
      allowed_paths: ['docs/deploy/', 'scripts/quality/'],
      production: false,
      external_writes: false,
    })
  })

  it('validates repository, actor permission, base ref, and idempotency through GitHub API data', async () => {
    const event = {
      action: 'created',
      repository: {
        id: 1157762683,
        full_name: 'tranhuunguyenhuy-hue/dongphugia.com.vn',
      },
      sender: { id: 258872309, login: 'trusted-owner' },
      issue: { number: 160 },
      comment: {
        id: 6250663223,
        body: validCommand,
        user: { id: 258872309, login: 'trusted-owner' },
      },
    }
    const requests = []
    const githubApi = async (path) => {
      requests.push(path)
      if (path === '/repos/tranhuunguyenhuy-hue/dongphugia.com.vn') {
        return {
          status: 200,
          data: { id: 1157762683, default_branch: 'main' },
        }
      }
      if (path.endsWith('/collaborators/trusted-owner/permission')) {
        return {
          status: 200,
          data: { permission: 'admin', user: { id: 258872309 } },
        }
      }
      if (path.endsWith('/git/ref/heads/main')) {
        return { status: 200, data: { object: { sha: 'a'.repeat(40) } } }
      }
      if (path.includes('/git/ref/heads/codex%2Fdispatch-160-6250663223')) {
        return { status: 404, data: null }
      }
      throw new Error(`Unexpected API request: ${path}`)
    }

    await expect(
      validateDispatchEvent({
        event,
        githubApi,
        repository: 'tranhuunguyenhuy-hue/dongphugia.com.vn',
        repositoryId: 1157762683,
        ref: 'refs/heads/main',
        sha: 'a'.repeat(40),
      }),
    ).resolves.toMatchObject({
      dispatch_id: '1157762683:160:6250663223',
      issue_number: 160,
      source_comment_id: 6250663223,
      actor_id: 258872309,
      base_sha: 'a'.repeat(40),
      branch: 'codex/dispatch-160-6250663223',
      task: parseDispatchCommand(validCommand),
    })

    expect(requests).toHaveLength(4)
  })

  it('rejects task scopes that could alter automation or escape the repository', () => {
    const unsafeCommand = validCommand.replace(
      '["docs/deploy/", "scripts/quality/"]',
      '[".github/workflows/", "../outside"]',
    )

    expect(() => parseDispatchCommand(unsafeCommand)).toThrowError(
      'DISPATCH_ALLOWED_PATH_INVALID',
    )
  })

  it('rejects non-string acceptance criteria and unbounded task text', () => {
    const invalidAcceptance = validCommand.replace(
      '["Focused static tests pass", "A draft pull request is opened"]',
      '[1]',
    )
    const oversizedTask = validCommand.replace(
      'Update the source-only recovery documentation and its static tests.',
      'x'.repeat(8_001),
    )

    expect(() => parseDispatchCommand(invalidAcceptance)).toThrowError(
      'DISPATCH_SCHEMA_INVALID',
    )
    expect(() => parseDispatchCommand(oversizedTask)).toThrowError(
      'DISPATCH_SCHEMA_INVALID',
    )
  })
})
