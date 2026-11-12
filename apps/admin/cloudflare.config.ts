import { bindings, defineConfig, defineWorker } from 'cf/config'

const sourceSha = process.env.BUILD_SOURCE_SHA?.trim()
const appEnv = process.env.APP_ENV?.trim()
const appOrigin = process.env.APP_ORIGIN?.trim()
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()

if (!sourceSha || !/^[0-9a-f]{40}$/.test(sourceSha)) {
  throw new Error('ADMIN_WORKER_SOURCE_SHA_REQUIRED')
}
if (!['preview', 'staging'].includes(appEnv || '')) {
  throw new Error('ADMIN_WORKER_ENVIRONMENT_REQUIRED')
}
if (!appOrigin || !supabaseUrl || !publishableKey?.startsWith('sb_publishable_')) {
  throw new Error('ADMIN_WORKER_PUBLIC_CONFIG_REQUIRED')
}

Object.assign(process.env, {
  APP_BUILD_TARGET: 'admin',
  PREVIEW_NOINDEX: 'true',
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
      NEXT_PUBLIC_SUPABASE_URL: bindings.text(supabaseUrl),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: bindings.text(publishableKey),
      ADMIN_BASE_PATH: bindings.text('/admin'),
    },
  }),
})
