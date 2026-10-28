// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  SOURCE, TARGET, CONTRACT, CATALOGUE_TABLES, CATALOGUE_RESTORE_ORDER, SEQUENCE_BODY,
  connectionConfig, assertBudget, assertManifest, assertSchema, assertResume,
  insertSql, rowsSql, provisioningSql, comparableSchema,
} from './contract.mjs'

const ca = '-----BEGIN CERTIFICATE-----\nsynthetic\n-----END CERTIFICATE-----'
const sha = 'a'.repeat(40)
const validUrl = `postgresql://dpg_direct_source:synthetic@db.${SOURCE}.supabase.co:5432/postgres`
const manifest = () => ({ contract: CONTRACT, source: SOURCE, target: TARGET, codeSha: sha,
  tables: CATALOGUE_TABLES.map((name) => ({ name, count: 0, hash: 'b'.repeat(64) })) })
const schema = (namespace) => CATALOGUE_RESTORE_ORDER.map((name) => ({ name, rls: true, forceRls: true,
  insertTriggers: [], sequences: [], columns: [{ name: 'id', type: 'integer', notNull: true, generated: '',
    identity: '', default: `nextval('${namespace}.${name}_id_seq'::regclass)` }], constraints: ['PRIMARY KEY (id)'] }))

describe('direct 27-table scope and connections', () => {
  it('reuses exactly the canonical table set and restore order', () => {
    expect(CATALOGUE_TABLES).toHaveLength(27)
    expect(new Set(CATALOGUE_RESTORE_ORDER)).toEqual(new Set(CATALOGUE_TABLES))
    expect(() => rowsSql('auth', 'products')).toThrow('SCHEMA_OUTSIDE_SCOPE')
    expect(() => rowsSql('public', 'admin_sessions')).toThrow('TABLE_OUTSIDE_ALLOWLIST')
    expect(() => insertSql('products', ['id;drop table products'])).toThrow('UNSAFE_IDENTIFIER')
  })
  it('binds CA and hostname verification without pg connection-string SSL overrides', () => {
    const config = connectionConfig(validUrl, ca, SOURCE)
    expect(config.ssl.rejectUnauthorized).toBe(true)
    expect(config.ssl.servername).toBe(`db.${SOURCE}.supabase.co`)
    expect(config.ssl.checkServerIdentity).toBeTypeOf('function')
    expect(config.connectionString).toBeUndefined()
  })
  it.each([
    validUrl.replace(SOURCE, TARGET), validUrl.replace('db.', 'evil.'),
    validUrl.replace(':5432', ':6543'), validUrl + '?sslmode=no-verify',
    validUrl.replace('/postgres', '/other'), validUrl.replace('dpg_direct_source:', 'postgres:'),
  ])('rejects wrong identity, non-session ports, and connection options', (url) => {
    expect(() => connectionConfig(url, ca, SOURCE)).toThrow()
  })
  it('checks pooler user suffix as well as exact Supabase pooler hostname', () => {
    const url = `postgresql://reader.${SOURCE}:synthetic@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`
    expect(connectionConfig(url, ca, SOURCE).port).toBe(5432)
    expect(() => connectionConfig(url.replace(`.${SOURCE}:`, `.${TARGET}:`), ca, SOURCE)).toThrow('WRONG_PROJECT')
  })
  it('requires a complete unique manifest and immutable checkpoint when resuming', () => {
    expect(assertManifest(manifest()).tables).toHaveLength(27)
    const invalid = manifest(); invalid.tables[0] = invalid.tables[1]
    expect(() => assertManifest(invalid)).toThrow('MANIFEST_TABLE_SET')
    expect(() => assertResume('import', '')).toThrow('CHECKPOINT_REQUIRED')
    expect(() => assertResume('export', sha)).toThrow('CHECKPOINT_REQUIRED')
    expect(() => assertResume('verify', sha)).not.toThrow()
  })
  it('requires recent account-wide $0 evidence and bounded private checkpoint headroom', () => {
    const now = Date.now()
    const good = { verifiedAt: new Date(now).toISOString(), billableUsd: 0,
      paidUsageBlocked: true, checkpointBytesRemaining: 200000000 }
    expect(() => assertBudget(good, now)).not.toThrow()
    expect(() => assertBudget({ ...good, billableUsd: 1 }, now)).toThrow('ZERO_COST')
    expect(() => assertBudget({ ...good, checkpointBytesRemaining: 1 }, now)).toThrow('QUOTA')
    expect(() => assertBudget(good, now + 86400001)).toThrow('STALE')
    expect(() => assertBudget(good, now - 1)).toThrow('STALE')
  })
})

describe('schema mapping and reversible sequence control', () => {
  it('maps schema qualification but preserves constraints, defaults, and precision', () => {
    expect(comparableSchema(schema('public'))).toEqual(comparableSchema(schema('dpg_app')))
    expect(() => assertSchema(schema('public'), schema('dpg_app'))).not.toThrow()
    const changed = schema('dpg_app'); changed[0].columns[0].type = 'bigint'
    expect(() => assertSchema(schema('public'), changed)).toThrow('SCHEMA_MAPPING_MISMATCH')
  })
  it('rejects unreviewed triggers, generated columns and absent forced RLS', () => {
    const triggered = schema('dpg_app'); triggered[0].insertTriggers = ['side_effect']
    expect(() => assertSchema(schema('public'), triggered)).toThrow('INSERT_TRIGGER')
    const unprotected = schema('dpg_app'); unprotected[0].forceRls = false
    expect(() => assertSchema(schema('public'), unprotected)).toThrow('TARGET_RLS')
  })
  it('preserves identity keys and JSON numeric precision with explicit column insert', () => {
    expect(insertSql('products', ['id', 'price'])).toBe('insert into dpg_app."products" ("id", "price") overriding system value select "id", "price" from json_populate_recordset(null::dpg_app."products", $1::json)')
  })
  it('generates password-free, bounded role setup without touching default ACLs or old roles', () => {
    const sql = provisioningSql('import')
    expect(sql).toContain('create role dpg_direct_import nologin')
    expect(sql).toContain('grant select, insert on dpg_app."products"')
    expect(sql).toContain('revoke all on function')
    expect(sql.replace(/^--.*$/gm, '')).not.toMatch(/alter role|password|grant all|grant update on|grant delete on|setval\(/i)
    expect(SEQUENCE_BODY).toContain('alter sequence %s restart with %s')
    expect(SEQUENCE_BODY).toContain("session_user <> 'dpg_direct_import'")
  })
  it('separates the new workflow from backup, manual approvals and Production', () => {
    const workflow = readFileSync(new URL('../../.github/workflows/catalogue-direct-migration.yml', import.meta.url), 'utf8')
    expect(workflow).toContain('environment: catalogue-direct-migration')
    expect(workflow).not.toContain('environment: runtime-backup')
    expect(workflow).not.toContain('upload-artifact')
    expect(workflow).not.toMatch(/wrangler|production-promotion|workflow_run:/i)
    expect(workflow).toContain('github.run_attempt == 1')
    expect(workflow).toContain('cancel-in-progress: false')
  })
})
