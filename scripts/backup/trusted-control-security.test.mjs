import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const workflow = await readFile(resolve(root, '.github/workflows/runtime-backup.yml'), 'utf8')
const backup = await readFile(resolve(root, 'scripts/backup/create-encrypted-backup.sh'), 'utf8')
const restore = await readFile(resolve(root, 'scripts/backup/rehearse-isolated-restore.sh'), 'utf8')
const protectedWorkflow = workflow.slice(workflow.indexOf('  backup:'))

describe('LEO-552 protected trust boundary', () => {
  it('executes only trusted-main backup and restore controls', () => {
    expect(workflow.match(/ref: refs\/heads\/main/g)).toHaveLength(3)
    expect(workflow).toContain('bash scripts/backup/create-encrypted-backup.sh')
    expect(workflow).toContain('bash scripts/backup/rehearse-isolated-restore.sh')
    expect(protectedWorkflow).not.toContain('git archive')
    expect(protectedWorkflow).not.toContain('git fetch')
    expect(protectedWorkflow).not.toContain('extract-exact-candidate-sources.sh')
    expect(protectedWorkflow).not.toMatch(/(?:CANDIDATE|BACKUP|RESTORE)_SOURCE_ROOT/)
  })

  it('does not expose protected environment values to candidate execution', () => {
    expect(protectedWorkflow).not.toMatch(/(?:CANDIDATE|candidate)[^\n]*(?:SOURCE_ROOT|\.sh|\.mjs)/)
    expect(protectedWorkflow).not.toMatch(/(?:bash|node)\s+[^\n]*(?:CANDIDATE|candidate)/)
    expect(backup).not.toMatch(/candidate|CANDIDATE/i)
    expect(restore).not.toMatch(/candidate|CANDIDATE/i)
    expect(workflow).toContain('AGE_IDENTITY: ${{ secrets.BACKUP_AGE_PRIVATE_KEY }}')
    expect(workflow).toContain('DATABASE_URL: ${{ secrets.SUPABASE_RUNTIME_DATABASE_URL }}')
  })

  it('ignores malicious candidate shell and Node payloads because no candidate code path exists', () => {
    const maliciousShell = 'touch "$RUNNER_TEMP/exfiltrated"; curl "$DATABASE_URL"'
    const maliciousNode = 'process.env.BACKUP_AGE_PRIVATE_KEY; require("child_process").exec("curl")'
    expect(workflow).not.toContain(maliciousShell)
    expect(workflow).not.toContain(maliciousNode)
    expect(workflow).not.toMatch(/inputs\.candidate_sha[^\n]*(?:run|shell|script)/i)
    expect(workflow).toContain('exact-pr-artifact-identity.mjs bind')
    expect(workflow).toContain('exact-pr-artifact-identity.mjs verify')
  })

  it('does not load candidate workflow YAML', () => {
    expect(workflow).not.toMatch(/\.github\/workflows|workflow_yaml|candidate.*ya?ml/i)
    expect(workflow).toContain('ref: refs/heads/main')
  })
})
