import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()
const runner = path.join(repoRoot, 'scripts/db/postgres-migration-runner.ts')
const origin = path.join(repoRoot, 'db/postgres-migrations')
const baseArgs = (tempOrigin: string, tempManifest: string) => [
  runner,
  '--target', 'disposable',
  '--origin', tempOrigin,
  '--manifest', tempManifest,
  '--validate-only',
]

function runExpectingFailure(args: string[], databaseUrl = 'postgresql://postgres:postgres@127.0.0.1:1/dpg_negative_test') {
  try {
    execFileSync('npx', ['tsx', ...args], {
      cwd: repoRoot,
      env: {
        ...process.env,
        DISPOSABLE_POSTGRES: '1',
        POSTGRES_MIGRATION_URL: databaseUrl,
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    const result = error as { stdout?: string; stderr?: string }
    return `${result.stdout ?? ''}${result.stderr ?? ''}`
  }
  throw new Error('expected runner to fail closed')
}

describe('PostgreSQL migration runner fail-closed validation', () => {
  it('rejects a checksum mismatch before any database connection', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'dpg-runner-checksum-'))
    const tempOrigin = path.join(tempRoot, 'origin')
    const tempManifest = path.join(tempOrigin, 'manifest.json')
    await cp(origin, tempOrigin, { recursive: true })
    const core = path.join(tempOrigin, '0000_baseline_v1/core.sql')
    await writeFile(core, `${await readFile(core, 'utf8')}\n-- intentional checksum test\n`)

    const output = runExpectingFailure(baseArgs(tempOrigin, tempManifest))
    expect(output).toContain('checksum mismatch')
  })

  it('rejects a non-PostgreSQL manifest origin before any database connection', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'dpg-runner-provider-'))
    const tempOrigin = path.join(tempRoot, 'origin')
    const tempManifest = path.join(tempOrigin, 'manifest.json')
    await cp(origin, tempOrigin, { recursive: true })
    const manifest = JSON.parse(await readFile(tempManifest, 'utf8')) as { origin: string }
    manifest.origin = 'sqlite'
    await writeFile(tempManifest, `${JSON.stringify(manifest, null, 2)}\n`)

    const output = runExpectingFailure(baseArgs(tempOrigin, tempManifest))
    expect(output).toContain('PostgreSQL Baseline v1')
  })

  it('rejects a non-loopback target even when the target flag is disposable', async () => {
    const output = runExpectingFailure([
      runner,
      '--target', 'disposable',
      '--origin', 'db/postgres-migrations',
      '--manifest', 'db/postgres-migrations/manifest.json',
      '--validate-only',
    ], 'postgresql://postgres:postgres@example.invalid:5432/dpg_negative_test')
    expect(output).toContain('migration target must resolve to loopback')
  })
})
