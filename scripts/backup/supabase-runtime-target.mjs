const PROJECT_REF = 'bonxyxluzlxfkdetryoo'
const DIRECT_HOST = `db.${PROJECT_REF}.supabase.co`
const SESSION_POOLER_HOST = 'aws-0-ap-southeast-1.pooler.supabase.com'
const TARGET_PURPOSES = {
  snapshot: {
    environmentName: 'SUPABASE_REHOME_DATABASE_URL',
    loginRole: 'dpg_snapshot_login',
    setRole: 'dpg_snapshot_readonly',
    options: '-c role=dpg_snapshot_readonly -c default_transaction_read_only=on',
  },
  migration: {
    environmentName: 'SUPABASE_REHOME_MIGRATION_DATABASE_URL',
    loginRole: 'dpg_migration_login',
    setRole: 'dpg_migration',
    options: '-c role=dpg_migration',
  },
  catalogue_restore: {
    environmentName: 'SUPABASE_REHOME_CATALOGUE_DATABASE_URL',
    loginRole: 'dpg_catalogue_restore_login',
    setRole: 'dpg_catalogue_restore',
    options: '-c role=dpg_catalogue_restore',
  },
}

function fail() {
  throw new Error('supabase_runtime_target_invalid')
}

function decode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    fail()
  }
}

export function parseSupabaseRuntimeTarget(value, purpose = 'snapshot') {
  const targetPurpose = TARGET_PURPOSES[purpose]
  if (!targetPurpose || !value) fail()

  let url
  try {
    url = new URL(value)
  } catch {
    fail()
  }

  if (!['postgresql:', 'postgres:'].includes(url.protocol)
    || url.search
    || url.hash
    || url.pathname !== '/postgres'
    || !url.password
    || (url.port && url.port !== '5432')) {
    fail()
  }

  const expectedUsername = targetPurpose.loginRole
  const direct = url.hostname === DIRECT_HOST && decode(url.username) === expectedUsername
  const pooler = url.hostname === SESSION_POOLER_HOST
    && decode(url.username) === `${expectedUsername}.${PROJECT_REF}`
  if (!direct && !pooler) fail()

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    database: 'postgres',
    user: decode(url.username),
    password: decode(url.password),
    purpose,
    setRole: targetPurpose.setRole,
    options: targetPurpose.options,
    ssl: true,
    application_name: 'dongphugia-supabase-runtime-rehome',
    connectionTimeoutMillis: 10_000,
    query_timeout: 60_000,
    statement_timeout: 60_000,
  }
}

export function resolveSupabaseRuntimeTarget(purpose = 'snapshot') {
  const targetPurpose = TARGET_PURPOSES[purpose]
  if (!targetPurpose) fail()
  return parseSupabaseRuntimeTarget(process.env[targetPurpose.environmentName], purpose)
}

async function main() {
  if (process.argv[2] !== 'validate-url') fail()
  const purpose = process.env.SUPABASE_RUNTIME_TARGET_PURPOSE || 'snapshot'
  resolveSupabaseRuntimeTarget(purpose)
  process.stdout.write(`SUPABASE_RUNTIME_TARGET status=PASS purpose=${purpose} target=exact\n`)
}

if (process.argv[1]?.endsWith('/supabase-runtime-target.mjs')) {
  void main().catch(() => {
    process.stderr.write('SUPABASE_RUNTIME_TARGET status=FAIL reason=target_identity_mismatch\n')
    process.exitCode = 1
  })
}
