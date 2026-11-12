import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { namespaceAdminViteRscGlobals } from './namespace-admin-vite-rsc-globals.mjs'

const temporaryDirectories: string[] = []

async function createOutput() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dpg-admin-rsc-'))
  temporaryDirectories.push(root)
  const workerRoot = path.join(root, 'admin-worker')
  const assetsRoot = path.join(root, 'assets/admin')
  await mkdir(workerRoot, { recursive: true })
  await mkdir(assetsRoot, { recursive: true })
  return { root, workerRoot, assetsRoot }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('Admin Vite RSC runtime namespace', () => {
  it('isolates the Admin RSC loader globals without renaming generated asset modules', async () => {
    const { workerRoot, assetsRoot } = await createOutput()
    const workerFile = path.join(workerRoot, 'ssr.js')
    const assetsFile = path.join(assetsRoot, 'runtime.js')
    const originalWorkerSource = [
      'globalThis.__vite_rsc_client_require__ = loader;',
      'globalThis.__vite_rsc_require__ = clientLoader;',
      'globalThis.__vite_rsc_server_require__ = serverLoader;',
      'import assets from "./__vite_rsc_assets_manifest.js";',
    ].join('\n')
    await writeFile(workerFile, originalWorkerSource)
    await writeFile(assetsFile, 'globalThis.__vite_rsc_client_require__ = loader;')

    const result = await namespaceAdminViteRscGlobals([workerRoot, assetsRoot])
    const workerSource = await readFile(workerFile, 'utf8')
    const assetsSource = await readFile(assetsFile, 'utf8')

    expect(result).toMatchObject({
      namespace: 'dpg-rsc0',
      globals: ['__dpg_rsc0_client_require__', '__dpg_rsc0_require__', '__dpg_rsc0_server_require__'],
      replacements: {
        __vite_rsc_client_require__: 2,
        __vite_rsc_require__: 1,
        __vite_rsc_server_require__: 1,
      },
    })
    expect(workerSource).toContain('globalThis.__dpg_rsc0_client_require__')
    expect(workerSource).toContain('./__vite_rsc_assets_manifest.js')
    expect(assetsSource).toContain('globalThis.__dpg_rsc0_client_require__')
    expect(workerSource.length).toBe(originalWorkerSource.length)
  })

  it('fails closed when the generated Worker is missing an expected RSC loader global', async () => {
    const { workerRoot, assetsRoot } = await createOutput()
    await writeFile(path.join(workerRoot, 'ssr.js'), [
      'globalThis.__vite_rsc_client_require__ = loader;',
      'globalThis.__vite_rsc_require__ = clientLoader;',
    ].join('\n'))
    await writeFile(path.join(assetsRoot, 'runtime.js'), '')

    await expect(namespaceAdminViteRscGlobals([workerRoot, assetsRoot]))
      .rejects.toThrow('ADMIN_VITE_RSC_RUNTIME_GLOBAL_MISSING')
  })
})
