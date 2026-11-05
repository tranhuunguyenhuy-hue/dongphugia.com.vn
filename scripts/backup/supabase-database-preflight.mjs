import { parseSupabaseRuntimeTarget } from './supabase-runtime-target.mjs'

const SAFE_CODES = new Set([
  'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'ECONNREFUSED',
  'ECONNRESET', 'ETIMEDOUT', '28P01', '28000', '3D000', '42501', '42P01',
  '53300', '57P03', '57014', 'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID',
])

export async function verifyDatabase(value, createClient, emit) {
  let client
  let phase = 'target_url'
  try {
    const target = parseSupabaseRuntimeTarget(value)
    emit(`DATABASE_PREFLIGHT connection_type=${target.host.startsWith('db.') ? 'direct' : 'session_pooler'}`)
    client = createClient({ ...target, query_timeout: 10_000, statement_timeout: 10_000 })
    // Never forward a pg error object or its message into logs.
    client.on('error', () => {})
    phase = 'connect'
    await client.connect()
    emit('DATABASE_PREFLIGHT connect=PASS')
    phase = 'readonly_transaction'
    await client.query('begin transaction isolation level repeatable read read only')
    phase = 'target_contract'
    const result = await client.query(`
      select current_setting('transaction_read_only') = 'on' as readonly,
        current_setting('server_version_num')::integer between 170000 and 179999 as postgres_17,
        exists (select 1 from dpg_control.target_contract
          where singleton and project_name = 'dongphugia-runtime'
            and region = 'ap-southeast-1' and environment = 'preview'
            and data_class = 'production-derived-reduced-runtime'
            and production_data_allowed and not production_credentials_allowed
            and not production_writes_allowed
            and hard_database_ceiling_bytes = 367001600) as target_exact,
        pg_database_size(current_database()) < 367001600 as size_within_ceiling,
        to_regclass('dpg_control.runtime_migration_ledger') is not null as ledger_present,
        not exists(select 1 from pg_roles where rolname = 'dpg_backup_login') as backup_login_absent
    `)
    const row = result.rows[0]
    if (!row || ['readonly', 'postgres_17', 'target_exact', 'size_within_ceiling', 'backup_login_absent']
      .some((key) => row[key] !== true)) throw new Error('contract_failed')
    phase = 'ledger'
    let prefix = 'absent'
    if (row.ledger_present === true) {
      const ledger = await client.query('select count(*)::integer as entries from dpg_control.runtime_migration_ledger')
      const count = ledger.rows[0]?.entries
      if (![7, 8, 9].includes(count)) throw new Error('ledger_boundary_failed')
      prefix = String(count)
    } else if (row.ledger_present !== false) throw new Error('ledger_state_failed')
    phase = 'rollback'
    await client.query('rollback')
    emit(`DATABASE_PREFLIGHT status=PASS readonly=PASS target=PASS observed_prefix=${prefix}`)
    return true
  } catch (error) {
    const code = SAFE_CODES.has(error?.code) ? error.code : 'UNCLASSIFIED'
    emit(`DATABASE_PREFLIGHT status=FAIL phase=${phase} code=${code}`)
    return false
  } finally {
    if (client) {
      await client.query('rollback').catch(() => {})
      await client.end().catch(() => {})
    }
  }
}

if (process.argv[1]?.endsWith('/supabase-database-preflight.mjs')) {
  void (async () => {
    const { default: pg } = await import('pg')
    const passed = await verifyDatabase(process.env.SUPABASE_REHOME_DATABASE_URL,
      (config) => new pg.Client(config), (line) => process.stdout.write(`${line}\n`))
    if (!passed) process.exitCode = 1
  })().catch(() => {
    process.stderr.write('DATABASE_PREFLIGHT status=FAIL phase=startup code=UNCLASSIFIED\n')
    process.exitCode = 1
  })
}
