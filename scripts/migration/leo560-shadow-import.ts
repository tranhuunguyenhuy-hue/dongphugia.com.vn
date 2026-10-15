import { promises as fs } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Client } from 'pg'
import { assertLoopbackDatabaseUrl } from './leo562-import-lib'
import {
  CATALOGUE_TABLES,
  EXPECTED_CATALOGUE_COUNTS,
  LEO560_TARGET_PROJECT,
  LEO560_TARGET_REGION,
  assertApprovedExecutionEnvironment,
  canonicalJson,
  parseSupabasePreviewTarget,
} from './leo560-shadow-import-lib'
import { runCatalogueShadowCopy } from './leo560-shadow-copy'

type Mode = 'preflight' | 'apply'

type Args = {
  mode: Mode
  sourceUrl: string
  targetUrl: string
  evidenceOut: string
}

const ROOT_CATEGORY_IDS = [
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
]

function fail(message: string): never {
  throw new Error(`LEO560_SHADOW_IMPORT_FAILED:${message}`)
}

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>()
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith('--') || !value || value.startsWith('--')) fail('arguments_invalid')
    values.set(key.slice(2), value)
  }
  const mode = values.get('mode') as Mode | undefined
  if (mode !== 'preflight' && mode !== 'apply') fail('mode_invalid')
  for (const key of ['source-url', 'evidence-out']) if (!values.get(key)) fail(`${key}_missing`)
  const targetUrl = values.get('target-url') ?? process.env.SUPABASE_RUNTIME_MIGRATION_URL
  if (!targetUrl) fail('target-url_missing')
  return {
    mode,
    sourceUrl: values.get('source-url')!,
    targetUrl,
    evidenceOut: path.resolve(values.get('evidence-out')!),
  }
}

async function attestTarget(client: Client) {
  const identity = (await client.query(`
    select current_database() database_name, current_user current_role,
      session_user session_role, current_setting('server_version') server_version
  `)).rows[0]
  if (identity.database_name !== 'postgres' || identity.current_role !== 'postgres'
    || identity.session_role !== 'postgres' || !String(identity.server_version).startsWith('17.')) {
    fail('target_session_identity_mismatch')
  }
  const contract = (await client.query(`
    select count(*)::int count from dpg_control.target_contract
    where singleton and project_name = $1 and region = $2 and environment = 'preview'
      and data_class = 'production-derived-reduced-runtime'
      and production_data_allowed is true
      and production_credentials_allowed is false
      and production_writes_allowed is false
      and hard_database_ceiling_bytes = 367001600
  `, [LEO560_TARGET_PROJECT, LEO560_TARGET_REGION])).rows[0]
  if (contract?.count !== 1) fail('target_contract_mismatch')
  const roots = (await client.query(`
    select id::text from dpg_v1.categories where parent_id is null order by id
  `)).rows.map((row) => row.id)
  if (canonicalJson(roots) !== canonicalJson(ROOT_CATEGORY_IDS)) fail('root_category_contract_mismatch')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  assertApprovedExecutionEnvironment(process.env)
  assertLoopbackDatabaseUrl(args.sourceUrl, 'SOURCE')
  const targetConfig = parseSupabasePreviewTarget(args.targetUrl)
  const source = new Client({
    connectionString: args.sourceUrl,
    application_name: 'leo560-catalogue-shadow-source',
    statement_timeout: 300_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    ssl: false,
  })
  const target = new Client(targetConfig)
  await source.connect()
  await target.connect()
  try {
    await target.query("set statement_timeout='5min'")
    await target.query("set lock_timeout='10s'")
    await target.query("set idle_in_transaction_session_timeout='60s'")
    const copy = await runCatalogueShadowCopy({
      mode: args.mode,
      source,
      target,
      expectedCounts: EXPECTED_CATALOGUE_COUNTS,
      hardCeilingBytes: 367_001_600,
      attestTarget: () => attestTarget(target),
    })

    const evidence = {
      schemaVersion: 1,
      issue: 152,
      mode: args.mode,
      status: 'PASS',
      source: {
        snapshot: 'LEO-560',
        sha256: '86db472b7fa2aed53d287ef1f4eb2c817320e4650fcbd9b56d53a71a39d6edf1',
        versionId: 'CSyMYJz1glatK32aWl2K8pukzxzXl69c',
        deterministicLeo562Checksum: 'ad10fb1e31d19cb36aad9f90a94b98a44142263a2a9e9c90e5e9da633cacc706',
        catalogueCounts: copy.sourceCountMap,
        catalogueDigest: copy.sourceCatalogueDigest,
      },
      target: {
        project: LEO560_TARGET_PROJECT,
        region: LEO560_TARGET_REGION,
        environment: 'preview',
        databaseBytesBefore: copy.databaseBytesBefore,
        projectedBytes: copy.projectedBytes,
        databaseBytesAfter: copy.databaseBytesAfter,
        catalogueCountsBefore: Object.fromEntries(CATALOGUE_TABLES.map((table) => [table, copy.targetBefore[table]])),
        catalogueCountsAfter: Object.fromEntries(CATALOGUE_TABLES.map((table) => [table, copy.targetAfter[table]])),
        catalogueDigestAfter: copy.targetCatalogueDigest,
      },
      exclusions: {
        pii: true,
        auth: true,
        customers: true,
        staff: true,
        orders: true,
        quotes: true,
        blog: true,
        mediaBytes: true,
        productFamilyAxisOption: true,
        excludedTableCountsUnchanged: true,
      },
      recovery: {
        encryptedBackupRunId: process.env.LEO560_BACKUP_RUN_ID,
        retentionDays: 14,
        isolatedRestoreRequired: true,
      },
      authority: {
        approvedSourceSha: process.env.LEO560_APPROVED_SOURCE_SHA,
        productionRead: false,
        productionWrite: false,
        merge: false,
        dnsTrafficCutover: false,
      },
    }
    await fs.mkdir(path.dirname(args.evidenceOut), { recursive: true })
    await fs.writeFile(args.evidenceOut, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
    process.stdout.write(`LEO560_SHADOW_IMPORT status=PASS mode=${args.mode} products=${copy.sourceCountMap.products} attributes=${copy.sourceCountMap.product_attribute_values}\n`)
  } finally {
    await Promise.allSettled([source.end(), target.end()])
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error && error.message.startsWith('LEO560_SHADOW_IMPORT_FAILED:')
      ? error.message
      : 'LEO560_SHADOW_IMPORT_FAILED:postgresql_operation_failed'
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}
