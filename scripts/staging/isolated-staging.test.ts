import { execFileSync } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { candidateDeployTarget, candidateSiteUrl, prepareProofOrigin, sanitizeRuntimeLog } from './isolated-staging'

const repoRoot = process.cwd()

describe('isolated Staging proof origin', () => {
  it('preserves the Production build target for an immutable promoted candidate', () => {
    expect(candidateDeployTarget('ghcr.io/example/app@sha256:abc')).toBe('production')
    expect(candidateDeployTarget('dpg-foundation-isolated-staging:local')).toBe('staging')
    expect(candidateSiteUrl('production')).toBe('https://www.dongphugia.vn')
    expect(candidateSiteUrl('staging')).toBe('https://dongphugia-staging.example.test')
  })

  it('preserves canonical migrations before appending its disposable probe', async () => {
    const proofOrigin = await prepareProofOrigin()
    try {
      const canonicalManifest = JSON.parse(await readFile(
        path.join(repoRoot, 'db/postgres-migrations/manifest.json'),
        'utf8',
      )) as { migrations: Array<{ path: string }> }
      const proofManifest = JSON.parse(await readFile(proofOrigin.manifest, 'utf8')) as {
        migrations: Array<{ path: string }>
      }
      expect(proofManifest.migrations.map((migration) => migration.path)).toEqual([
        ...canonicalManifest.migrations.map((migration) => migration.path),
        '0001_pipeline-probe.sql',
      ])

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

      expect(JSON.parse(output)).toMatchObject({ status: 'VALIDATED', migrations: canonicalManifest.migrations.length + 1 })
    } finally {
      await rm(proofOrigin.tempRoot, { recursive: true, force: true })
    }
  })

  it('reports only allowlisted runtime failure signals', () => {
    const output = sanitizeRuntimeLog([
      'DATABASE_URL=postgresql://admin:secret@example.invalid/customer_records',
      'PrismaClientKnownRequestError: customer@example.invalid',
      "code: 'P2022'",
      "digest: '741852963'",
      'DPG_RUNTIME_QUERY=homepage_featured_tbvs',
    ].join('\n'))

    expect(output).toBe('prisma=P2022,type=PrismaClientKnownRequestError,next_digest=741852963,query=homepage_featured_tbvs')
    expect(output).not.toContain('secret')
    expect(output).not.toContain('customer')
    expect(output).not.toContain('DATABASE_URL')
  })
})
