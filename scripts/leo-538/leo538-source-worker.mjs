import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { Client } from 'pg'

const manifest = JSON.parse(await readFile(process.env.LEO538_MANIFEST_PATH, 'utf8'))
const expectedDatabase = process.env.LEO538_SOURCE_DATABASE
const expectedPrincipal = process.env.LEO538_SOURCE_READONLY_PRINCIPAL || 'codex_production_readonly'
if (!expectedDatabase) throw new Error('external source database identity is required')
const client = new Client({ ssl: { rejectUnauthorized: false } })

function stable(value) {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'bigint') return JSON.stringify({ __leo538: 'bigint', value: value.toString() })
  if (value instanceof Date) return JSON.stringify({ __leo538: 'timestamptz', value: value.toISOString() })
  if (Buffer.isBuffer(value)) return JSON.stringify({ __leo538: 'bytea', value: value.toString('base64') })
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']'
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}'
}

function encode(value) {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return { __leo538: 'bigint', value: value.toString() }
  if (value instanceof Date) return { __leo538: 'timestamptz', value: value.toISOString() }
  if (Buffer.isBuffer(value)) return { __leo538: 'bytea', value: value.toString('base64') }
  if (Array.isArray(value)) return value.map(encode)
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, encode(value[key])]))
}

await client.connect()
const attestation = (await client.query("select current_database() as database, current_user as principal, current_setting('transaction_read_only') as transaction_read_only, current_setting('default_transaction_read_only') as default_transaction_read_only, (select ssl from pg_stat_ssl where pid=pg_backend_pid()) as ssl")).rows[0]
const role = (await client.query("select rolcanlogin, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls, rolreplication from pg_roles where rolname=current_user")).rows[0]
const privileges = (await client.query("select count(*) filter (where has_table_privilege(current_user, format('%I.%I', table_schema, table_name), 'SELECT'))::int as selectable, count(*) filter (where has_table_privilege(current_user, format('%I.%I', table_schema, table_name), 'INSERT'))::int as insertable, count(*) filter (where has_table_privilege(current_user, format('%I.%I', table_schema, table_name), 'UPDATE'))::int as updatable, count(*) filter (where has_table_privilege(current_user, format('%I.%I', table_schema, table_name), 'DELETE'))::int as deletable, count(*) filter (where has_table_privilege(current_user, format('%I.%I', table_schema, table_name), 'TRUNCATE'))::int as truncatable from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")).rows[0]
if (attestation.database !== expectedDatabase || attestation.principal !== expectedPrincipal || attestation.transaction_read_only !== 'on' || attestation.default_transaction_read_only !== 'on' || attestation.ssl !== true || !role || role.rolsuper || role.rolcreaterole || role.rolcreatedb || role.rolbypassrls || role.rolreplication || privileges.selectable !== 57 || privileges.insertable !== 0 || privileges.updatable !== 0 || privileges.deletable !== 0 || privileges.truncatable !== 0) throw new Error('read-only attestation mismatch')

await client.query('begin')
await client.query('set transaction read only')
await client.query('set transaction isolation level repeatable read')
const blogOwnerTables = new Set(manifest.blogOwnerSourceTables)
const reconciliationOwnerTables = new Set(manifest.reconciliationOwnerSourceTables)
const ownerSideTables = new Set([...blogOwnerTables, ...reconciliationOwnerTables])
const exported = {
  formatVersion: 1,
  source: {
    database: attestation.database,
    principal: attestation.principal,
    serverVersion: (await client.query("select current_setting('server_version') as version")).rows[0].version,
  },
  attestation: {
    transactionReadOnly: attestation.transaction_read_only,
    defaultTransactionReadOnly: attestation.default_transaction_read_only,
    ssl: attestation.ssl,
    privileges,
  },
  tables: [],
}
for (const table of [...manifest.retainedTables].sort()) {
  const columnMetadata = (await client.query('select column_name, data_type, udt_name from information_schema.columns where table_schema=$1 and table_name=$2 order by ordinal_position', ['public', table])).rows
  const columns = columnMetadata.map((row) => row.column_name)
  const columnTypes = Object.fromEntries(columnMetadata.map((row) => [row.column_name, { dataType: row.data_type, udtName: row.udt_name }]))
  const primaryKey = (await client.query('select a.attname as column_name from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey) where i.indrelid=$1::regclass and i.indisprimary order by array_position(i.indkey,a.attnum)', ['public.' + table])).rows.map((row) => row.column_name)
  if (!columns.length || !primaryKey.length) throw new Error('manifest table missing columns or primary key: ' + table)
  const order = primaryKey.map((column) => '"' + column.replaceAll('"', '""') + '" asc').join(', ')
  const rows = ownerSideTables.has(table)
    ? []
    : (await client.query('select * from public."' + table.replaceAll('"', '""') + '" order by ' + order)).rows
  const encoded = rows.map((row) => columns.map((column) => encode(row[column])))
  const hash = createHash('sha256')
  for (const row of encoded) hash.update(stable(row) + '\n')
  exported.tables.push({
    name: table,
    columns,
    columnTypes,
    primaryKey,
    rowCount: encoded.length,
    sha256: hash.digest('hex'),
    sourceAuthority: blogOwnerTables.has(table)
      ? 'owner-blog-pending'
      : reconciliationOwnerTables.has(table)
        ? 'owner-reconciliation-pending'
        : 'codex_production_readonly',
    rows: encoded,
  })
}
await client.query('rollback')
await client.end()
await writeFile(process.env.LEO538_EXPORT_PATH, JSON.stringify(exported) + '\n', { mode: 0o600 })
const evidence = exported.tables.map(({ name, columns, primaryKey, rowCount, sha256 }) => ({ name, columns, primaryKey, rowCount, sha256 }))
console.log(JSON.stringify({
  status: 'PASS',
  database: exported.source.database,
  principal: exported.source.principal,
  ordinaryTableCount: exported.tables.filter((table) => table.sourceAuthority === 'codex_production_readonly').length,
  pendingBlogTableCount: exported.tables.filter((table) => table.sourceAuthority === 'owner-blog-pending').length,
  pendingReconciliationTableCount: exported.tables.filter((table) => table.sourceAuthority === 'owner-reconciliation-pending').length,
  totalOrdinaryRows: exported.tables.reduce((sum, table) => sum + table.rowCount, 0),
  exportSha256: createHash('sha256').update(JSON.stringify(evidence)).digest('hex'),
}))
