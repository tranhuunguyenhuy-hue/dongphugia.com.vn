import { readFile } from 'node:fs/promises'
import { X509Certificate } from 'node:crypto'
import { resolve } from 'node:path'
import pg from 'pg'
import { describe, expect, it } from 'vitest'

import {
  buildSyntheticPreviewPoolConfig,
  runSyntheticPreviewMigrations,
} from './synthetic-preview-runner.mjs'

// This generated test root is synthetic and is never used by the hosted runner.
const syntheticTestRootCa = await readFile(
  resolve('scripts/preview/test-fixtures/synthetic-test-root-ca.crt'),
  'utf8',
)
const syntheticTestRootFingerprint = new X509Certificate(syntheticTestRootCa).fingerprint256
  .replaceAll(':', '')
  .toLowerCase()
const sessionPoolerUrl = 'postgresql://postgres.uybumsnyqpwcidjxmfsv:synthetic%40test@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require'

describe('synthetic Preview migration TLS configuration', () => {
  it('passes the project root CA with chain and hostname verification enabled', () => {
    const { target, poolConfig, rootCaFingerprintSha256 } = buildSyntheticPreviewPoolConfig(
      sessionPoolerUrl,
      syntheticTestRootCa,
      { expectedRootCaFingerprintSha256: syntheticTestRootFingerprint },
    )

    expect(target).toMatchObject({
      projectRef: 'uybumsnyqpwcidjxmfsv',
      host: 'aws-0-ap-southeast-1.pooler.supabase.com',
      connectionMode: 'session-pooler',
    })
    expect(poolConfig).not.toHaveProperty('connectionString')
    expect(poolConfig).toMatchObject({
      host: 'aws-0-ap-southeast-1.pooler.supabase.com',
      port: 5432,
      database: 'postgres',
      user: 'postgres.uybumsnyqpwcidjxmfsv',
      password: 'synthetic@test',
      ssl: { ca: syntheticTestRootCa.trim(), rejectUnauthorized: true },
      max: 1,
    })
    expect(poolConfig.ssl).not.toHaveProperty('servername')
    expect(poolConfig.ssl).not.toHaveProperty('checkServerIdentity')
    expect(rootCaFingerprintSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(rootCaFingerprintSha256).toBe(syntheticTestRootFingerprint)

    // pg 8.20 keeps this explicit SSL object because no connectionString is
    // passed; a query sslmode would otherwise replace it during parsing.
    const client = new pg.Client(poolConfig)
    expect(client.connectionParameters.ssl.ca).toBe(syntheticTestRootCa.trim())
    expect(client.connectionParameters.ssl.rejectUnauthorized).toBe(true)
  })

  it('fails before connecting when the root CA is missing or malformed', () => {
    expect(() => buildSyntheticPreviewPoolConfig(sessionPoolerUrl, '')).toThrow(
      'DPG_SYNTHETIC_PREVIEW_ROOT_CA_REQUIRED',
    )
    expect(() => buildSyntheticPreviewPoolConfig(sessionPoolerUrl, 'not a certificate')).toThrow(
      'DPG_SYNTHETIC_PREVIEW_ROOT_CA_INVALID',
    )
  })

  it('rejects a structurally valid CA whose fingerprint is not the expected Supabase root', () => {
    expect(() => buildSyntheticPreviewPoolConfig(sessionPoolerUrl, syntheticTestRootCa)).toThrow(
      'DPG_SYNTHETIC_PREVIEW_ROOT_CA_FINGERPRINT_MISMATCH',
    )
  })

  it('requires a trusted CA before constructing a pool that could reach the database', async () => {
    let poolCreated = false
    await expect(runSyntheticPreviewMigrations({
      databaseUrl: sessionPoolerUrl,
      rootCaPem: '',
      Pool: () => {
        poolCreated = true
        return {}
      },
    })).rejects.toThrow('DPG_SYNTHETIC_PREVIEW_ROOT_CA_REQUIRED')
    expect(poolCreated).toBe(false)
  })
})
