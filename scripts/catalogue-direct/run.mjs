import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { readFile, writeFile, mkdtemp, rm, statfs } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { createGzip, createGunzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import { createInterface } from 'node:readline'
import {
  CONTRACT, SOURCE, TARGET, SHA, CATALOGUE_TABLES, CATALOGUE_RESTORE_ORDER,
  DATABASE_CEILING, CHECKPOINT_CEILING, requireGate, digest, identifier, tableIdentifier,
  connectionConfig, assertBudget, assertManifest, assertSchema, rowsSql, insertSql, assertResume,
  SEQUENCE_BODY,
} from './contract.mjs'

const env = process.env
let directory
let phase = 'preflight'
let targetWriteAttempted = false
const connections = []
const vaultApi = 'https://api.github.com/repos/'

async function vault(path, method = 'GET', body) {
  requireGate(/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(env.DIRECT_VAULT_REPOSITORY ?? ''), 'VAULT_CONFIGURATION')
  const response = await fetch(`${vaultApi}${env.DIRECT_VAULT_REPOSITORY}${path}`, {
    method, signal: AbortSignal.timeout(60000), redirect: 'error',
    headers: { Authorization: `Bearer ${env.DIRECT_VAULT_TOKEN}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  requireGate(response.ok, 'VAULT_REQUEST_FAILED')
  return response.json()
}

async function saveCheckpoint(file, kind, reference = randomUUID()) {
  const bytes = await readFile(file)
  requireGate(bytes.length <= CHECKPOINT_CEILING, 'CHECKPOINT_CAPACITY')
  const tree = []
  const parts = []
  for (let offset = 0; offset < bytes.length; offset += 16000000) {
    const part = bytes.subarray(offset, offset + 16000000)
    const path = `${String(parts.length).padStart(4, '0')}.agepart`
    const blob = await vault('/git/blobs', 'POST', { content: part.toString('base64'), encoding: 'base64' })
    parts.push({ path, bytes: part.length, hash: digest(part) })
    tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha })
  }
  const receipt = { contract: CONTRACT, kind, source: SOURCE, target: TARGET, codeSha: env.GITHUB_SHA,
    bytes: bytes.length, hash: digest(bytes), parts }
  const blob = await vault('/git/blobs', 'POST', { content: JSON.stringify(receipt), encoding: 'utf-8' })
  tree.push({ path: 'receipt.json', mode: '100644', type: 'blob', sha: blob.sha })
  const created = await vault('/git/trees', 'POST', { tree })
  const commit = await vault('/git/commits', 'POST', {
    message: `Immutable direct catalogue ${kind}`, tree: created.sha, parents: [],
  })
  // A new orphan ref preserves every original backup/default branch. Never PATCH a ref.
  await vault('/git/refs', 'POST', { ref: `refs/heads/direct-${reference}`, sha: commit.sha })
  const verification = join(directory, 'readback.age')
  await loadCheckpoint(commit.sha, verification, kind)
  requireGate(digest(await readFile(verification)) === digest(bytes), 'CHECKPOINT_READBACK')
  return commit.sha
}

async function loadCheckpoint(sha, file, kind) {
  requireGate(SHA.test(sha ?? ''), 'CHECKPOINT_REQUIRED')
  const commit = await vault(`/git/commits/${sha}`)
  const listing = await vault(`/git/trees/${commit.tree.sha}`)
  requireGate(!listing.truncated, 'CHECKPOINT_TREE')
  const receiptEntry = listing.tree.find((item) => item.path === 'receipt.json' && item.type === 'blob')
  requireGate(receiptEntry, 'CHECKPOINT_RECEIPT')
  const blob = await vault(`/git/blobs/${receiptEntry.sha}`)
  const receipt = JSON.parse(Buffer.from(blob.content, 'base64').toString('utf8'))
  requireGate(receipt.contract === CONTRACT && receipt.source === SOURCE && receipt.target === TARGET
    && receipt.kind === kind && SHA.test(receipt.codeSha), 'CHECKPOINT_IDENTITY')
  // A new code SHA needs an explicit reviewed compatibility decision; never silently promote old data.
  requireGate(receipt.codeSha === env.GITHUB_SHA, 'CHECKPOINT_CODE_MISMATCH')
  requireGate(Number.isSafeInteger(receipt.bytes) && receipt.bytes > 0
    && receipt.bytes <= CHECKPOINT_CEILING && Array.isArray(receipt.parts)
    && receipt.parts.length > 0 && receipt.parts.length <= 13, 'CHECKPOINT_CAPACITY')
  const parts = []
  for (const [index, part] of receipt.parts.entries()) {
    requireGate(part.path === `${String(index).padStart(4, '0')}.agepart`, 'CHECKPOINT_PART')
    const entry = listing.tree.find((item) => item.path === part.path && item.type === 'blob')
    requireGate(entry, 'CHECKPOINT_PART')
    const remote = await vault(`/git/blobs/${entry.sha}`)
    const content = Buffer.from(remote.content, 'base64')
    requireGate(content.length === part.bytes && digest(content) === part.hash, 'CHECKPOINT_PART_HASH')
    parts.push(content)
  }
  const bytes = Buffer.concat(parts)
  requireGate(bytes.length === receipt.bytes && digest(bytes) === receipt.hash, 'CHECKPOINT_HASH')
  await writeFile(file, bytes, { mode: 0o600 })
  return receipt
}

async function age(operation, input, output) {
  const identity = join(directory, 'identity')
  await writeFile(identity, env.DIRECT_CHECKPOINT_AGE_IDENTITY, { mode: 0o600 })
  const args = operation === 'decrypt' ? ['--decrypt', '--identity', identity]
    : ['--encrypt', '--recipient', await recipient(identity)]
  const child = spawn('age', args, { env: { PATH: env.PATH }, stdio: ['pipe', 'pipe', 'ignore'] })
  const exited = new Promise((resolve, reject) => {
    child.on('error', () => reject(new Error('AGE_FAILED')))
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error('AGE_FAILED')))
  })
  await Promise.all([
    pipeline(createReadStream(input), ...(operation === 'encrypt' ? [createGzip()] : []), child.stdin),
    pipeline(child.stdout, ...(operation === 'decrypt' ? [createGunzip()] : []), createWriteStream(output, { mode: 0o600 })), exited,
  ])
}

async function recipient(identity) {
  const child = spawn('age-keygen', ['-y', identity], { env: { PATH: env.PATH }, stdio: ['ignore', 'pipe', 'ignore'] })
  let result = ''
  for await (const chunk of child.stdout) result += chunk
  const code = await new Promise((resolve, reject) => { child.on('close', resolve); child.on('error', reject) })
  requireGate(code === 0 && /^age1[a-z0-9]+\s*$/.test(result), 'CHECKPOINT_IDENTITY_REQUIRED')
  return result.trim()
}

async function connect(purpose) {
  const { default: pg } = await import('pg')
  const source = purpose === 'source'
  const client = new pg.Client(connectionConfig(
    env[source ? 'DIRECT_SOURCE_DATABASE_URL' : purpose === 'import' ? 'DIRECT_TARGET_IMPORT_DATABASE_URL' : 'DIRECT_TARGET_READ_DATABASE_URL'],
    env[source ? 'DIRECT_SOURCE_CA' : 'DIRECT_TARGET_CA'], source ? SOURCE : TARGET))
  connections.push(client)
  // Never let an asynchronous pg error print connection material or a row.
  client.on('error', () => { process.exitCode = 1 })
  await client.connect()
  await client.query('set row_security = off')
  const { rows: [role] } = await client.query(`select r.rolsuper, r.rolcreatedb, r.rolcreaterole,
    r.rolreplication, r.rolbypassrls, current_user as name from pg_roles r where rolname=current_user`)
  requireGate(role && !role.rolsuper && !role.rolcreatedb && !role.rolcreaterole
    && !role.rolreplication && role.rolbypassrls && role.name !== 'postgres', 'ROLE_ATTRIBUTES')
  const schema = source ? 'public' : 'dpg_app'
  const rights = await client.query(`select n.nspname as schema, c.relname as name,
    has_table_privilege(c.oid, 'SELECT') as read,
    has_table_privilege(c.oid, 'INSERT') as insert,
    has_table_privilege(c.oid, 'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as other
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind in ('r','p','v','m','f') and n.nspname !~ '^pg_' and n.nspname <> 'information_schema'`)
  for (const right of rights.rows) {
    const allowed = right.schema === schema && CATALOGUE_TABLES.includes(right.name)
    requireGate(!right.other && (!right.read || allowed) && (!right.insert || (allowed && purpose === 'import')), 'ROLE_TABLE_BOUNDARY')
  }
  requireGate(rights.rows.filter((r) => r.schema === schema && CATALOGUE_TABLES.includes(r.name) && r.read
    && (purpose !== 'import' || r.insert)).length === 27, 'ROLE_TABLE_SET')
  const { rows: [extra] } = await client.query(`select
    exists(select 1 from pg_roles r where r.oid <> (select oid from pg_roles where rolname=current_user)
      and pg_has_role(current_user, r.oid, 'MEMBER')) as membership,
    exists(select 1 from pg_namespace n where n.nspname !~ '^pg_'
      and has_schema_privilege(n.oid,'CREATE')) as ddl,
    exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname !~ '^pg_' and p.prosecdef and has_function_privilege(p.oid,'EXECUTE')
      and not ($1::boolean and p.oid=to_regprocedure('dpg_app.direct_catalogue_restart(text,text,bigint)'))) as definer,
    has_database_privilege(current_database(),'CREATE') as dbcreate`, [purpose === 'import'])
  requireGate(!extra.membership && !extra.ddl && !extra.definer && !extra.dbcreate, 'ROLE_AUTHORITY_BOUNDARY')
  if (purpose === 'import') {
    requireGate(role.name === 'dpg_direct_import', 'IMPORT_IDENTITY')
    const { rows: [helper] } = await client.query(`select p.prosrc,p.prosecdef,p.proconfig,
      l.lanname,pg_get_userbyid(p.proowner) as owner from pg_proc p join pg_language l on l.oid=p.prolang
      where p.oid='dpg_app.direct_catalogue_restart(text,text,bigint)'::regprocedure`)
    requireGate(helper?.prosrc === SEQUENCE_BODY && helper.prosecdef && helper.lanname === 'plpgsql'
      && JSON.stringify(helper.proconfig) === JSON.stringify(['search_path=pg_catalog'])
      && helper.owner !== role.name, 'SEQUENCE_HELPER_ATTESTATION')
  }
  return client
}

export async function metadata(client, schema) {
  const tables = []
  for (const name of CATALOGUE_RESTORE_ORDER) {
    const relation = `${schema}.${name}`
    const { rows: columns } = await client.query(`select a.attname as name, format_type(a.atttypid,a.atttypmod) as type,
      a.attnotnull as "notNull", a.attgenerated as generated, a.attidentity as identity,
      pg_get_expr(d.adbin,d.adrelid) as default
      from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid=$1::regclass and a.attnum>0 and not a.attisdropped order by a.attnum`, [relation])
    const { rows: constraints } = await client.query(`select pg_get_constraintdef(oid) as definition
      from pg_constraint where conrelid=$1::regclass order by contype,pg_get_constraintdef(oid)`, [relation])
    const { rows: [security] } = await client.query(`select relrowsecurity as rls, relforcerowsecurity as "forceRls"
      from pg_class where oid=$1::regclass`, [relation])
    const { rows: triggers } = await client.query(`select tgname from pg_trigger
      where tgrelid=$1::regclass and not tgisinternal and tgenabled<>'D' and (tgtype & 4)=4`, [relation])
    const sequences = []
    for (const column of columns) {
      const { rows: [linked] } = await client.query('select pg_get_serial_sequence($1,$2) as name', [relation, column.name])
      if (linked.name) {
        const [namespace, sequence] = linked.name.split('.')
        requireGate(namespace === schema && sequence && linked.name.split('.').length === 2, 'SEQUENCE_SCOPE')
        const { rows: [state] } = await client.query(`select last_value::text, is_called from ${identifier(namespace)}.${identifier(sequence)}`)
        const { rows: [definition] } = await client.query('select seqincrement::text,seqmin::text,seqmax::text from pg_sequence where seqrelid=$1::regclass', [linked.name])
        requireGate(definition.seqincrement === '1', 'SEQUENCE_INCREMENT_REVIEW')
        const next = BigInt(state.last_value) + (state.is_called ? 1n : 0n)
        sequences.push({ column: column.name, name: sequence, next: next.toString(), state, definition })
      }
    }
    tables.push({ name, columns, constraints: constraints.map((c) => c.definition), ...security,
      insertTriggers: triggers.map((t) => t.tgname), sequences })
  }
  return tables
}

async function scan(client, schema, table, onRow = async () => {}) {
  const hash = createHash('sha256')
  let count = 0
  await client.query(`declare direct_rows no scroll cursor for ${rowsSql(schema, table)}`)
  try {
    while (true) {
      const { rows } = await client.query('fetch forward 500 from direct_rows')
      if (!rows.length) break
      for (const { row_text: text } of rows) {
        hash.update(text + '\n'); count++
        await onRow(text)
      }
    }
  } finally { await client.query('close direct_rows') }
  return { name: table, count, hash: hash.digest('hex') }
}

async function exportSource() {
  const client = await connect('source')
  await client.query('begin isolation level repeatable read read only')
  const schema = await metadata(client, 'public')
  const path = join(directory, 'source.jsonl')
  const output = createWriteStream(path, { mode: 0o600 })
  const line = async (value) => {
    if (!output.write(JSON.stringify(value) + '\n')) await new Promise((resolve) => output.once('drain', resolve))
  }
  try {
    const { rows: [footprint] } = await client.query(`select sum(pg_total_relation_size(c.oid))::text as bytes
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
      and c.relname=any($1::text[])`, [CATALOGUE_TABLES])
    await line({ kind: 'header', contract: CONTRACT, source: SOURCE, target: TARGET,
      codeSha: env.GITHUB_SHA, footprint: footprint.bytes, schema })
    const tables = []
    for (const table of CATALOGUE_RESTORE_ORDER) {
      tables.push(await scan(client, 'public', table, (row) => line({ kind: 'row', table, row })))
    }
    const manifest = assertManifest({ contract: CONTRACT, source: SOURCE, target: TARGET, codeSha: env.GITHUB_SHA, tables })
    await line({ kind: 'manifest', ...manifest })
    output.end()
    await new Promise((resolve, reject) => { output.on('finish', resolve); output.on('error', reject) })
    await client.query('commit')
    phase = 'M1_encrypt'
    const encrypted = join(directory, 'source.age')
    await age('encrypt', path, encrypted)
    phase = 'M1_durable_checkpoint'
    const checkpoint = await saveCheckpoint(encrypted, 'source')
    return { stage: 'M1', checkpoint, tables: 27, rows: tables.reduce((sum, t) => sum + t.count, 0) }
  } catch (error) { output.destroy(); throw error }
}

async function readSource(checkpoint) {
  const encrypted = join(directory, 'source.age')
  await loadCheckpoint(checkpoint, encrypted, 'source')
  const path = join(directory, 'source.jsonl')
  await age('decrypt', encrypted, path)
  const hashes = new Map(CATALOGUE_TABLES.map((t) => [t, { hash: createHash('sha256'), count: 0 }]))
  let header, manifest, lastIndex = -1
  for await (const value of sourceLines(path)) {
    requireGate(!manifest, 'DATA_AFTER_MANIFEST')
    if (value.kind === 'header') { requireGate(!header && lastIndex === -1, 'DUPLICATE_HEADER'); header = value }
    else if (value.kind === 'row') {
      requireGate(header && typeof value.row === 'string', 'ROW_BEFORE_HEADER')
      const index = CATALOGUE_RESTORE_ORDER.indexOf(value.table)
      requireGate(index >= lastIndex && index >= 0, 'TABLE_ORDER')
      lastIndex = index
      const entry = hashes.get(value.table)
      entry.hash.update(value.row + '\n'); entry.count++
    } else if (value.kind === 'manifest') manifest = assertManifest(value)
    else throw new Error('UNKNOWN_CHECKPOINT_RECORD')
  }
  requireGate(header?.contract === CONTRACT && header.source === SOURCE && header.target === TARGET
    && header.codeSha === env.GITHUB_SHA && manifest, 'CHECKPOINT_HEADER')
  requireGate(header.schema?.length === 27 && new Set(header.schema.map((t) => t.name)).size === 27
    && CATALOGUE_TABLES.every((t) => header.schema.some((m) => m.name === t)), 'CHECKPOINT_SCHEMA')
  for (const table of manifest.tables) {
    const entry = hashes.get(table.name)
    requireGate(entry.count === table.count && entry.hash.digest('hex') === table.hash, 'SOURCE_DATA_HASH')
  }
  return { path, header, manifest }
}

async function* sourceLines(path) {
  const input = createReadStream(path)
  const lines = createInterface({ input, crlfDelay: Infinity })
  try { for await (const line of lines) yield JSON.parse(line) }
  finally { lines.close(); input.destroy() }
}

async function targetSnapshot(client, schema) {
  const { rows: [size] } = await client.query('select pg_database_size(current_database())::text as bytes')
  requireGate(BigInt(size.bytes) < BigInt(DATABASE_CEILING), 'DATABASE_CAPACITY')
  const tables = []
  for (const table of CATALOGUE_RESTORE_ORDER) tables.push(await scan(client, 'dpg_app', table))
  return { schema, tables, bytes: size.bytes }
}

async function verifyData(client, source, targetSchema, checkSequences) {
  for (const expected of source.manifest.tables) {
    const actual = await scan(client, 'dpg_app', expected.name)
    requireGate(actual.count === expected.count && actual.hash === expected.hash, 'TARGET_DATA_MISMATCH')
  }
  if (checkSequences) {
    for (const table of source.header.schema) {
      const actual = targetSchema.find((t) => t.name === table.name)
      for (const sequence of table.sequences) {
        requireGate(actual.sequences.some((s) => s.column === sequence.column && s.next === sequence.next), 'TARGET_SEQUENCE_MISMATCH')
      }
    }
  }
  const { rows: [size] } = await client.query('select pg_database_size(current_database())::text as bytes')
  requireGate(BigInt(size.bytes) < BigInt(DATABASE_CEILING), 'DATABASE_CAPACITY')
  return { stage: 'M3', tables: 27, rows: source.manifest.tables.reduce((sum, t) => sum + t.count, 0), bytes: size.bytes }
}

async function importTarget(checkpoint, source) {
  const reader = await connect('read')
  await reader.query('begin isolation level repeatable read read only')
  const before = await targetSnapshot(reader, await metadata(reader, 'dpg_app'))
  assertSchema(source.header.schema, before.schema)
  requireGate(/^\d+$/.test(source.header.footprint ?? '') && BigInt(before.bytes) + BigInt(source.header.footprint)
    < BigInt(DATABASE_CEILING), 'PROJECTED_DATABASE_CAPACITY')
  requireGate(before.tables.every((t) => t.count === 0), 'TARGET_NOT_EMPTY_VERIFY_INSTEAD')
  await reader.query('commit')
  // A durable affected-state receipt precedes the write attempt. Its fixed ref is a one-shot lock.
  const snapshotPath = join(directory, 'before.json')
  await writeFile(snapshotPath, JSON.stringify({ sourceCheckpoint: checkpoint, ...before }), { mode: 0o600 })
  const encrypted = join(directory, 'before.age')
  await age('encrypt', snapshotPath, encrypted)
  phase = 'M2_attempt_checkpoint'
  const beforeCheckpoint = await saveCheckpoint(encrypted, 'target-before', `attempt-${checkpoint}`)
  console.log(JSON.stringify({ status: 'PASS', stage: 'M2_before', checkpoint: beforeCheckpoint }))
  const writer = await connect('import')
  await writer.query('begin isolation level serializable')
  try {
    requireGate((await writer.query('select pg_try_advisory_xact_lock(160,27) as locked')).rows[0].locked, 'MUTATION_OWNER_BUSY')
    const current = await targetSnapshot(writer, await metadata(writer, 'dpg_app'))
    requireGate(JSON.stringify(current.schema) === JSON.stringify(before.schema)
      && current.tables.every((t) => t.count === 0), 'DESTINATION_CHANGED')
    assertSchema(source.header.schema, current.schema)
    const columns = new Map(current.schema.map((t) => [t.name, t.columns.map((c) => c.name)]))
    let table, batch = []
    const flush = async () => {
      if (!batch.length) return
      targetWriteAttempted = true
      await writer.query(insertSql(table, columns.get(table)), ['[' + batch.join(',') + ']'])
      batch = []
    }
    phase = 'M2_atomic_import'
    for await (const value of sourceLines(source.path)) {
      if (value.kind !== 'row') continue
      if (value.table !== table) { await flush(); table = value.table }
      batch.push(value.row)
      if (batch.length === 250) await flush()
    }
    await flush()
    await writer.query('set constraints all immediate')
    await verifyData(writer, source, current.schema, false)
    phase = 'M2_transactional_sequences'
    for (const item of source.header.schema) for (const sequence of item.sequences) {
      await writer.query('select dpg_app.direct_catalogue_restart($1,$2,$3::bigint)', [item.name, sequence.column, sequence.next])
    }
    await verifyData(writer, source, await metadata(writer, 'dpg_app'), true)
    phase = 'M2_commit'
    await writer.query('commit')
  } catch (error) {
    // Even an ambiguous COMMIT never causes automatic import replay. Keep the attempt ref.
    try { await writer.query('rollback') } catch { /* independent verify is required */ }
    throw error
  }
  return { stage: 'M2', checkpoint, beforeCheckpoint, status: 'COMMITTED_REQUIRES_M3' }
}

async function main() {
  const stage = env.DIRECT_STAGE
  assertResume(stage, env.DIRECT_CHECKPOINT)
  requireGate(env.GITHUB_ACTIONS === 'true' && env.GITHUB_REF === 'refs/heads/main'
    && env.GITHUB_REPOSITORY === 'tranhuunguyenhuy-hue/dongphugia.com.vn'
    && env.GITHUB_ACTOR === 'tranhuunguyenhuy-hue' && env.GITHUB_RUN_ATTEMPT === '1'
    && SHA.test(env.GITHUB_SHA ?? '') && env.DIRECT_APPROVED_SHA === env.GITHUB_SHA, 'EXECUTION_AUTHORITY')
  assertBudget(JSON.parse(env.DIRECT_ZERO_COST_ATTESTATION ?? 'null'))
  requireGate((await readFile('/proc/swaps', 'utf8')).trim().split('\n').length === 1, 'SWAP_FORBIDDEN')
  const filesystem = await statfs('/dev/shm')
  requireGate(filesystem.type === 0x01021994 && filesystem.bavail * filesystem.bsize >= 3 * 1024 ** 3, 'TMPFS_CAPACITY')
  requireGate(env.DIRECT_CHECKPOINT_AGE_IDENTITY && env.DIRECT_VAULT_TOKEN, 'CHECKPOINT_SECRETS_REQUIRED')
  const info = await vault('')
  requireGate(info.private === true && info.owner?.login === 'tranhuunguyenhuy-hue' && info.permissions?.push, 'OWNER_PRIVATE_VAULT_REQUIRED')
  directory = await mkdtemp('/dev/shm/dpg-direct-')
  phase = stage === 'export' ? 'M1_source_export' : 'checkpoint_readback'
  const result = stage === 'export' ? await exportSource() : await (async () => {
    const source = await readSource(env.DIRECT_CHECKPOINT)
    if (stage === 'import') return importTarget(env.DIRECT_CHECKPOINT, source)
    phase = 'M3_independent_read'
    const reader = await connect('read')
    await reader.query('begin isolation level repeatable read read only')
    const targetSchema = await metadata(reader, 'dpg_app')
    assertSchema(source.header.schema, targetSchema)
    const verified = await verifyData(reader, source, targetSchema, true)
    await reader.query('commit')
    return { ...verified, checkpoint: env.DIRECT_CHECKPOINT }
  })()
  console.log(JSON.stringify({ status: 'PASS', ...result }))
  if (env.GITHUB_STEP_SUMMARY) await writeFile(env.GITHUB_STEP_SUMMARY,
    'Direct catalogue result (sanitized)\n\n```json\n' + JSON.stringify({ status: 'PASS', ...result }) + '\n```\n')
}

if (process.argv[1]?.endsWith('/run.mjs')) {
  main().catch((error) => {
    // Intentionally no original error, stack, SQL, server response, path, or row.
    const reason = /^[A-Z_]+$/.test(error?.message ?? '') ? error.message : 'PROTECTED_OPERATION_FAILED'
    console.log(JSON.stringify({ status: 'STOP', stage: phase, reason, targetWriteAttempted,
      state: 'PRESERVE_CHECKPOINT_VERIFY_BEFORE_RESUME' }))
    process.exitCode = 1
  }).finally(async () => {
    await Promise.allSettled(connections.map((c) => c.end()))
    if (directory) await rm(directory, { recursive: true, force: true })
    for (const key of Object.keys(env)) if (key.startsWith('DIRECT_')) delete env[key]
  })
}
