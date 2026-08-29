import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  bindExactPrArtifactIdentity,
  verifyExactPrArtifactIdentity,
} from './exact-pr-artifact-identity.mjs'

const identity = {
  prNumber: '127',
  candidateSha: 'a'.repeat(40),
  controlSha: 'b'.repeat(40),
  workflowRunId: '12345',
}

async function createBundle() {
  const directory = await mkdtemp(join(tmpdir(), 'leo552-artifact-'))
  const archive = join(directory, 'leo540-12345.dump.age')
  const manifest = join(directory, 'leo540-12345.manifest.json')
  const checksums = join(directory, 'leo540-12345.checksums.sha256')
  await writeFile(archive, 'encrypted archive fixture')
  const { createHash } = await import('node:crypto')
  const archiveSha = createHash('sha256').update('encrypted archive fixture').digest('hex')
  await writeFile(manifest, JSON.stringify({
    formatVersion: 2,
    createdAt: '2026-08-29T00:00:00Z',
    archiveSha256: archiveSha,
  }))
  await writeFile(checksums, 'placeholder\n')
  return directory
}

describe('LEO-552 artifact identity', () => {
  it('binds and verifies PR, candidate, trusted control, run, timestamp, and manifest version', async () => {
    const directory = await createBundle()
    await bindExactPrArtifactIdentity(directory, identity)
    const manifest = JSON.parse(await readFile(join(directory, 'leo540-12345.manifest.json'), 'utf8'))
    expect(manifest.artifactIdentity).toEqual({
      prNumber: 127,
      candidateSha: identity.candidateSha,
      controlSha: identity.controlSha,
      workflowRunId: identity.workflowRunId,
      backupTimestamp: '2026-08-29T00:00:00Z',
      manifestVersion: 2,
    })
    await expect(verifyExactPrArtifactIdentity(directory, identity)).resolves.toEqual({
      manifestVersion: 2,
      backupTimestamp: '2026-08-29T00:00:00Z',
    })
  })

  it('rejects an artifact bound to another candidate', async () => {
    const directory = await createBundle()
    await bindExactPrArtifactIdentity(directory, identity)
    await expect(verifyExactPrArtifactIdentity(directory, {
      ...identity,
      candidateSha: 'c'.repeat(40),
    })).rejects.toThrow('artifact_identity_mismatch')
  })
})
