import { execFileSync } from 'node:child_process'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { prepareProofOrigin } from './isolated-staging'

const repoRoot = process.cwd()

describe('isolated Staging proof origin', () => {
  it('contains exactly the disposable migration declared by its manifest', async () => {
    const proofOrigin = await prepareProofOrigin()
    try {
      const output = execFileSync('npx', [
        'tsx',
        path.join(repoRoot, 'scripts/db/postgres-migration-runner.ts'),
        '--target', 'disposable',
        '--origin', proofOrigin.origin,
        '--manifest', proofOrigin.manifest,
        '--validate-only',
      ], {
        cwd: repoRoot,
        env: {
          ...process.env,
          DISPOSABLE_POSTGRES: '1',
          POSTGRES_MIGRATION_URL: 'postgresql://dpg_disposable_proof:placeholder@127.0.0.1:1/dpg_disposable_proof',
        },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      expect(JSON.parse(output)).toMatchObject({ status: 'VALIDATED', migrations: 1 })
    } finally {
      await rm(proofOrigin.tempRoot, { recursive: true, force: true })
    }
  })
})
