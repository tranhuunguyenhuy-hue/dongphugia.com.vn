import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const getDoc = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const agents = getDoc('AGENTS.md')
const handbook = getDoc('docs/PROJECT.md')
const current = getDoc('docs/ops/project-current-state.md')
const prodDb = getDoc('docs/deploy/postgresql-production-adoption-contract.md')
const cloudflare = getDoc('docs/deploy/cloudflare-staging-production.md')

describe('V1 owner-approved 5-milestone delivery authority', () => {
  it('makes M1 the only active milestone, with real PostgreSQL Public reads and rollback', () => {
    for (const v of ['#306', '#307', '#308', '#309', '#310', '#311', 'ACTIVE M1']) {
      expect(agents).toContain(v)
    }
    expect(prodDb).toContain('Public database read path')
    expect(prodDb).toContain('snapshot')
    expect(prodDb).toContain('read-only')
    expect(current).toContain('M1')
    expect(current).toContain('NOT YET ACCEPTED')
  })

  it('uses localhost and one Staging Worker, with isolated Admin data', () => {
    expect(cloudflare).toContain('dpg-staging')
    expect(cloudflare).toContain('dongphugia-v1-public-production')
    expect(cloudflare).toContain('isolated test PostgreSQL')
    expect(agents).toContain('No mandatory remote Preview')
    expect(agents).toContain('legacy Admin')
    expect(handbook).toContain('Products+Blog only')
  })

  it('preserves data security, evidence and cancellation of old plans', () => {
    expect(agents).toContain('Never touch V2')
    expect(agents).toContain('No destructive data loss')
    expect(handbook).toContain('backup')
    expect(handbook).toContain('deploy/supabase-runtime-security-boundary.md')
    expect(current).toContain('tlmgudfhsyzayiazuugf')
  })
})
