import { spawn } from 'node:child_process'
import { chmod, mkdtemp, readFile, rm, statfs, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { parseSupabaseRuntimeTarget } from './supabase-runtime-target.mjs'
import { validateSupabaseRuntimeRootCertificate } from './supabase-runtime-tls.mjs'

const TMPFS_MAGIC = 0x01021994
const POSTGRES_IMAGE = 'postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'
const DUMP_MODES = new Map([
  ['--checkpoint-schema', ['pg_dump', '--schema-only', '--schema=dpg_app', '--schema=dpg_control']],
  ['--affected-state-snapshot', [
    'pg_dump', '--format=custom', '--schema=dpg_app', '--schema=dpg_control',
    '--schema=dpg_v1', '--schema=dpg_v1_api',
  ]],
  ['--affected-public-schema-snapshot', [
    'pg_dump', '--format=custom', '--schema-only', '--schema=public',
  ]],
  ['--auth-extension-schema-acls', [
    'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
    '--file=/run/dpg/supabase-runtime-schema-acl-snapshot.sql',
  ]],
  ['--global-roles-snapshot', ['pg_dumpall', '--globals-only', '--no-role-passwords']],
])

function fail(reason) {
  process.stderr.write(`SUPABASE_RUNTIME_PG_DUMP status=FAIL reason=${reason}\n`)
  process.exitCode = 1
}

function pgpassEscape(value) {
  if (/[\r\n]/.test(value)) throw new Error('credential_encoding_invalid')
  return value.replaceAll('\\', '\\\\').replaceAll(':', '\\:')
}

async function main() {
  if (process.argv.length !== 3 || !DUMP_MODES.has(process.argv[2])) {
    throw new Error('mode_invalid')
  }
  if (process.stdout.isTTY) throw new Error('dump_stream_must_be_piped')

  const target = parseSupabaseRuntimeTarget(process.env.SUPABASE_REHOME_DATABASE_URL)
  const rootCertificate = validateSupabaseRuntimeRootCertificate(
    process.env.SUPABASE_REHOME_ROOT_CA_CERTIFICATE,
  )
  const tmpParent = process.env.SUPABASE_PSQL_TMPDIR || '/dev/shm'
  const filesystem = await statfs(tmpParent)
  if (Number(filesystem.type) !== TMPFS_MAGIC) throw new Error('tmpfs_required')

  const tmpDirectory = await mkdtemp(path.join(tmpParent, 'dpg-pgdump-'))
  const pgpass = path.join(tmpDirectory, '.pgpass')
  const rootCertificatePath = path.join(tmpDirectory, 'root.crt')
  try {
    if (process.argv[2] === '--auth-extension-schema-acls') {
      const aclQueryPath = new URL('./supabase-runtime-schema-acl-snapshot.sql', import.meta.url)
      await writeFile(
        path.join(tmpDirectory, 'supabase-runtime-schema-acl-snapshot.sql'),
        await readFile(aclQueryPath),
        { mode: 0o400 },
      )
    }
    await writeFile(pgpass, [
      pgpassEscape(target.host), String(target.port), pgpassEscape(target.database),
      pgpassEscape(target.user), pgpassEscape(target.password),
    ].join(':') + '\n', { mode: 0o600 })
    await chmod(pgpass, 0o600)
    await writeFile(rootCertificatePath, rootCertificate, { mode: 0o600 })

    const dockerArgs = [
      'run', '--rm', '--read-only', '--network', 'host', '--pids-limit', '128', '--memory', '512m',
      '--volume', `${tmpDirectory}:/run/dpg:ro`,
      '--env', `PGHOST=${target.host}`,
      '--env', `PGPORT=${target.port}`,
      '--env', `PGDATABASE=${target.database}`,
      '--env', `PGUSER=${target.user}`,
      '--env', 'PGPASSFILE=/run/dpg/.pgpass',
      '--env', 'PGSSLMODE=verify-full',
      '--env', 'PGSSLROOTCERT=/run/dpg/root.crt',
      '--env', 'PGAPPNAME=dongphugia-supabase-runtime-rehome',
      POSTGRES_IMAGE,
      ...DUMP_MODES.get(process.argv[2]),
    ]
    const childEnvironment = Object.fromEntries(Object.entries(process.env).filter(([name]) => (
      !name.startsWith('SUPABASE_REHOME_') && !name.startsWith('PG')
    )))
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn('docker', dockerArgs, {
        env: childEnvironment,
        stdio: ['ignore', 'inherit', 'pipe'],
      })
      child.stderr.on('data', () => undefined)
      child.once('error', reject)
      child.once('exit', (code) => resolve(code ?? 1))
    })
    if (exitCode !== 0) throw new Error('database_operation_failed')
  } finally {
    await rm(tmpDirectory, { recursive: true, force: true })
  }
}

void main().catch((error) => {
  const allowed = new Set([
    'mode_invalid', 'tmpfs_required', 'credential_encoding_invalid', 'dump_stream_must_be_piped',
    'supabase_runtime_tls_certificate_invalid',
  ])
  const reason = allowed.has(error?.message) ? error.message : 'database_operation_failed'
  fail(reason)
})
