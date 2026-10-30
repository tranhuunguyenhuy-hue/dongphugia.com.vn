// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, open, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { comparePublicBuildDirectories } from './public-preview.mjs'

async function directories() {
  const root = await mkdtemp(path.join(tmpdir(), 'dpg-preview-determinism-'))
  const first = path.join(root, 'candidate-one')
  const second = path.join(root, 'candidate-two')
  await mkdir(path.join(first, 'assets'), { recursive: true })
  await mkdir(path.join(second, 'assets'), { recursive: true })
  await writeFile(path.join(first, 'worker.js'), 'worker bytes\n')
  await writeFile(path.join(second, 'worker.js'), 'worker bytes\n')
  await writeFile(path.join(first, 'assets', 'index.html'), '<main>same output</main>\n')
  await writeFile(path.join(second, 'assets', 'index.html'), '<main>same output</main>\n')
  return { root, first, second }
}

describe('Public Preview independent-build comparison', () => {
  it('passes only when every relative file path and byte sequence is identical', async () => {
    const { root, first, second } = await directories()
    try {
      await expect(comparePublicBuildDirectories({ firstRoot: first, secondRoot: second })).resolves.toMatchObject({
        contract: 'dpg:public-preview-determinism:v1',
        status: 'PASS',
        firstFileCount: 2,
        secondFileCount: 2,
        differingFileCount: 0,
        firstSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        secondSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        differences: [],
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reports only sanitized per-file hashes and byte counts when a rebuild differs', async () => {
    const { root, first, second } = await directories()
    try {
      await writeFile(path.join(second, 'assets', 'index.html'), '<main>changed output</main>\n')
      await writeFile(path.join(first, 'removed.txt'), 'old')
      await writeFile(path.join(second, 'added.txt'), 'new')

      const result = await comparePublicBuildDirectories({ firstRoot: first, secondRoot: second })
      expect(result).toMatchObject({
        contract: 'dpg:public-preview-determinism:v1',
        status: 'FAIL',
        differingFileCount: 3,
      })
      expect(result.differences).toEqual([
        { path: 'added.txt', firstSha256: null, firstBytes: null, secondSha256: expect.stringMatching(/^[a-f0-9]{64}$/), secondBytes: 3 },
        { path: 'assets/index.html', firstSha256: expect.stringMatching(/^[a-f0-9]{64}$/), firstBytes: 25, secondSha256: expect.stringMatching(/^[a-f0-9]{64}$/), secondBytes: 28 },
        { path: 'removed.txt', firstSha256: expect.stringMatching(/^[a-f0-9]{64}$/), firstBytes: 3, secondSha256: null, secondBytes: null },
      ])
      expect(JSON.stringify(result)).not.toContain(root)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails closed when either build contains a symbolic link', async () => {
    const { root, first, second } = await directories()
    try {
      await symlink(path.join(first, 'worker.js'), path.join(second, 'linked-worker.js'))
      await expect(comparePublicBuildDirectories({ firstRoot: first, secondRoot: second }))
        .rejects.toThrow('PUBLIC_PREVIEW_DETERMINISM_SYMLINK_FORBIDDEN')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects a symbolic link used as a build root', async () => {
    const { root, first, second } = await directories()
    try {
      const alias = path.join(root, 'candidate-root-link')
      await symlink(first, alias)
      await expect(comparePublicBuildDirectories({ firstRoot: alias, secondRoot: second }))
        .rejects.toThrow('PUBLIC_PREVIEW_DETERMINISM_ROOT_UNSAFE')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects an oversized file before reading its contents', async () => {
    const { root, first, second } = await directories()
    try {
      const handle = await open(path.join(first, 'oversized.bin'), 'w')
      await handle.truncate(25 * 1024 * 1024 + 1)
      await handle.close()
      await expect(comparePublicBuildDirectories({ firstRoot: first, secondRoot: second }))
        .rejects.toThrow('PUBLIC_PREVIEW_DETERMINISM_FILE_BYTE_LIMIT')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
