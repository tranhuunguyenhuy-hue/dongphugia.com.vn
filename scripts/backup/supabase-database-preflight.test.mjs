import { it as test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { verifyDatabase } from './supabase-database-preflight.mjs'

const url = 'postgresql://postgres:PRIVATE_PASSWORD@db.bonxyxluzlxfkdetryoo.supabase.co:5432/postgres'
function fixture({ failure, ledgerPresent = false, count = 7 } = {}) {
  const queries = []
  const client = {
    on() {},
    async connect() { if (failure) throw failure },
    async query(sql) {
      queries.push(sql)
      if (sql.includes('transaction_read_only')) return { rows: [{ readonly: true, postgres_17: true, target_exact: true, size_within_ceiling: true, ledger_present: ledgerPresent, backup_login_absent: true }] }
      if (sql.includes('count(*)')) return { rows: [{ entries: count }] }
      return { rows: [] }
    },
    async end() {},
  }
  return { client, queries }
}

test('connection failures report phase and allowlisted code without credentials or error messages', async () => {
  for (const code of ['ENETUNREACH', '28P01', 'SELF_SIGNED_CERT_IN_CHAIN', 'SECRET_UNKNOWN']) {
    const output = []
    const { client } = fixture({ failure: Object.assign(new Error(url), { code, detail: 'PRIVATE_PASSWORD' }) })
    assert.equal(await verifyDatabase(url, () => client, (line) => output.push(line)), false)
    assert.match(output.at(-1), new RegExp(`phase=connect code=${code === 'SECRET_UNKNOWN' ? 'UNCLASSIFIED' : code}$`))
    assert.ok(!output.join('').includes('PRIVATE_PASSWORD'))
    assert.ok(!output.join('').includes('postgresql:'))
  }
})

test('all remote observations occur after BEGIN READ ONLY and finish with rollback', async () => {
  const { client, queries } = fixture()
  const output = []
  assert.equal(await verifyDatabase(url, () => client, (line) => output.push(line)), true)
  assert.equal(queries[0], 'begin transaction isolation level repeatable read read only')
  assert.match(output.at(-1), /observed_prefix=absent$/)
  assert.equal(queries.at(-1), 'rollback')
  for (const sql of queries.slice(1)) assert.match(sql.trim(), /^(select|rollback)\b/i)
})

test('invalid target is rejected before creating a client', async () => {
  let created = false
  assert.equal(await verifyDatabase(url.replace('bonxyxluzlxfkdetryoo', 'wrongproject'), () => { created = true }, () => {}), false)
  assert.equal(created, false)
})

test('ledger observation rejects values outside the bounded bootstrap range', async () => {
  const { client } = fixture({ ledgerPresent: true, count: 10 })
  const output = []
  assert.equal(await verifyDatabase(url, () => client, (line) => output.push(line)), false)
  assert.match(output.at(-1), /phase=ledger code=UNCLASSIFIED$/)
})

test('workflow restricts exact source, owner, environment and consumes only the database URL', () => {
  const workflow = readFileSync('.github/workflows/supabase-database-preflight.yml', 'utf8')
  for (const fragment of ["github.ref == 'refs/heads/main'", "github.actor == 'tranhuunguyenhuy-hue'", 'github.run_attempt == 1', 'environment: runtime-backup', 'test "$GITHUB_SHA" = "$APPROVED_SOURCE_SHA"']) assert.ok(workflow.includes(fragment))
  assert.deepEqual([...workflow.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]), ['SUPABASE_REHOME_DATABASE_URL'])
  assert.ok(!workflow.includes('bootstrap-backup'))
})
