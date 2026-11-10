import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  createAdminWorkerArtifactEvidence,
  verifyAdminWorkerArtifactEvidence,
} from './admin-worker-artifact.mjs'

const sourceSha = 'c02d22fd15dd0ae9c1e96654f7f7525a340975fe'
const tempDirectories = []

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dpg-admin-worker-artifact-'))
  tempDirectories.push(root)
  const buildOutputDir = path.join(root, 'build')
  const workerDir = path.join(buildOutputDir, 'workers/default')
  await mkdir(path.join(workerDir, 'bundle'), { recursive: true })
  await mkdir(path.join(workerDir, 'assets'), { recursive: true })
  await writeFile(path.join(workerDir, 'bundle/index.js'), 'export default { fetch() {} }')
  await writeFile(path.join(workerDir, 'assets/_headers'), '/*\n  X-Robots-Tag: noindex\n')
  const config = {
    name: 'dongphugia-phase2-admin-preview-290',
    workersDev: true,
    previewUrls: false,
    domains: [],
    cache: { enabled: false },
    observability: { enabled: false },
    manifest: { type: 'partial', mainModule: 'index.js', modules: {} },
    env: {
      ASSETS: { type: 'assets' },
      APP_ENV: { type: 'text', value: 'preview' },
      APP_BUILD_TARGET: { type: 'text', value: 'admin' },
      APP_ORIGIN: { type: 'text', value: 'https://dongphugia-phase2-admin-preview-290.tranhuunguyenhuy.workers.dev' },
      PREVIEW_NOINDEX: { type: 'text', value: 'true' },
      BUILD_SOURCE_SHA: { type: 'text', value: sourceSha },
      NEXT_PUBLIC_SUPABASE_URL: { type: 'text', value: 'https://uybumsnyqpwcidjxmfsv.supabase.co' },
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: { type: 'text', value: 'sb_publishable_test_preview_key' },
    },
  }
  await writeFile(path.join(workerDir, 'worker.config.json'), JSON.stringify(config))
  return { root, buildOutputDir, evidencePath: path.join(root, 'evidence.json') }
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('synthetic Admin Worker artifact evidence', () => {
  it('binds the Worker output to the exact source, target, and no-domain Preview config', async () => {
    const value = await fixture()
    const evidence = await createAdminWorkerArtifactEvidence({ buildOutputDir: value.buildOutputDir, sourceSha })
    await writeFile(value.evidencePath, JSON.stringify(evidence))
    await expect(verifyAdminWorkerArtifactEvidence({ ...value, sourceSha })).resolves.toEqual(evidence)
    await expect(verifyAdminWorkerArtifactEvidence({ ...value, sourceSha: 'b'.repeat(40) }))
      .rejects.toThrow('DPG_ADMIN_WORKER_PREVIEW_CONFIG_INVALID')
    expect(JSON.stringify(evidence)).not.toContain('sb_publishable_test_preview_key')
  })

  it('rejects a custom domain or a credential-like binding before deployment', async () => {
    const value = await fixture()
    const configPath = path.join(value.buildOutputDir, 'workers/default/worker.config.json')
    const config = JSON.parse(await readFile(configPath, 'utf8'))
    config.domains = ['admin.dongphugia.vn']
    config.env.SUPABASE_SERVICE_ROLE_KEY = { type: 'text', value: 'not-a-secret' }
    await writeFile(configPath, JSON.stringify(config))
    await expect(createAdminWorkerArtifactEvidence({ buildOutputDir: value.buildOutputDir, sourceSha }))
      .rejects.toThrow('DPG_ADMIN_WORKER_PREVIEW_CONFIG_INVALID')
  })
})
