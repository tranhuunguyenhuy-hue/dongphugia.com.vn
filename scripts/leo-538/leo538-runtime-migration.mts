import { createHash } from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import path from 'node:path'

const execFileAsync = promisify(execFile)
const manifestPath = path.resolve('docs/deploy/leo-538-reduced-runtime-manifest.json')
const workerPath = path.resolve('scripts/leo-538/leo538-source-worker.mjs')
const familyMigrationPath = path.resolve('db/postgres-migrations/0001_ms885_normalized_family/migration.sql')

type Manifest = {
  retainedTables: string[]
  loadOrder: string[]
  blogOwnerSourceTables: string[]
  reconciliationOwnerSourceTables: string[]
  adminUsersProjection: {
    retainedColumns: string[]
  }
  familyTables: string[]
  excludedTables: Array<{ table: string }>
}

type ExportTable = {
  name: string
  columns: string[]
  columnTypes: Record<string, { dataType: string; udtName: string }>
  primaryKey: string[]
  rowCount: number
  sha256: string
  sourceAuthority: 'codex_production_readonly' | 'owner-blog-pending' | 'owner-blog-readonly' | 'owner-reconciliation-pending' | 'owner-reconciliation-readonly'
  rows: unknown[][]
}

type SourceConfig = {
  region: string
  instanceId: string
  database: string
  readonlyPrincipal: string
  secretRef: string
  localPort: string
  container: string
  image: string
}

function fail(message: string): never {
  throw new Error('LEO538_MIGRATION_FAILED: ' + message)
}

function sourceConfig(): SourceConfig {
  const value = (name: string) => {
    const current = process.env[name]
    if (!current) fail(`required external source configuration ${name} is absent`)
    return current
  }
  return {
    region: value('LEO538_SOURCE_AWS_REGION'),
    instanceId: value('LEO538_SOURCE_SSM_INSTANCE_ID'),
    database: value('LEO538_SOURCE_DATABASE'),
    readonlyPrincipal: value('LEO538_SOURCE_READONLY_PRINCIPAL'),
    secretRef: value('LEO538_ASM_SECRET_REF'),
    localPort: value('LEO538_SOURCE_LOCAL_PORT'),
    container: value('LEO538_SOURCE_POSTGRES_CONTAINER'),
    image: value('LEO538_SOURCE_POSTGRES_IMAGE'),
  }
}

async function aws(args: string[], timeout = 30000) {
  const result = await execFileAsync('aws', args, { maxBuffer: 2 * 1024 * 1024, timeout })
  return result.stdout
}

async function invokeReadOnlyRuntimeMetadata(config: SourceConfig) {
  const command = [
    'set -eu',
    'docker inspect --format "{{.Config.Image}}|{{.State.Status}}|{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}" ' + config.container,
    "docker exec " + config.container + " sh -lc 'grep -Ev \"^[[:space:]]*(#|$)\" \"$PGDATA/pg_hba.conf\" | sed -E \"s/[[:space:]]+/ /g\"'",
  ].join('; ')
  const commandId = (await aws([
    'ssm', 'send-command', '--region', config.region, '--instance-ids', config.instanceId,
    '--document-name', 'AWS-RunShellScript', '--comment', 'LEO-538 read-only runtime identity attestation',
    '--parameters', JSON.stringify({ commands: [command] }), '--query', 'Command.CommandId', '--output', 'text',
  ])).trim()
  if (!commandId) fail('SSM did not return a command id')
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const raw = await aws([
      'ssm', 'get-command-invocation', '--region', config.region, '--command-id', commandId,
      '--instance-id', config.instanceId, '--query', '[Status,StandardOutputContent,StandardErrorContent]', '--output', 'json',
    ])
    const [status, output, error] = JSON.parse(raw) as [string, string, string]
    if (status === 'Success') {
      const [identityLine, ...hba] = output.trim().split('\n')
      const [image, state, addresses] = identityLine.split('|')
      const ip = addresses.split(/\s+/).find((value) => /^10\.0\.2\.\d+$/.test(value))
      if (image !== config.image || state !== 'running' || !ip) fail('Production container identity/IP attestation mismatch')
      if (!hba.includes('hostnossl all all 0.0.0.0/0 reject') || !hba.includes('hostssl all all 0.0.0.0/0 scram-sha-256')) {
        fail('Production host authentication boundary is not the approved SSL path')
      }
      return ip
    }
    if (['Failed', 'Cancelled', 'TimedOut'].includes(status)) fail('SSM runtime attestation failed' + (error ? ' (sanitized remote error)' : ''))
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  fail('SSM runtime attestation timed out')
}

async function waitForTunnel(child: ReturnType<typeof spawn>, localPort: string) {
  let output = ''
  child.stdout?.on('data', (chunk) => { output += chunk.toString() })
  child.stderr?.on('data', (chunk) => { output += chunk.toString() })
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (output.includes('Port ' + localPort + ' opened')) return
    if (child.exitCode !== null) fail('SSM tunnel exited before opening')
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  fail('SSM tunnel did not open')
}

async function exportSource(exportPath: string) {
  const config = sourceConfig()
  const ip = await invokeReadOnlyRuntimeMetadata(config)
  const tunnel = spawn('aws', [
    'ssm', 'start-session', '--region', config.region, '--target', config.instanceId,
    '--document-name', 'AWS-StartPortForwardingSessionToRemoteHost',
    '--parameters', JSON.stringify({ host: [ip], portNumber: ['5432'], localPortNumber: [config.localPort] }),
  ], { stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    await waitForTunnel(tunnel, config.localPort)
    const child = spawn('/Users/m-ac/.local/bin/asm-exec', [
      '--', 'env',
      'PGHOST=127.0.0.1', 'PGPORT=' + config.localPort, 'PGDATABASE=' + config.database,
      'PGUSER=' + config.secretRef + 'username}}', 'PGPASSWORD=' + config.secretRef + 'password}}',
      'LEO538_EXPORT_PATH=' + exportPath, 'LEO538_MANIFEST_PATH=' + manifestPath,
      'node', workerPath,
    ], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, AWS_REGION: config.region, LEO538_SOURCE_DATABASE: config.database, LEO538_SOURCE_READONLY_PRINCIPAL: config.readonlyPrincipal } })
    let stderr = ''
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    let stdout = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    const exitCode = await new Promise<number>((resolve) => child.on('close', (code) => resolve(code ?? 1)))
    if (exitCode !== 0) fail('asm-exec read-only export failed' + (stderr ? ' (sanitized child error)' : ''))
    process.stdout.write(stdout)
  } finally {
    tunnel.kill('SIGINT')
    await new Promise((resolve) => tunnel.once('close', resolve))
  }
}

function shellQuote(value: string) {
  return "'" + value.replaceAll("'", "'\"'\"'") + "'"
}

async function ownerSnapshotSql(kind: 'blog' | 'reconciliation') {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest
  const tables = kind === 'blog' ? manifest.blogOwnerSourceTables : manifest.reconciliationOwnerSourceTables
  const tableJson = tables.map((table) => {
    const order = table === 'blog_post_tags' ? 't.post_id, t.tag_id'
      : table === 'publishing_blog_post_media' ? 't.post_id, t.media_id, t.usage'
        : 't.id'
    const expression = table === 'admin_users'
      ? `jsonb_build_object('id', t.id, 'email', t.email, 'name', t.name, 'role', t.role, 'is_active', t.is_active, 'avatar_url', t.avatar_url, 'created_at', t.created_at, 'updated_at', t.updated_at)`
      : 'to_jsonb(t)'
    return `'${table}', coalesce((select jsonb_agg(${expression} order by ${order}) from public."${table}" t), '[]'::jsonb)`
  }).join(', ')
  return `begin transaction isolation level repeatable read read only deferrable;
set local row_security=off;
select jsonb_build_object('attestation', jsonb_build_object('database', current_database(), 'effective_principal', current_user, 'session_principal', session_user, 'transaction_isolation', current_setting('transaction_isolation'), 'transaction_read_only', current_setting('transaction_read_only'), 'transaction_deferrable', current_setting('transaction_deferrable'), 'row_security', current_setting('row_security')), 'tables', jsonb_build_object(${tableJson}));
commit;`
}

async function ownerSnapshot(kind: 'blog' | 'reconciliation', outputPath: string) {
  const config = sourceConfig()
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest
  const tables = kind === 'blog' ? manifest.blogOwnerSourceTables : manifest.reconciliationOwnerSourceTables
  const sql = await ownerSnapshotSql(kind)
  const sqlBase64 = Buffer.from(sql).toString('base64')
  const temp = await mkdtemp('/tmp/leo538-owner-session.')
  const ciphertext = path.join(temp, 'snapshot.enc')
  const plaintext = path.join(temp, 'snapshot.json')
  const key = (await execFileAsync('openssl', ['rand', '-hex', '32'])).stdout.trim()
  const remote = `set -eu; echo LEO538_OWNER_BEGIN; printf %s ${sqlBase64} | base64 -d | sudo -n docker exec -i -u postgres ${config.container} psql -X -qAt -v ON_ERROR_STOP=1 -d ${config.database} -f - | gzip -c | openssl enc -aes-256-cbc -pbkdf2 -salt -pass pass:${key} | base64; echo LEO538_OWNER_END`
  const input = spawn('tail', ['-f', '/dev/null'], { stdio: ['ignore', 'pipe', 'ignore'] })
  const session = spawn('aws', ['ssm', 'start-session', '--region', config.region, '--target', config.instanceId, '--document-name', 'AWS-StartInteractiveCommand', '--parameters', JSON.stringify({ command: [remote] })], { stdio: ['pipe', 'pipe', 'pipe'] })
  input.stdout?.pipe(session.stdin)
  const chunks: Buffer[] = []
  let stderr = ''
  let inputClosed = false
  const closeInput = () => {
    if (inputClosed) return
    inputClosed = true
    input.kill('SIGTERM')
    session.stdin.end()
  }
  const timeout = setTimeout(closeInput, 60_000)
  session.stdout?.on('data', (chunk) => {
    chunks.push(Buffer.from(chunk))
    const current = Buffer.concat(chunks).toString('utf8').replaceAll('\r', '\n')
    if (/LEO538_OWNER_BEGIN\s*\n[A-Za-z0-9+/=\s]+?\s*LEO538_OWNER_END/.test(current)) closeInput()
  })
  session.stderr?.on('data', (chunk) => { stderr += chunk.toString() })
  try {
    const code = await new Promise<number>((resolve) => session.on('close', (value) => resolve(value ?? 1)))
    clearTimeout(timeout)
    const transcript = Buffer.concat(chunks).toString('utf8')
    const normalizedTranscript = transcript.replaceAll('\r', '\n')
    const envelope = normalizedTranscript.match(/LEO538_OWNER_BEGIN\s*\n([A-Za-z0-9+/=\s]+?)\s*LEO538_OWNER_END/)
    if (!envelope) {
      const between = normalizedTranscript.match(/LEO538_OWNER_BEGIN([\s\S]*?)LEO538_OWNER_END/)?.[1] ?? ''
      const failureClass = /psql: error:/i.test(normalizedTranscript) ? 'postgres-query' : /docker exec/i.test(normalizedTranscript) ? 'container-exec' : /openssl/i.test(normalizedTranscript) ? 'encryption' : /base64/i.test(normalizedTranscript) ? 'encoding' : /permission denied/i.test(normalizedTranscript) ? 'permission' : /not found/i.test(normalizedTranscript) ? 'not-found' : /invalid/i.test(normalizedTranscript) ? 'invalid-command' : 'unknown'
      const lines = normalizedTranscript.split(/\n/).filter(Boolean)
      const shape = lines.map((line) => /^[A-Za-z0-9+/=]+$/.test(line) ? `b64:${line.length}` : `text:${line.length}`).join(',')
      fail(`owner-side ${kind} execution boundary failed (exit ${code}, class ${failureClass}, bytes ${Buffer.byteLength(transcript)}, begin ${transcript.includes('LEO538_OWNER_BEGIN')}, end ${transcript.includes('LEO538_OWNER_END')}, envelopeBytes ${Buffer.byteLength(between)}, base64Only ${/^[\\sA-Za-z0-9+/=]*$/.test(between)}, lineShape ${shape}${stderr ? ', sanitized session error present' : ''})`)
    }
    await writeFile(ciphertext, envelope[1].replaceAll(/\s/g, ''), { mode: 0o600 })
    await execFileAsync('sh', ['-lc', `base64 -D < ${shellQuote(ciphertext)} | openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:${shellQuote(key)} | gunzip -c > ${shellQuote(plaintext)}`])
    const snapshot = JSON.parse(await readFile(plaintext, 'utf8')) as { attestation: Record<string, string>; tables: Record<string, Array<Record<string, unknown>>> }
    if (JSON.stringify(Object.keys(snapshot.tables).sort()) !== JSON.stringify([...tables].sort())) fail(`owner-side ${kind} returned an out-of-scope relation`)
    if (snapshot.attestation.database !== config.database || snapshot.attestation.effective_principal !== 'postgres' || snapshot.attestation.session_principal !== 'postgres' || snapshot.attestation.transaction_isolation !== 'repeatable read' || snapshot.attestation.transaction_read_only !== 'on' || snapshot.attestation.transaction_deferrable !== 'on' || snapshot.attestation.row_security !== 'off') fail(`owner-side ${kind} read-only attestation mismatch`)
    const result = { ...snapshot, manifest: Object.fromEntries(tables.map((table) => [table, { count: snapshot.tables[table].length, hash: createHash('md5').update(stable(snapshot.tables[table])).digest('hex') }])) }
    await writeFile(outputPath, JSON.stringify(result) + '\n', { mode: 0o600 })
    process.stdout.write(JSON.stringify({ status: 'PASS', kind, tables: Object.fromEntries(tables.map((table) => [table, result.manifest[table].count])) }) + '\n')
  } finally {
    clearTimeout(timeout)
    closeInput()
    await rm(temp, { recursive: true, force: true })
  }
}

function sqlLiteral(value: unknown, columnType?: { dataType: string; udtName: string }): string {
  if (value === null) return 'NULL'
  if (columnType?.udtName === 'jsonb') return "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb"
  if (typeof value === 'object' && value && !Array.isArray(value)
    && Object.keys(value as Record<string, unknown>).length === 2
    && '__leo538' in value && 'value' in value
    && ['bytea', 'timestamptz', 'bigint'].includes(String((value as { __leo538: unknown }).__leo538))) {
    const marker = value as { __leo538: string; value: string }
    if (marker.__leo538 === 'bytea') return "decode('" + marker.value.replaceAll("'", "''") + "', 'base64')"
    return "'" + marker.value.replaceAll("'", "''") + "'"
  }
  if (Array.isArray(value)) {
    const arrayType = columnType?.udtName?.startsWith('_') ? columnType.udtName.slice(1) + '[]' : undefined
    const literal = value.length ? 'ARRAY[' + value.map((item) => sqlLiteral(item)).join(',') + ']' : "'{}'"
    return arrayType ? literal + '::' + arrayType : literal
  }
  if (typeof value === 'object' && value) return "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb"
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const literal = "'" + String(value).replaceAll("'", "''") + "'"
  const explicitTypes: Record<string, string> = {
    text: 'text', varchar: 'varchar', timestamptz: 'timestamptz', tsvector: 'tsvector', numeric: 'numeric', uuid: 'uuid', date: 'date', time: 'time', timetz: 'timetz',
  }
  return columnType?.udtName && explicitTypes[columnType.udtName] ? literal + '::' + explicitTypes[columnType.udtName] : literal
}

function stable(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']'
  const object = value as Record<string, unknown>
  return '{' + Object.keys(object).sort().map((key) => JSON.stringify(key) + ':' + stable(object[key])).join(',') + '}'
}

async function combineBlog(ordinaryPath: string, blogPath: string, combinedPath: string) {
  const config = sourceConfig()
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest
  const exported = JSON.parse(await readFile(ordinaryPath, 'utf8')) as { tables: ExportTable[] }
  const blog = JSON.parse(await readFile(blogPath, 'utf8')) as {
    attestation: Record<string, string>
    manifest: Record<string, { count: number; hash: string }>
    tables: Record<string, Array<Record<string, unknown>>>
  }
  if (JSON.stringify(Object.keys(blog.tables).sort()) !== JSON.stringify([...manifest.blogOwnerSourceTables].sort())) fail('Blog snapshot table set mismatch')
  if (blog.attestation.database !== config.database || blog.attestation.effective_principal !== 'postgres' || blog.attestation.session_principal !== 'postgres' || blog.attestation.transaction_isolation !== 'repeatable read' || blog.attestation.transaction_read_only !== 'on' || blog.attestation.transaction_deferrable !== 'on' || blog.attestation.row_security !== 'off') fail('Blog snapshot attestation mismatch')
  for (const tableName of manifest.blogOwnerSourceTables) {
    const table = exported.tables.find((item) => item.name === tableName)
    if (!table || table.sourceAuthority !== 'owner-blog-pending') fail('Blog table placeholder mismatch: ' + tableName)
    const objects = blog.tables[tableName]
    if (objects.length !== Number(blog.manifest[tableName]?.count)) fail('Blog snapshot count mismatch: ' + tableName)
    table.rows = objects.map((row) => table.columns.map((column) => row[column] ?? null))
    const hash = createHash('sha256')
    for (const row of table.rows) hash.update(stable(row) + '\n')
    table.rowCount = table.rows.length
    table.sha256 = hash.digest('hex')
    table.sourceAuthority = 'owner-blog-readonly'
  }
  await writeFile(combinedPath, JSON.stringify(exported) + '\n', { mode: 0o600 })
  const evidence = exported.tables.map(({ name, columns, primaryKey, rowCount, sha256, sourceAuthority }) => ({ name, columns, primaryKey, rowCount, sha256, sourceAuthority }))
  process.stdout.write(JSON.stringify({ status: 'PASS', tableCount: exported.tables.length, totalRows: exported.tables.reduce((sum, table) => sum + table.rowCount, 0), exportSha256: createHash('sha256').update(JSON.stringify(evidence)).digest('hex') }) + '\n')
}

async function combineReconciliation(sourcePath: string, reconciliationPath: string, combinedPath: string) {
  const config = sourceConfig()
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest
  const exported = JSON.parse(await readFile(sourcePath, 'utf8')) as { tables: ExportTable[] }
  const reconciliation = JSON.parse(await readFile(reconciliationPath, 'utf8')) as {
    attestation: Record<string, string>
    manifest: Record<string, { count: number; hash: string }>
    tables: Record<string, Array<Record<string, unknown>>>
  }
  if (JSON.stringify(Object.keys(reconciliation.tables).sort()) !== JSON.stringify([...manifest.reconciliationOwnerSourceTables].sort())) fail('Reconciliation snapshot table set mismatch')
  if (reconciliation.attestation.database !== config.database || reconciliation.attestation.effective_principal !== 'postgres' || reconciliation.attestation.session_principal !== 'postgres' || reconciliation.attestation.transaction_isolation !== 'repeatable read' || reconciliation.attestation.transaction_read_only !== 'on' || reconciliation.attestation.transaction_deferrable !== 'on' || reconciliation.attestation.row_security !== 'off') fail('Reconciliation snapshot attestation mismatch')
  for (const tableName of manifest.reconciliationOwnerSourceTables) {
    const table = exported.tables.find((item) => item.name === tableName)
    if (!table || table.sourceAuthority !== 'owner-reconciliation-pending') fail('Reconciliation table placeholder mismatch: ' + tableName)
    const objects = reconciliation.tables[tableName]
    if (objects.length !== Number(reconciliation.manifest[tableName]?.count)) fail('Reconciliation snapshot count mismatch: ' + tableName)
    table.rows = objects.map((sourceRow) => {
      const row = { ...sourceRow }
      if (tableName === 'admin_users') {
        for (const column of Object.keys(row)) if (!manifest.adminUsersProjection.retainedColumns.includes(column)) fail('admin_users snapshot included a prohibited column')
        row.password_hash = '!LEO538-PRODUCTION-HASH-EXCLUDED!'
        row.last_login_at = null
        row.username = null
      }
      return table.columns.map((column) => row[column] ?? null)
    })
    const hash = createHash('sha256')
    for (const row of table.rows) hash.update(stable(row) + '\n')
    table.rowCount = table.rows.length
    table.sha256 = hash.digest('hex')
    table.sourceAuthority = 'owner-reconciliation-readonly'
  }
  await writeFile(combinedPath, JSON.stringify(exported) + '\n', { mode: 0o600 })
  const evidence = exported.tables.map(({ name, columns, primaryKey, rowCount, sha256, sourceAuthority }) => ({ name, columns, primaryKey, rowCount, sha256, sourceAuthority }))
  process.stdout.write(JSON.stringify({ status: 'PASS', tableCount: exported.tables.length, totalRows: exported.tables.reduce((sum, table) => sum + table.rowCount, 0), exportSha256: createHash('sha256').update(JSON.stringify(evidence)).digest('hex') }) + '\n')
}

async function renderTable(exportPath: string, tableName: string, offset = 0, limit = Number.MAX_SAFE_INTEGER) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest
  if (!manifest.retainedTables.includes(tableName)) fail('table is not retained by manifest')
  const exported = JSON.parse(await readFile(exportPath, 'utf8')) as { tables: ExportTable[] }
  const table = exported.tables.find((item) => item.name === tableName)
  if (!table) fail('table is absent from export')
  const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"'
  const columns = table.columns.map(quote).join(', ')
  const selected = table.rows.slice(offset, offset + limit)
  if (!selected.length) return
  const rows = selected.map((row) => '(' + row.map((value, index) => sqlLiteral(value, table.columnTypes?.[table.columns[index]])).join(', ') + ')').join(',\n')
  process.stdout.write('set local search_path = dpg_app, extensions, public;\n')
  process.stdout.write('insert into dpg_app.' + quote(table.name) + ' (' + columns + ') values\n' + rows + ' on conflict do nothing;\n')
}

async function renderTruncate() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest
  const tables = [...manifest.retainedTables, ...manifest.familyTables, ...manifest.excludedTables.map(({ table }) => table)]
  process.stdout.write('truncate ' + [...new Set(tables)].map((table) => 'dpg_app.' + '"' + table + '"').join(', ') + ' cascade;\n')
}

async function renderRestorePlan(exportPath: string) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest
  const exported = JSON.parse(await readFile(exportPath, 'utf8')) as { tables: ExportTable[] }
  const retained = new Set(manifest.retainedTables)
  if (manifest.loadOrder.length !== retained.size || manifest.loadOrder.some((name) => !retained.has(name))) {
    fail('manifest loadOrder is not an exact retained-table ordering')
  }
  const tables = manifest.loadOrder.map((name) => {
    const table = exported.tables.find((item) => item.name === name)
    if (!table) fail('restore-plan table is absent from export: ' + name)
    // Keep individual SQL statements beneath the execution connector's safe
    // transport envelope; long Product descriptions require a 75-row ceiling.
    return { name, rowCount: table.rowCount, batchSize: name === 'products' ? 75 : 2000 }
  })
  process.stdout.write(JSON.stringify(tables) + '\n')
}

async function renderSequences(exportPath: string) {
  const exported = JSON.parse(await readFile(exportPath, 'utf8')) as { tables: ExportTable[] }
  for (const table of exported.tables) {
    if (!table.columns.includes('id') || !['int2', 'int4', 'int8'].includes(table.columnTypes?.id?.udtName)) continue
    const quoted = '"' + table.name.replaceAll('"', '""') + '"'
    process.stdout.write("select setval(pg_get_serial_sequence('dpg_app." + quoted + "', 'id'), coalesce((select max(id) from dpg_app." + quoted + "), 1), (select count(*) > 0 from dpg_app." + quoted + ")) where pg_get_serial_sequence('dpg_app." + quoted + "', 'id') is not null;\n")
  }
}

async function renderRestoreManifest(exportPath: string) {
  const exported = JSON.parse(await readFile(exportPath, 'utf8')) as { tables: ExportTable[] }
  const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'"
  process.stdout.write('delete from dpg_control.leo538_restore_manifest;\n')
  for (const table of exported.tables) {
    process.stdout.write('insert into dpg_control.leo538_restore_manifest (table_name, row_count, sha256, source_authority) values ('
      + literal(table.name) + ', ' + table.rowCount + ', ' + literal(table.sha256) + ', ' + literal(table.sourceAuthority) + ') '
      + 'on conflict (table_name) do update set row_count=excluded.row_count, sha256=excluded.sha256, source_authority=excluded.source_authority;\n')
  }
}

async function renderFamily() {
  process.stdout.write('set local search_path = dpg_app, extensions, public;\n')
  process.stdout.write(await readFile(familyMigrationPath, 'utf8'))
}

const [mode, first, second, third, fourth] = process.argv.slice(2)
if (mode === 'export' && first) {
  await mkdir(path.dirname(path.resolve(first)), { recursive: true })
  await exportSource(path.resolve(first))
} else if (mode === 'owner-blog-snapshot' && first) {
  await ownerSnapshot('blog', path.resolve(first))
} else if (mode === 'owner-reconciliation-snapshot' && first) {
  await ownerSnapshot('reconciliation', path.resolve(first))
} else if (mode === 'render-owner-sql' && (first === 'blog' || first === 'reconciliation')) {
  process.stdout.write(Buffer.from(await ownerSnapshotSql(first)).toString('base64') + '\n')
} else if (mode === 'render-table' && first && second) {
  await renderTable(path.resolve(first), second)
} else if (mode === 'render-table-batch' && first && second && third && fourth) {
  await renderTable(path.resolve(first), second, Number(third), Number(fourth))
} else if (mode === 'render-truncate') {
  await renderTruncate()
} else if (mode === 'render-restore-plan' && first) {
  await renderRestorePlan(path.resolve(first))
} else if (mode === 'render-sequences' && first) {
  await renderSequences(path.resolve(first))
} else if (mode === 'render-restore-manifest' && first) {
  await renderRestoreManifest(path.resolve(first))
} else if (mode === 'render-family') {
  await renderFamily()
} else if (mode === 'combine-blog' && first && second && third) {
  await combineBlog(path.resolve(first), path.resolve(second), path.resolve(third))
} else if (mode === 'combine-reconciliation' && first && second && third) {
  await combineReconciliation(path.resolve(first), path.resolve(second), path.resolve(third))
} else {
  fail('usage: export <temporary-export.json> | owner-blog-snapshot <blog.json> | owner-reconciliation-snapshot <reconciliation.json> | render-owner-sql <blog|reconciliation> | combine-blog <ordinary.json> <blog.json> <combined.json> | combine-reconciliation <source.json> <reconciliation.json> <combined.json> | render-table[-batch] <combined.json> <table> [offset limit] | render-truncate | render-restore-plan <combined.json> | render-sequences <combined.json> | render-restore-manifest <combined.json> | render-family')
}
