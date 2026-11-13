import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
describe('M1 read-only source contract', () => {
  it('keeps snapshot rollback and requires separately provisioned Hyperdrive',()=>{
    const s=readFileSync('scripts/app-foundation/configure-v1-m1-worker-source.mjs','utf8')
    expect(s).toContain("['snapshot','postgresql']")
    expect(s).toContain("READONLY_HYPERDRIVE_ID_REQUIRED")
    expect(s).toContain("binding:'PUBLIC_DB'")
    const worker=readFileSync('apps/public/worker.ts','utf8')
    expect(worker).toContain("databaseMode")
    expect(worker).toContain("servePrerenderedCatalogue")
  })
  it('enforces parameterized read-only Postgres queries',()=>{
    const src=readFileSync('apps/public/src/runtime/public-db.ts','utf8')
    expect(src).toContain('PUBLIC_DATABASE_BINDING_REQUIRED')
    expect(src).toContain("statement.includes(';')")
    expect(src).toContain('client.query(statement, [...values])')
    expect(src).toContain('connectionTimeoutMillis: 3000')
    expect(src).toContain('query_timeout: 5000')
    expect(src).toContain('await client.end()')
  })
})
