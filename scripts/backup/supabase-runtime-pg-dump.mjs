import { spawn } from 'node:child_process'
import { chmod, mkdtemp, rm, statfs, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { parseSupabaseRuntimeTarget } from './supabase-runtime-target.mjs'

const TMPFS_MAGIC = 0x01021994
const POSTGRES_IMAGE = 'postgres:17.6-bookworm@sha256:45cd22f8d32e189d245403954882f88e7a8714301fda80dab6da90f1265b25a3'

function pgpassEscape(value) {
  if (/[\r\n]/.test(value)) throw new Error('credential_encoding_invalid')
  return value.replaceAll('\\', '\\\\').replaceAll(':', '\\:')
}

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== '--checkpoint-schema') {
    throw new Error('mode_invalid')
  }
  const target = parseSupabaseRuntimeTarget(process.env.SUPABASE_REHOME_DATABASE_URL)
  const tmpParent = process.env.SUPABASE_PSQL_TMPDIR || '/dev/shm'
  const filesystem = await statfs(tmpParent)
  if (Number(filesystem.type) !== TMPFS_MAGIC) throw new Error('tmpfs_required')

  const tmpDirectory = await mkdtemp(path.join(tmpParent, 'dpg-pgdump-'))
  const pgpass = path.join(tmpDirectory, '.pgpass')
  try {
    await writeFile(pgpass, [
      pgpassEscape(target.host), String(target.port), pgpassEscape(target.database),
      pgpassEscape(target.user), pgpassEscape(target.password),
    ].join(':') + '\n', { mode: 0o600 })
    await chmod(pgpass, 0o600)

    const dockerArgs = [
      'run', '--rm', '--read-only', '--pids-limit', '128', '--memory', '512m',
      '--volume', `${tmpDirectory}:/run/dpg:ro`,
      '--env', `PGHOST=${target.host}`,
      '--env', `PGPORT=${target.port}`,
      '--env', `PGDATABASE=${target.database}`,
      '--env', `PGUSER=${target.user}`,
      '--env', 'PGPASSFILE=/run/dpg/.pgpass',
      '--env', 'PGSSLMODE=require',
      '--env', 'PGAPPNAME=dongphugia-supabase-checkpoint-attestation',
      POSTGRES_IMAGE,
      'pg_dump', '--schema-only', '--schema=dpg_app', '--schema=dpg_control',
    ]
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn('docker', dockerArgs, {
        env: Object.fromEntries(Object.entries(process.env).filter(([name]) => (
          name !== 'SUPABASE_REHOME_DATABASE_URL' && !name.startsWith('PG')
        ))),
        stdio: 'inherit',
      })
      child.once('error', reject)
      child.once('exit', (code) => resolve(code ?? 1))
    })
    if (exitCode !== 0) throw new Error('database_operation_failed')
  } finally {
    await rm(tmpDirectory, { recursive: true, force: true })
  }
}

void main().catch((error) => {
  const allowed = new Set(['mode_invalid', 'tmpfs_required', 'credential_encoding_invalid'])
  const reason = allowed.has(error?.message) ? error.message : 'database_operation_failed'
  process.stderr.write(`SUPABASE_RUNTIME_PG_DUMP status=FAIL reason=${reason}\n`)
  process.exitCode = 1
})
