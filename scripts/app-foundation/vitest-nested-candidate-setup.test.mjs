import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

test('a nested candidate checkout loads its own Vitest setup file', () => {
  const runnerRoot = mkdtempSync(join(projectRoot, '.vitest-candidate-root-'))
  const candidateRoot = join(runnerRoot, 'candidate')

  try {
    mkdirSync(candidateRoot)
    copyFileSync(join(projectRoot, 'package.json'), join(candidateRoot, 'package.json'))
    copyFileSync(join(projectRoot, 'vitest.config.ts'), join(candidateRoot, 'vitest.config.ts'))
    symlinkSync(
      join(projectRoot, 'node_modules'),
      join(candidateRoot, 'node_modules'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    writeFileSync(
      join(runnerRoot, 'vitest.setup.ts'),
      "globalThis.__dpgSetupOrigin = 'parent'\n",
    )
    writeFileSync(
      join(candidateRoot, 'vitest.setup.ts'),
      "globalThis.__dpgSetupOrigin = 'candidate'\n",
    )
    writeFileSync(
      join(candidateRoot, 'setup-origin.test.ts'),
      "test('uses the candidate-local setup', () => expect(globalThis.__dpgSetupOrigin).toBe('candidate'))\n",
    )

    const childEnv = { ...process.env }
    for (const key of Object.keys(childEnv)) {
      if (key.startsWith('VITEST_')) delete childEnv[key]
    }
    for (const key of [
      'CLOUDFLARE_API_TOKEN',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_ACCESS_TOKEN',
      'DATABASE_URL',
      'DIRECT_URL',
      'POSTGRES_URL',
    ]) {
      delete childEnv[key]
    }

    const child = spawnSync(
      process.execPath,
      [resolve(projectRoot, 'node_modules/vitest/vitest.mjs'), 'run', 'setup-origin.test.ts'],
      { cwd: candidateRoot, env: childEnv, encoding: 'utf8', timeout: 15_000 },
    )
    const output = [child.stdout, child.stderr].filter(Boolean).join('\n')
    expect(child.error, output).toBeUndefined()
    expect(child.status, output).toBe(0)
  } finally {
    rmSync(runnerRoot, { recursive: true, force: true })
  }
})
