import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const baseline = readFileSync(
  resolve(process.cwd(), 'docs/deploy/migration-implementation-baseline.md'),
  'utf8',
)
const docsIndex = readFileSync(resolve(process.cwd(), 'docs/README.md'), 'utf8')

describe('canonical migration implementation baseline', () => {
  it('is discoverable as the current canonical documentation', () => {
    expect(docsIndex).toContain('deploy/migration-implementation-baseline.md')
    expect(baseline).toContain('LEO-531 feasibility audit')
    expect(baseline).toContain('https://linear.app/leonguyen/issue/LEO-531/')
  })

  it('locks the requested target architecture and exclusions', () => {
    for (const contract of [
      'Cloudflare static-first public delivery',
      'Supabase Free',
      'Supabase Edge Functions and RPC',
      'Supabase `pg_cron`',
      'Cloudflare Images stream transform',
      '`streams_enable_constructors`',
      'Bunny remains the media storage/CDN contract',
      'GitHub remains the source and CI authority',
      'AWS remains current Production and rollback',
      'There is no Vercel layer',
      'Phase 2 remains paused',
      'PR #115',
    ]) {
      expect(baseline).toContain(contract)
    }
  })

  it('defines immutable identity, approvals, rollback, and every independent gate', () => {
    for (const contract of [
      'full source commit SHA',
      'task-owned PR number and URL',
      'CI workflow run ID',
      'immutable build/deployment artifact identity',
      'migration/schema manifest checksum',
      '| Local |',
      '| PR |',
      '| Preview |',
      '| Production |',
      '| DNS/traffic |',
      '| Deletion |',
      '## 5. Approval matrix',
      '## 6. Rollback ownership',
    ]) {
      expect(baseline).toContain(contract)
    }
  })

  it('records exactly seven ordered migration stages', () => {
    for (let stage = 1; stage <= 7; stage += 1) {
      expect(baseline).toContain(`${stage}. **`)
    }
    expect(baseline).toContain('## 7. Seven-stage migration sequence')
  })
})
