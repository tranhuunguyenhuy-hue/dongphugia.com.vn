// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  SOURCE, TARGET, CONTRACT, RECOVERY_ID, CHECKPOINT_CEILING, HEADROOM_BODY, CATALOGUE_TABLES, CATALOGUE_RESTORE_ORDER, SEQUENCE_BODY,
  connectionConfig, assertBudget, assertCandidateBudget, assertPublicPreviewBudget, assertManifest, assertSchema, assertResume,
  insertSql, rowsSql, provisioningSql, comparableSchema, normalizeDefinition,
} from './contract.mjs'

const ca = '-----BEGIN CERTIFICATE-----\nsynthetic\n-----END CERTIFICATE-----'
const sha = 'a'.repeat(40)
it('normalizes only the two exact equivalent stock-status CHECK cast forms', () => {
  const source="CHECK (((stock_status)::text = ANY ((ARRAY['in_stock'::character varying, 'out_of_stock'::character varying, 'discontinued'::character varying, 'contact'::character varying, 'pre_order'::character varying])::text[])))"
  const target="CHECK (((stock_status)::text = ANY (ARRAY[('in_stock'::character varying)::text, ('out_of_stock'::character varying)::text, ('discontinued'::character varying)::text, ('contact'::character varying)::text, ('pre_order'::character varying)::text])))"
  expect(normalizeDefinition(target)).toBe(normalizeDefinition(source))
  expect(normalizeDefinition(target.replace('pre_order','unexpected'))).not.toBe(normalizeDefinition(source))
  expect(normalizeDefinition(target+' NOT VALID')).not.toBe(normalizeDefinition(source))
})
const validUrl = `postgresql://dpg_direct_source:synthetic@db.${SOURCE}.supabase.co:5432/postgres`
const manifest = () => {
  const counts = { products: 17752, product_images: 110321, product_descriptions: 17752, product_spec_values: 135311, brands: 94085 }
  return { contract: CONTRACT, source: SOURCE, target: TARGET, codeSha: sha,
    tables: CATALOGUE_TABLES.map((name) => ({ name, count: counts[name] ?? 0, hash: 'b'.repeat(64) })) }
}
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
  it('rejects empty or changed source baseline instead of claiming a successful empty recovery', () => {
    const empty = manifest(); empty.tables.forEach((t) => { t.count = 0 })
    expect(() => assertManifest(empty)).toThrow('SOURCE_BASELINE_DRIFT_REVIEW_REQUIRED')
    const drift = manifest(); drift.tables.find((t) => t.name === 'products').count++
    expect(() => assertManifest(drift)).toThrow('SOURCE_BASELINE_DRIFT_REVIEW_REQUIRED')
  })
  it('requires recent account-wide $0 evidence and bounded private checkpoint headroom', () => {
    const now = Date.now()
    const good = { recoveryId: RECOVERY_ID, verifiedAt: new Date(now).toISOString(), billableUsd: 0,
      paidUsageBlocked: true, checkpointBytesRemaining: 200000000 }
    expect(() => assertBudget(good, now)).not.toThrow()
    expect(() => assertBudget({ ...good, billableUsd: 1 }, now)).toThrow('ZERO_COST')
    expect(() => assertBudget({ ...good, checkpointBytesRemaining: 1 }, now)).toThrow('QUOTA')
    expect(() => assertBudget(good, now + 86400001)).toThrow('STALE')
    expect(() => assertBudget(good, now - 1)).toThrow('STALE')
  })
  it('allows only the non-publishing candidate to use fresh cost evidence without vault headroom', () => {
    const now = Date.now()
    const costOnly = { recoveryId: RECOVERY_ID, verifiedAt: new Date(now).toISOString(),
      billableUsd: 0, paidUsageBlocked: true }
    expect(() => assertCandidateBudget(costOnly, now)).not.toThrow()
    expect(() => assertCandidateBudget({ ...costOnly, checkpointBytesRemaining: 0 }, now)).not.toThrow()
    expect(() => assertCandidateBudget({ ...costOnly, verifiedAt: new Date(now - 86400001).toISOString() }, now))
      .toThrow('BUDGET_EVIDENCE_STALE')
    const staleFullEvidence = { ...costOnly, checkpointBytesRemaining: CHECKPOINT_CEILING,
      verifiedAt: new Date(now - 86400001).toISOString() }
    expect(() => assertBudget(staleFullEvidence, now)).toThrow('BUDGET_EVIDENCE_STALE')
    expect(() => assertBudget(costOnly, now)).toThrow('CHECKPOINT_QUOTA_REQUIRED')
    expect(() => assertBudget({ ...costOnly, checkpointBytesRemaining: 1 }, now)).toThrow('CHECKPOINT_QUOTA_REQUIRED')
    expect(() => assertCandidateBudget({ ...costOnly, billableUsd: 1 }, now)).toThrow('ZERO_COST_EVIDENCE_REQUIRED')
    expect(() => assertCandidateBudget({ ...costOnly, paidUsageBlocked: false }, now)).toThrow('ZERO_COST_EVIDENCE_REQUIRED')
    expect(() => assertCandidateBudget({ ...costOnly, recoveryId: 'other' }, now)).toThrow('ZERO_COST_EVIDENCE_REQUIRED')
    expect(() => assertCandidateBudget({ ...costOnly, verifiedAt: new Date(now - 86400001).toISOString() }, now))
      .toThrow('BUDGET_EVIDENCE_STALE')
    expect(() => assertCandidateBudget({ ...costOnly, verifiedAt: new Date(now + 1).toISOString() }, now))
      .toThrow('BUDGET_EVIDENCE_STALE')
    expect(() => assertCandidateBudget({ ...costOnly, verifiedAt: '2026-10-30T12:00:00+07:00' }, now))
      .toThrow('BUDGET_EVIDENCE_TIMESTAMP_INVALID')
    expect(() => assertCandidateBudget({ ...costOnly, verifiedAt: '2026-02-30T12:00:00.000Z' }, now))
      .toThrow('BUDGET_EVIDENCE_TIMESTAMP_INVALID')
  })
  it('keeps publication routing and its full headroom gate executable', () => {
    const now = Date.now()
    const costOnly = { recoveryId: RECOVERY_ID, verifiedAt: new Date(now).toISOString(),
      billableUsd: 0, paidUsageBlocked: true }
    const full = { ...costOnly, checkpointBytesRemaining: CHECKPOINT_CEILING }
    expect(() => assertPublicPreviewBudget(false, full, costOnly, now)).not.toThrow()
    expect(() => assertPublicPreviewBudget(false, full, undefined, now)).toThrow('ZERO_COST_EVIDENCE_REQUIRED')
    expect(() => assertPublicPreviewBudget(true, full, costOnly, now)).not.toThrow()
    expect(() => assertPublicPreviewBudget(true, costOnly, full, now)).toThrow('CHECKPOINT_QUOTA_REQUIRED')
    expect(() => assertPublicPreviewBudget(undefined, full, costOnly, now)).toThrow('PUBLICATION_MODE_REQUIRED')
    expect(() => assertPublicPreviewBudget('false', full, costOnly, now)).toThrow('PUBLICATION_MODE_REQUIRED')
  })
  it('routes only publish=false to cost-only evidence in both protected callsites', () => {
    const workflow = readFileSync(new URL('../../.github/workflows/catalogue-public-preview.yml', import.meta.url), 'utf8')
    const runner = readFileSync(new URL('./build-public-projection.mts', import.meta.url), 'utf8')
    const directMigration = readFileSync(new URL('./run.mjs', import.meta.url), 'utf8')
    const secureSetup = readFileSync(new URL('./secure-setup.mjs', import.meta.url), 'utf8')
    const budgetBlock = workflow.slice(
      workflow.indexOf('- name: Verify execution tuple'),
      workflow.indexOf('- name: Validate a preserved artifact before resuming an incomplete publication unit'),
    )
    expect(budgetBlock).toMatch(/if: inputs\.publish[\s\S]*?assertBudget/)
    expect(budgetBlock).toMatch(/if: inputs\.publish == false[\s\S]*?assertCandidateBudget/)
    expect(budgetBlock).toContain('DIRECT_ZERO_COST_CANDIDATE_EVIDENCE: ${{ vars.DIRECT_ZERO_COST_CANDIDATE_EVIDENCE }}')
    expect(workflow).toContain('DIRECT_PUBLIC_PREVIEW_PUBLISH: ${{ inputs.publish }}')
    expect(workflow).toContain("DIRECT_ZERO_COST_ATTESTATION: ${{ inputs.publish && vars.DIRECT_ZERO_COST_ATTESTATION || '' }}")
    expect(workflow).toContain("DIRECT_ZERO_COST_CANDIDATE_EVIDENCE: ${{ inputs.publish == false && vars.DIRECT_ZERO_COST_CANDIDATE_EVIDENCE || '' }}")
    expect(runner).toContain("publicationMode==='false') return assertPublicPreviewBudget(false")
    expect(runner).toContain('parseBudgetEvidence(process.env.DIRECT_ZERO_COST_CANDIDATE_EVIDENCE))')
    expect(runner).toContain("publicationMode==='true') return assertPublicPreviewBudget(true")
    expect(runner).toContain('parseBudgetEvidence(process.env.DIRECT_ZERO_COST_ATTESTATION),undefined)')
    expect(runner).toContain('DIRECT_ZERO_COST_CANDIDATE_EVIDENCE')
    expect(directMigration).toContain("assertBudget(JSON.parse(env.DIRECT_ZERO_COST_ATTESTATION ?? 'null'))")
    expect(secureSetup).toContain("assertBudget(JSON.parse(env.DIRECT_ZERO_COST_ATTESTATION??'null'))")
    expect(workflow).toMatch(/- name: Upload one existing Worker version\n\s+if: inputs\.publish/)
  })

  it('holds the pinned publication behind artifact identity, independent rebuild, budget, Free plan, and fresh state gates', () => {
    const workflow = readFileSync(new URL('../../.github/workflows/catalogue-public-preview.yml', import.meta.url), 'utf8')
    const artifactIndex = workflow.indexOf('- name: Validate a preserved artifact before resuming an incomplete publication unit')
    const determinismIndex = workflow.indexOf('- name: Independently rebuild the exact candidate from its preserved catalogue snapshot')
    const budgetIndex = workflow.indexOf('- name: Verify zero-cost and checkpoint-headroom evidence for publishing')
    const freeIndex = workflow.indexOf('- name: Confirm Workers Free plan before upload')
    const receiptIndex = workflow.indexOf('- name: Create a fresh read-only managed-state receipt and immediately recheck it')
    const uploadIndex = workflow.indexOf('- name: Upload one existing Worker version')

    expect(workflow).toContain("[[ \"$SOURCE_SHA\" == 'da3c8fe7a94f71b70ce391a8925e5360f197b74b' ]]")
    expect(workflow).toContain("[[ \"$ARTIFACT_RUN_ID\" == '41031057535' ]]")
    expect(workflow).toContain("[[ \"$CANDIDATE_ARTIFACT_ID\" == '12966875385' ]]")
    expect(workflow).toContain("[[ \"$CANDIDATE_ARTIFACT_SIZE_BYTES\" == '170366858' ]]")
    expect(workflow).toContain("[[ \"$CANDIDATE_ARCHIVE_SHA256\" == '4e3ad7bb1fbd6f1a33f5c88cf5691837edd07230828d898913f4492b34cd22bf' ]]")
    expect(workflow).toContain('"$ARTIFACT_ROOT/evidence/determinism.json"')
    expect(workflow).toContain('attest-managed-baseline')
    expect(workflow).toContain('--managed-baseline-receipt')
    expect(workflow).toMatch(/allow_candidate_build:[\s\S]*?type: boolean\n\s+default: false/)
    expect(workflow).toMatch(/- name: Build canonical Public Worker without database credentials\n\s+if: inputs\.artifact_run_id == '' && inputs\.allow_candidate_build/)
    expect(workflow).toContain(".state==\"MANAGED_BASELINE_ATTESTED\" and .versionCount==11 and .latestVersionId==\"17fe81fb-9f43-43b9-85d0-33952cff74d6\"")
    expect(artifactIndex).toBeGreaterThan(budgetIndex)
    expect(determinismIndex).toBeGreaterThan(artifactIndex)
    expect(freeIndex).toBeGreaterThan(determinismIndex)
    expect(receiptIndex).toBeGreaterThan(freeIndex)
    expect(uploadIndex).toBeGreaterThan(receiptIndex)
    expect(workflow.slice(uploadIndex)).not.toContain('wrangler deploy ')
    expect(workflow.slice(uploadIndex)).not.toMatch(/(?:routes|custom_domains|workers_dev\s*:\s*true)/i)
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
  it('retains the exact canonical capacity trigger and accepts only lossless timestamp precision mapping', () => {
    const target = schema('dpg_app')
    target[0].insertTriggers.push({ name: 'leo538_free_tier_headroom', type: 20, enabled: 'O', schema: 'dpg_control',
      function: 'enforce_free_tier_headroom_statement', body: HEADROOM_BODY, definer: true,
      config: ['search_path=pg_catalog'], language: 'plpgsql' })
    expect(() => assertSchema(schema('public'), target)).not.toThrow()
    target[0].insertTriggers[0].body += '\nperform malicious();'
    expect(() => assertSchema(schema('public'), target)).toThrow('INSERT_TRIGGER')
    const source = schema('public'); const destination = schema('dpg_app')
    source[0].columns[0].type = 'timestamp with time zone'
    destination[0].columns[0].type = 'timestamp(6) with time zone'
    expect(() => assertSchema(source, destination)).not.toThrow()
    destination[0].columns[0].type = 'timestamp(3) with time zone'
    expect(() => assertSchema(source, destination)).toThrow('SCHEMA_MAPPING')
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
