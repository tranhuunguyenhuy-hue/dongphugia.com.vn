const PROJECT_REF = 'bonxyxluzlxfkdetryoo'
const DIRECT_HOST = `db.${PROJECT_REF}.supabase.co`
const SESSION_POOLER_HOST = 'aws-0-ap-southeast-1.pooler.supabase.com'

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

export function parseSupabaseRuntimeTarget(value) {
  if (!value) fail()

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

  const direct = url.hostname === DIRECT_HOST && decode(url.username) === 'postgres'
  const pooler = url.hostname === SESSION_POOLER_HOST
    && decode(url.username) === `postgres.${PROJECT_REF}`
  if (!direct && !pooler) fail()

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    database: 'postgres',
    user: decode(url.username),
    password: decode(url.password),
    ssl: true,
    application_name: 'dongphugia-supabase-runtime-rehome',
    connectionTimeoutMillis: 10_000,
    query_timeout: 60_000,
    statement_timeout: 60_000,
  }
}

async function main() {
  if (process.argv[2] !== 'validate-url') fail()
  parseSupabaseRuntimeTarget(process.env.SUPABASE_REHOME_DATABASE_URL)
  process.stdout.write('SUPABASE_RUNTIME_TARGET status=PASS target=exact\n')
}

if (process.argv[1]?.endsWith('/supabase-runtime-target.mjs')) {
  void main().catch(() => {
    process.stderr.write('SUPABASE_RUNTIME_TARGET status=FAIL reason=target_identity_mismatch\n')
    process.exitCode = 1
  })
}
