import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { X509Certificate } from 'node:crypto'
import pg from 'pg'

import {
  adaptPhase2MigrationForSyntheticPreview,
  assertSyntheticPreviewDatabaseUrl,
  assertSyntheticPreviewLedger,
  SYNTHETIC_PREVIEW_MIGRATIONS,
  SYNTHETIC_PREVIEW_TARGET,
  SYNTHETIC_PREVIEW_CONTRACT_MIGRATION,
  sha256,
} from './synthetic-preview-contract.mjs'

const ledgerTable = 'dpg_control.synthetic_preview_migration_ledger'
export const SYNTHETIC_PREVIEW_ROOT_CA_ENV = 'SUPABASE_PREVIEW_DATABASE_SSL_ROOT_CA_PEM'
const EXPECTED_ROOT_CA_COMMON_NAME = 'CN=Supabase Root 2021 CA'
// Supabase's upstream issue #50862 reports this fingerprint for the
// Dashboard-provided Supabase Root 2021 CA; require an exact match.
const EXPECTED_ROOT_CA_FINGERPRINT_SHA256 = '807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa'

function validateRootCaCertificate(rootCaPem, expectedFingerprintSha256) {
  if (typeof rootCaPem !== 'string' || !rootCaPem.trim()) {
    throw new Error('DPG_SYNTHETIC_PREVIEW_ROOT_CA_REQUIRED')
  }

  const normalizedPem = rootCaPem.trim().replaceAll('\r\n', '\n')
  const certificateBlocks = normalizedPem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? []
  if (certificateBlocks.length !== 1 || normalizedPem.replace(certificateBlocks[0] ?? '', '').trim()) {
    throw new Error('DPG_SYNTHETIC_PREVIEW_ROOT_CA_INVALID')
  }

  let certificate
  try {
    certificate = new X509Certificate(certificateBlocks[0])
  } catch {
    throw new Error('DPG_SYNTHETIC_PREVIEW_ROOT_CA_INVALID')
  }

  const validFrom = Date.parse(certificate.validFrom)
  const validTo = Date.parse(certificate.validTo)
  if (
    !certificate.ca
    || !certificate.subject.includes(EXPECTED_ROOT_CA_COMMON_NAME)
    || certificate.subject !== certificate.issuer
    || !certificate.verify(certificate.publicKey)
    || !Number.isFinite(validFrom)
    || !Number.isFinite(validTo)
    || validFrom > Date.now()
    || validTo <= Date.now()
  ) throw new Error('DPG_SYNTHETIC_PREVIEW_ROOT_CA_INVALID')

  const fingerprintSha256 = certificate.fingerprint256?.replaceAll(':', '').toLowerCase()
  if (!fingerprintSha256 || !/^[0-9a-f]{64}$/.test(fingerprintSha256)) {
    throw new Error('DPG_SYNTHETIC_PREVIEW_ROOT_CA_INVALID')
  }
  if (fingerprintSha256 !== expectedFingerprintSha256) {
    throw new Error('DPG_SYNTHETIC_PREVIEW_ROOT_CA_FINGERPRINT_MISMATCH')
  }

  return { pem: certificateBlocks[0], fingerprintSha256 }
}

export function buildSyntheticPreviewPoolConfig(
  databaseUrl,
  rootCaPem,
  { expectedRootCaFingerprintSha256 = EXPECTED_ROOT_CA_FINGERPRINT_SHA256 } = {},
) {
  const target = assertSyntheticPreviewDatabaseUrl(databaseUrl)
  if (target.projectRef !== SYNTHETIC_PREVIEW_TARGET.projectRef) {
    throw new Error('DPG_SYNTHETIC_PREVIEW_PROJECT_REF_MISMATCH')
  }

  const rootCa = validateRootCaCertificate(rootCaPem, expectedRootCaFingerprintSha256)
  let url
  let user
  let password
  try {
    url = new URL(databaseUrl)
    user = decodeURIComponent(url.username)
    password = decodeURIComponent(url.password)
  } catch {
    // Never echo the source URL; it contains the database credential.
    throw new Error('DPG_SYNTHETIC_PREVIEW_DATABASE_URL_INVALID')
  }

  return {
    target,
    rootCaFingerprintSha256: rootCa.fingerprintSha256,
    poolConfig: {
      host: target.host,
      port: Number(url.port),
      database: target.database,
      user,
      password,
      // Keep the hostname from the allowlisted URL. Node's default hostname
      // verification remains enabled because rejectUnauthorized stays true
      // and no custom servername/checkServerIdentity is supplied.
      ssl: { ca: rootCa.pem, rejectUnauthorized: true },
      max: 1,
      connectionTimeoutMillis: 15000,
    },
  }
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

async function readMigration(entry) {
  const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)))
  const source = await readFile(resolve(repositoryRoot, entry.path), 'utf8')
  const sql = entry.version === SYNTHETIC_PREVIEW_CONTRACT_MIGRATION.version
    ? source
    : adaptPhase2MigrationForSyntheticPreview({ ...entry, sql: source })
  return { ...entry, sourceSql: source, sql, sha256: sha256(source) }
}

async function insertLedgerRow(client, entry) {
  await client.query(
    `insert into ${ledgerTable} (source_version, source_name, source_sha256, target_project_ref)
     values ($1, $2, $3, $4)`,
    [entry.version, entry.name, entry.sha256, SYNTHETIC_PREVIEW_TARGET.projectRef],
  )
}

async function applyOnce(client, entry) {
  await client.query('begin')
  try {
    await client.query(entry.sql)
    await insertLedgerRow(client, entry)
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  }
}

async function checkTargetRow(client) {
  const result = await client.query(`
    select project_name, region, environment, data_class,
      production_data_allowed, production_credentials_allowed,
      production_writes_allowed, hard_database_ceiling_bytes,
      pg_database_size(current_database()) as database_bytes
    from dpg_control.target_contract
    where singleton
  `)
  if (result.rowCount !== 1) throw new Error('DPG_SYNTHETIC_PREVIEW_TARGET_ROW_INVALID')
  const row = result.rows[0]
  if (
    row.project_name !== SYNTHETIC_PREVIEW_TARGET.projectName ||
    row.region !== SYNTHETIC_PREVIEW_TARGET.region ||
    row.environment !== SYNTHETIC_PREVIEW_TARGET.environment ||
    row.data_class !== SYNTHETIC_PREVIEW_TARGET.dataClass ||
    row.production_data_allowed !== false ||
    row.production_credentials_allowed !== false ||
    row.production_writes_allowed !== false ||
    Number(row.hard_database_ceiling_bytes) !== SYNTHETIC_PREVIEW_TARGET.hardDatabaseCeilingBytes ||
    Number(row.database_bytes) > SYNTHETIC_PREVIEW_TARGET.hardDatabaseCeilingBytes
  ) throw new Error('DPG_SYNTHETIC_PREVIEW_TARGET_CONTRACT_MISMATCH')
}

export async function runSyntheticPreviewMigrations({
  databaseUrl = process.env.SUPABASE_PREVIEW_DATABASE_URL,
  rootCaPem = process.env[SYNTHETIC_PREVIEW_ROOT_CA_ENV],
  Pool = pg.Pool,
} = {}) {
  const { target, rootCaFingerprintSha256, poolConfig } = buildSyntheticPreviewPoolConfig(databaseUrl, rootCaPem)
  // Do not pass connectionString: pg 8.20 merges pg-connection-string's parsed
  // query options over this config. sslmode=require becomes an empty SSL object
  // and discards the CA. Discrete properties preserve the CA, strict chain and
  // hostname verification above.
  const pool = new Pool(poolConfig)
  const client = await pool.connect()
  const entries = [SYNTHETIC_PREVIEW_CONTRACT_MIGRATION, ...SYNTHETIC_PREVIEW_MIGRATIONS]
  const prepared = await Promise.all(entries.map(readMigration))

  try {
    const current = await client.query(`select to_regclass($1) as ledger`, [ledgerTable])
    if (!current.rows[0]?.ledger) {
      await applyOnce(client, prepared[0])
    } else {
      const existing = await client.query(
        `select source_version, source_name, source_sha256, target_project_ref
         from ${ledgerTable} where source_version = $1`,
        [prepared[0].version],
      )
      if (existing.rowCount === 0) {
        await applyOnce(client, prepared[0])
      } else {
        assertSyntheticPreviewLedger(existing.rows, [{
          version: prepared[0].version,
          name: prepared[0].name,
          sha256: prepared[0].sha256,
        }])
      }
    }

    await checkTargetRow(client)

    const ledgerResult = await client.query(
      `select source_version, source_name, source_sha256, target_project_ref
       from ${ledgerTable} order by source_version`,
    )
    const expected = prepared.map(({ version, name, sha256: hash }) => ({ version, name, sha256: hash }))
    const ledger = assertSyntheticPreviewLedger(ledgerResult.rows, expected)

    for (const entry of prepared.slice(1)) {
      const existing = ledger.get(entry.version)
      if (existing) continue
      await applyOnce(client, entry)
      ledger.set(entry.version, {
        source_version: entry.version,
        source_name: entry.name,
        source_sha256: entry.sha256,
        target_project_ref: SYNTHETIC_PREVIEW_TARGET.projectRef,
      })
    }

    await checkTargetRow(client)
    const finalLedger = await client.query(
      `select source_version, source_name, source_sha256, target_project_ref
       from ${ledgerTable} order by source_version`,
    )
    const verified = assertSyntheticPreviewLedger(finalLedger.rows, expected)
    if (verified.size !== expected.length) throw new Error('DPG_SYNTHETIC_PREVIEW_LEDGER_INCOMPLETE')

    return {
      status: 'SYNTHETIC_PREVIEW_MIGRATIONS_READY',
      projectRef: target.projectRef,
      tlsMode: 'verify-full',
      rootCaFingerprintSha256,
      appliedVersions: expected.map((entry) => entry.version),
      databaseBytes: Number((await client.query('select pg_database_size(current_database()) as bytes')).rows[0].bytes),
    }
  } finally {
    client.release()
    await pool.end()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runSyntheticPreviewMigrations()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : 'DPG_SYNTHETIC_PREVIEW_RUN_FAILED')
      process.exitCode = 1
    })
}
