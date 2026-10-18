import { spawn } from 'node:child_process'
import { chmod, mkdtemp, rm, statfs, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { parseSupabaseRuntimeTarget } from './supabase-runtime-target.mjs'

const TMPFS_MAGIC = 0x01021994

function fail(reason) {
  process.stderr.write(`SUPABASE_RUNTIME_PSQL status=FAIL reason=${reason}\n`)
  process.exitCode = 1
}

function pgpassEscape(value) {
  if (/[\r\n]/.test(value)) throw new Error('credential_encoding_invalid')
  return value.replaceAll('\\', '\\\\').replaceAll(':', '\\:')
}

async function main() {
  const args = process.argv.slice(2)
  const fileMode = args.length === 2 && args[0] === '--file'
  const stdinMode = args.length === 1 && args[0] === '--tuples-only'
  if (!fileMode && !stdinMode) throw new Error('mode_invalid')

  const target = parseSupabaseRuntimeTarget(process.env.SUPABASE_REHOME_DATABASE_URL)
  const tmpParent = process.env.SUPABASE_PSQL_TMPDIR || '/dev/shm'
  const filesystem = await statfs(tmpParent)
  if (Number(filesystem.type) !== TMPFS_MAGIC) throw new Error('tmpfs_required')

  const tmpDirectory = await mkdtemp(path.join(tmpParent, 'dpg-psql-'))
  const pgpass = path.join(tmpDirectory, '.pgpass')
  try {
    await writeFile(pgpass, [
      pgpassEscape(target.host),
      String(target.port),
      pgpassEscape(target.database),
      pgpassEscape(target.user),
      pgpassEscape(target.password),
    ].join(':') + '\n', { mode: 0o600 })
    await chmod(pgpass, 0o600)

    const childEnvironment = Object.fromEntries(Object.entries(process.env).filter(([name]) => (
      name !== 'SUPABASE_REHOME_DATABASE_URL' && !name.startsWith('PG')
    )))
    Object.assign(childEnvironment, {
      PGHOST: target.host,
      PGPORT: String(target.port),
      PGDATABASE: target.database,
      PGUSER: target.user,
      PGPASSFILE: pgpass,
      PGSSLMODE: 'require',
      PGAPPNAME: 'dongphugia-supabase-runtime-rehome',
    })

    const psqlArgs = ['-X', '-q', '-v', 'ON_ERROR_STOP=1']
    if (fileMode) psqlArgs.push('--file', args[1])
    if (stdinMode) psqlArgs.push('-A', '-t')

    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn('psql', psqlArgs, { env: childEnvironment, stdio: 'inherit' })
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
  fail(reason)
})
