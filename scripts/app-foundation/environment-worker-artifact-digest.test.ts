import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { digestEnvironmentWorkerArtifact } from './environment-worker-artifact-digest.mjs'

const temporaryDirectories: string[] = []

async function createArtifact() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dpg-artifact-digest-'))
  temporaryDirectories.push(root)
  await mkdir(path.join(root, 'assets'))
  await writeFile(path.join(root, 'worker.mjs'), 'export default {}\n')
  await writeFile(path.join(root, 'assets', 'index.html'), '<main>staging</main>\n')
  return root
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('Staging artifact digest', () => {
  it('binds sorted relative paths and file bytes into a stable SHA-256', async () => {
    const root = await createArtifact()
    const first = await digestEnvironmentWorkerArtifact(root)
    const second = await digestEnvironmentWorkerArtifact(root)

    expect(first).toEqual(second)
    expect(first.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(first.fileCount).toBe(2)
    expect(first.totalBytes).toBe(Buffer.byteLength('export default {}\n') + Buffer.byteLength('<main>staging</main>\n'))

    await writeFile(path.join(root, 'assets', 'index.html'), '<main>changed</main>\n')
    await expect(digestEnvironmentWorkerArtifact(root)).resolves.toMatchObject({
      sha256: expect.not.stringMatching(first.sha256),
    })
  })

  it('rejects empty artifacts and symbolic links', async () => {
    const empty = await mkdtemp(path.join(os.tmpdir(), 'dpg-artifact-empty-'))
    temporaryDirectories.push(empty)
    await expect(digestEnvironmentWorkerArtifact(empty)).rejects.toThrow('ENVIRONMENT_WORKER_ARTIFACT_EMPTY')

    const root = await createArtifact()
    await symlink(path.join(root, 'worker.mjs'), path.join(root, 'linked-worker.mjs'))
    await expect(digestEnvironmentWorkerArtifact(root)).rejects.toThrow('ENVIRONMENT_WORKER_ARTIFACT_SYMLINK_FORBIDDEN')
  })

  it('separates file boundaries even when content contains NUL bytes', async () => {
    const single = await mkdtemp(path.join(os.tmpdir(), 'dpg-artifact-single-'))
    const split = await mkdtemp(path.join(os.tmpdir(), 'dpg-artifact-split-'))
    temporaryDirectories.push(single, split)
    await writeFile(path.join(single, 'a'), Buffer.from('x\0b\0c'))
    await writeFile(path.join(split, 'a'), 'x')
    await writeFile(path.join(split, 'b'), 'c')

    const singleDigest = await digestEnvironmentWorkerArtifact(single)
    const splitDigest = await digestEnvironmentWorkerArtifact(split)
    expect(singleDigest.sha256).not.toBe(splitDigest.sha256)
  })
})
