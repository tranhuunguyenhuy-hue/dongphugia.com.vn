import { bindings, defineConfig, defineWorker } from 'cf/config'

const sourceSha = process.env.BUILD_SOURCE_SHA?.trim()
const appEnv = process.env.APP_ENV?.trim()
const appOrigin = process.env.APP_ORIGIN?.trim()
const authEnabled = process.env.NEXT_PUBLIC_ADMIN_AUTH_ENABLED?.trim() === 'true'

if (!sourceSha || !/^[0-9a-f]{40}$/.test(sourceSha)) {
  throw new Error('ADMIN_WORKER_SOURCE_SHA_REQUIRED')
}
if (!['preview', 'staging'].includes(appEnv || '')) {
  throw new Error('ADMIN_WORKER_ENVIRONMENT_REQUIRED')
}
if (!appOrigin) {
  throw new Error('ADMIN_WORKER_PUBLIC_CONFIG_REQUIRED')
}
if (authEnabled) throw new Error('ADMIN_WORKER_AUTH_MUST_BE_DISABLED')

Object.assign(process.env, {
  APP_BUILD_TARGET: 'admin',
  PREVIEW_NOINDEX: 'true',
  ADMIN_AUTH_ENABLED: 'false',
  NEXT_PUBLIC_ADMIN_AUTH_ENABLED: 'false',
  ADMIN_BASE_PATH: '/admin',
})

export default defineConfig({
  worker: defineWorker({
    // This build-only name is never deployed. The trusted publisher replaces
    // it with one of the two allowlisted environment Worker names.
    name: 'dpg-admin-build',
    entrypoint: 'vinext/server/fetch-handler',
    compatibilityDate: '2026-11-12',
    compatibilityFlags: ['nodejs_compat'],
    workersDev: true,
    previewUrls: false,
    domains: [],
    cache: { enabled: false },
    observability: { enabled: false },
    assets: {
      htmlHandling: 'none',
      notFoundHandling: 'none',
      runWorkerFirst: ['/*'],
    },
    env: {
      ASSETS: bindings.assets(),
      APP_ENV: bindings.text(appEnv!),
      APP_BUILD_TARGET: bindings.text('admin'),
      APP_ORIGIN: bindings.text(appOrigin),
      PREVIEW_NOINDEX: bindings.text('true'),
      BUILD_SOURCE_SHA: bindings.text(sourceSha),
      ADMIN_AUTH_ENABLED: bindings.text('false'),
      ADMIN_BASE_PATH: bindings.text('/admin'),
    },
  }),
})
