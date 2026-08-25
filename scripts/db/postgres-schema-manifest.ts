import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { attestTarget, parseTargetConnection, sanitizeDatabaseError, type PostgresTarget } from './postgres-target'

type SchemaObject = { kind: string; identity: string; properties: unknown }

function parseArgs(argv: string[]) {
  const outIndex = argv.indexOf('--out')
  if (outIndex === -1 || !argv[outIndex + 1]) throw new Error('SCHEMA_MANIFEST_FAILED: --out is required')
  const targetIndex = argv.indexOf('--target')
  const target = (targetIndex === -1 ? 'isolated-staging' : argv[targetIndex + 1]) as PostgresTarget
  if (target !== 'disposable' && target !== 'isolated-staging') throw new Error('SCHEMA_MANIFEST_FAILED: invalid target')
  return { out: path.resolve(outIndex === -1 ? process.cwd() : argv[outIndex + 1]), target }
}

function stableJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function hash(content: string) {
  return createHash('sha256').update(content).digest('hex')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const client = new Client(parseTargetConnection(args.target, process.env.POSTGRES_MIGRATION_URL))
  try {
    await client.connect()
    const attestation = await attestTarget(client, args.target)
    const objects: SchemaObject[] = []

    const schemas = await client.query<{ schema: string }>(`
      SELECT nspname AS schema
      FROM pg_namespace
      WHERE nspname IN ('public', 'extensions')
      ORDER BY nspname
    `)
    for (const row of schemas.rows) objects.push({ kind: 'schema', identity: row.schema, properties: {} })

    const extensions = await client.query<{ name: string; version: string; schema: string }>(`
      SELECT e.extname AS name, e.extversion AS version, n.nspname AS schema
      FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
      WHERE e.extname IN ('pgcrypto', 'plpgsql', 'uuid-ossp')
      ORDER BY e.extname
    `)
    for (const row of extensions.rows) objects.push({
      kind: 'extension',
      identity: `${row.schema}.${row.name}`,
      properties: { version: row.version },
    })

    const tables = await client.query<{
      schema: string; name: string; kind: string; rls: boolean; force_rls: boolean; columns: unknown
    }>(`
      SELECT n.nspname AS schema, c.relname AS name, c.relkind AS kind,
             c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls,
             COALESCE(json_agg(json_build_object(
               'name', a.attname,
               'type', format_type(a.atttypid, a.atttypmod),
               'nullable', NOT a.attnotnull,
               'default', pg_get_expr(ad.adbin, ad.adrelid),
               'identity', a.attidentity,
               'generated', a.attgenerated
             ) ORDER BY a.attnum) FILTER (WHERE a.attnum > 0 AND NOT a.attisdropped), '[]') AS columns
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_attribute a ON a.attrelid = c.oid
      LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
      WHERE n.nspname IN ('public', 'extensions')
        AND c.relkind IN ('r', 'p')
      GROUP BY n.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity
      ORDER BY n.nspname, c.relname
    `)
    for (const row of tables.rows) objects.push({
      kind: 'table',
      identity: `${row.schema}.${row.name}`,
      properties: { relkind: row.kind, rls: row.rls, forceRls: row.force_rls, columns: row.columns },
    })

    const sequences = await client.query<{
      schema: string; name: string; start_value: string; increment_by: string; min_value: string; max_value: string; cache_size: string; cycle: boolean
    }>(`
      SELECT schemaname AS schema, sequencename AS name, start_value::text,
             increment_by::text, min_value::text, max_value::text,
             cache_size::text, cycle
      FROM pg_sequences
      WHERE schemaname IN ('public', 'extensions')
      ORDER BY schemaname, sequencename
    `)
    for (const row of sequences.rows) objects.push({
      kind: 'sequence',
      identity: `${row.schema}.${row.name}`,
      properties: {
        start: row.start_value, increment: row.increment_by, min: row.min_value,
        max: row.max_value, cache: row.cache_size, cycle: row.cycle,
      },
    })

    const indexes = await client.query<{
      schema: string; table_name: string; name: string; definition: string; is_unique: boolean; is_primary: boolean; valid: boolean; ready: boolean
    }>(`
      SELECT schemaname AS schema, tablename AS table_name, indexname AS name,
             indexdef AS definition, indexdef LIKE '% UNIQUE INDEX %' AS is_unique,
             indexname LIKE '%_pkey' AS is_primary, true AS valid, true AS ready
      FROM pg_indexes
      WHERE schemaname IN ('public', 'extensions')
      ORDER BY schemaname, tablename, indexname
    `)
    for (const row of indexes.rows) objects.push({
      kind: 'index',
      identity: `${row.schema}.${row.table_name}.${row.name}`,
      properties: { definition: row.definition, unique: row.is_unique, primary: row.is_primary, valid: row.valid, ready: row.ready },
    })

    const constraints = await client.query<{ schema: string; table_name: string; name: string; type: string; definition: string }>(`
      SELECT ns.nspname AS schema, cls.relname AS table_name, con.conname AS name,
             con.contype AS type, pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con
      JOIN pg_class cls ON cls.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
      WHERE ns.nspname IN ('public', 'extensions')
      ORDER BY ns.nspname, cls.relname, con.conname
    `)
    for (const row of constraints.rows) objects.push({
      kind: 'constraint',
      identity: `${row.schema}.${row.table_name}.${row.name}`,
      properties: { type: row.type, definition: row.definition },
    })

    const views = await client.query<{ schema: string; name: string; definition: string }>(`
      SELECT n.nspname AS schema, c.relname AS name, pg_get_viewdef(c.oid, true) AS definition
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public', 'extensions') AND c.relkind IN ('v', 'm')
      ORDER BY n.nspname, c.relname
    `)
    for (const row of views.rows) objects.push({ kind: 'view', identity: `${row.schema}.${row.name}`, properties: { definition: row.definition } })

    const functions = await client.query<{
      schema: string; name: string; args: string; definition: string; language: string; volatility: string; securityDefiner: boolean; leakproof: boolean; config: string[] | null
    }>(`
      SELECT n.nspname AS schema, p.proname AS name,
             pg_get_function_identity_arguments(p.oid) AS args,
             pg_get_functiondef(p.oid) AS definition,
             l.lanname AS language, p.provolatile AS volatility,
             p.prosecdef AS "securityDefiner", p.proleakproof AS leakproof,
             p.proconfig AS config
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_language l ON l.oid = p.prolang
      WHERE n.nspname IN ('public', 'extensions')
      ORDER BY n.nspname, p.proname, args
    `)
    for (const row of functions.rows) objects.push({
      kind: 'function',
      identity: `${row.schema}.${row.name}(${row.args})`,
      properties: {
        definition: row.definition, language: row.language, volatility: row.volatility,
        securityDefiner: row.securityDefiner, leakproof: row.leakproof, config: row.config ?? [],
      },
    })

    const triggers = await client.query<{ schema: string; table_name: string; name: string; definition: string; enabled: string }>(`
      SELECT n.nspname AS schema, c.relname AS table_name, t.tgname AS name,
             pg_get_triggerdef(t.oid) AS definition, t.tgenabled AS enabled
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE NOT t.tgisinternal AND n.nspname IN ('public', 'extensions')
      ORDER BY n.nspname, c.relname, t.tgname
    `)
    for (const row of triggers.rows) objects.push({
      kind: 'trigger',
      identity: `${row.schema}.${row.table_name}.${row.name}`,
      properties: { definition: row.definition, enabled: row.enabled },
    })

    const policies = await client.query<{ schema: string; table_name: string; name: string; permissive: string; roles: string[]; command: string; using_expr: string | null; check_expr: string | null }>(`
      SELECT n.nspname AS schema, c.relname AS table_name, p.polname AS name,
             CASE WHEN p.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END AS permissive,
             ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(p.polroles) ORDER BY rolname) AS roles,
             p.polcmd AS command, pg_get_expr(p.polqual, p.polrelid) AS using_expr,
             pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public', 'extensions')
      ORDER BY n.nspname, c.relname, p.polname
    `)
    for (const row of policies.rows) objects.push({
      kind: 'policy',
      identity: `${row.schema}.${row.table_name}.${row.name}`,
      properties: { permissive: row.permissive, roles: row.roles, command: row.command, using: row.using_expr, check: row.check_expr },
    })

    const manifest = { formatVersion: 2, source: 'isolated-postgresql-baseline-v1', objects }
    const content = stableJson(manifest)
    await writeFile(args.out, content, 'utf8')
    console.log(JSON.stringify({ status: 'PASS', output: args.out, sha256: hash(content), objectCount: objects.length, targetFingerprint: attestation.fingerprint }))
  } catch (error) {
    console.error(error instanceof Error && error.message.startsWith('TARGET_VALIDATION_FAILED:')
      ? error.message
      : `SCHEMA_MANIFEST_FAILED: ${sanitizeDatabaseError(error)}`)
    process.exitCode = 1
  } finally {
    await client.end().catch(() => undefined)
  }
}

const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
  : false
if (isDirectExecution) void main()

export { stableJson, hash }
