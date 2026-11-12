import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const SUBDOMAIN = 'tranhuunguyenhuy'
const SOURCE_SHA = /^[0-9a-f]{40}$/
const APP_ENVIRONMENTS = {
  preview: { workerName: 'dpg-preview' },
  staging: { workerName: 'dpg-staging' },
} as const
const PROVIDER_CREDENTIAL_NAME = /(CLOUDFLARE.*(TOKEN|SECRET|PASSWORD)|CF_API_TOKEN|WRANGLER.*(TOKEN|SECRET)|SERVICE_ROLE|AUTH_ADMIN|DATABASE_URL|DIRECT_URL|BUNNY.*(KEY|TOKEN)|PRIVATE_KEY)/i

function requireString(value: string | undefined, error: string) {
  const normalized = value?.trim()
  if (!normalized) throw new Error(error)
  return normalized
}

function run(command: string, args: string[], cwd: string, environment: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: environment, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code) => code === 0
      ? resolve()
      : reject(new Error(`ENVIRONMENT_WORKER_BUILD_COMMAND_FAILED:${code}`)))
  })
}

async function listFiles(root: string, relative = ''): Promise<string[]> {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const child = path.join(relative, entry.name)
    if (entry.isSymbolicLink()) throw new Error('ENVIRONMENT_WORKER_SYMLINK_FORBIDDEN')
    if (entry.isDirectory()) files.push(...await listFiles(root, child))
    else if (entry.isFile()) files.push(child)
  }
  return files
}

async function digestDirectory(root: string) {
  const hash = createHash('sha256')
  let fileCount = 0
  let totalBytes = 0
  for (const relative of await listFiles(root)) {
    const content = await readFile(path.join(root, relative))
    hash.update(`${relative.split(path.sep).join('/')}\0`)
    hash.update(content)
    hash.update('\0')
    fileCount += 1
    totalBytes += content.byteLength
  }
  return { sha256: hash.digest('hex'), fileCount, totalBytes }
}

async function main() {
  const repositoryRoot = path.resolve(process.cwd())
  const sourceSha = requireString(process.env.BUILD_SOURCE_SHA, 'ENVIRONMENT_WORKER_SOURCE_SHA_REQUIRED')
  if (!SOURCE_SHA.test(sourceSha)) throw new Error('ENVIRONMENT_WORKER_SOURCE_SHA_INVALID')
  const appEnvironment = requireString(process.env.APP_ENV, 'ENVIRONMENT_WORKER_ENVIRONMENT_REQUIRED') as keyof typeof APP_ENVIRONMENTS
  const target = APP_ENVIRONMENTS[appEnvironment]
  if (!target) throw new Error('ENVIRONMENT_WORKER_ENVIRONMENT_INVALID')
  const expectedName = requireString(process.env.APP_WORKER_NAME, 'ENVIRONMENT_WORKER_NAME_REQUIRED')
  if (expectedName !== target.workerName) throw new Error('ENVIRONMENT_WORKER_NAME_MISMATCH')
  const origin = `https://${expectedName}.${SUBDOMAIN}.workers.dev`
  if (process.env.APP_ORIGIN !== origin) throw new Error('ENVIRONMENT_WORKER_ORIGIN_MISMATCH')
  if (process.env.PREVIEW_NOINDEX !== 'true') throw new Error('ENVIRONMENT_WORKER_NOINDEX_REQUIRED')
  if (Object.entries(process.env).some(([name, value]) => value && PROVIDER_CREDENTIAL_NAME.test(name))) {
    throw new Error('ENVIRONMENT_WORKER_BUILD_PROVIDER_CREDENTIAL_FORBIDDEN')
  }

  const supabaseUrlValue = requireString(process.env.NEXT_PUBLIC_SUPABASE_URL, 'ENVIRONMENT_WORKER_SUPABASE_URL_REQUIRED')
  const publishableKey = requireString(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'ENVIRONMENT_WORKER_SUPABASE_KEY_REQUIRED')
  if (!publishableKey.startsWith('sb_publishable_')) throw new Error('ENVIRONMENT_WORKER_SUPABASE_KEY_INVALID')
  const parsedSupabaseUrl = new URL(supabaseUrlValue)
  if (parsedSupabaseUrl.protocol !== 'https:'
    || !( /^[a-z0-9-]+\.supabase\.co$/.test(parsedSupabaseUrl.hostname) || parsedSupabaseUrl.hostname === 'supabase.invalid')
    || parsedSupabaseUrl.port
    || parsedSupabaseUrl.username || parsedSupabaseUrl.password || parsedSupabaseUrl.pathname !== '/'
    || parsedSupabaseUrl.search || parsedSupabaseUrl.hash) {
    throw new Error('ENVIRONMENT_WORKER_SUPABASE_URL_INVALID')
  }
  const supabaseUrl = parsedSupabaseUrl.origin

  const commonBuildEnvironment = {
    ...process.env,
    APP_ENV: appEnvironment,
    APP_ORIGIN: origin,
    APP_WORKER_NAME: expectedName,
    PREVIEW_NOINDEX: 'true',
    BUILD_SOURCE_SHA: sourceSha,
    WRANGLER_SEND_METRICS: 'false',
  }
  const publicBuildEnvironment = { ...commonBuildEnvironment, APP_BUILD_TARGET: 'public' }
  // These belong only to Admin. Do not let Public's build process inline
  // Admin's Auth project details or publishable key into its own bundle.
  delete publicBuildEnvironment.NEXT_PUBLIC_SUPABASE_URL
  delete publicBuildEnvironment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const adminBuildEnvironment = {
    ...commonBuildEnvironment,
    APP_BUILD_TARGET: 'admin',
    ADMIN_BASE_PATH: '/admin',
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  }
  // Preview and Staging always use the code-owned synthetic fixture surface.
  // Never inherit a catalogue snapshot checkpoint from a developer shell or CI.
  delete appEnvironmentVariables.PUBLIC_CATALOGUE_CHECKPOINT
  delete appEnvironmentVariables.PUBLIC_CATALOGUE_SNAPSHOT
  const outputRoot = path.join(repositoryRoot, '.artifacts', 'environment-worker', appEnvironment)
  const publicServer = path.join(repositoryRoot, 'apps/public/dist/server')
  const publicAssets = path.join(repositoryRoot, 'apps/public/dist/client')
  const adminOutput = path.join(repositoryRoot, 'apps/admin/.cloudflare/output/v0/workers/default')
  const adminBundle = path.join(adminOutput, 'bundle')
  const adminAssets = path.join(adminOutput, 'assets')

  await run('npm', ['--prefix', 'apps/public', 'run', 'build:worker'], repositoryRoot, publicBuildEnvironment)
  await run(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], path.join(repositoryRoot, 'apps/admin'), {
    ...adminBuildEnvironment,
  })

  for (const directory of [publicServer, publicAssets, adminBundle, adminAssets]) {
    if (!await stat(directory).then((entry) => entry.isDirectory()).catch(() => false)) {
      throw new Error('ENVIRONMENT_WORKER_APPLICATION_BUILD_MISSING')
    }
  }
  for (const directory of [publicServer, publicAssets]) {
    for (const relative of await listFiles(directory)) {
      const content = await readFile(path.join(directory, relative))
      if (content.includes(supabaseUrl) || content.includes(publishableKey)) {
        throw new Error('ENVIRONMENT_WORKER_PUBLIC_SUPABASE_CONFIG_LEAKED')
      }
    }
  }
  const adminConfigPath = path.join(adminOutput, 'worker.config.json')
  const adminConfig = JSON.parse(await readFile(adminConfigPath, 'utf8')) as Record<string, unknown>
  const adminBindings = adminConfig.env as Record<string, { type?: string; value?: string }> | undefined
  if (adminConfig.name !== 'dpg-admin-build' || adminConfig.workersDev !== true || adminConfig.previewUrls !== false
    || JSON.stringify(adminConfig.domains) !== '[]'
    || adminBindings?.ADMIN_BASE_PATH?.value !== '/admin'
    || adminBindings?.APP_ENV?.value !== appEnvironment
    || adminBindings?.APP_ORIGIN?.value !== origin
    || adminBindings?.BUILD_SOURCE_SHA?.value !== sourceSha
    || adminBindings?.NEXT_PUBLIC_SUPABASE_URL?.value !== supabaseUrl
    || adminBindings?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.value !== publishableKey
    || Object.entries(adminBindings ?? {}).some(([key, binding]) => /secret|service_role|password|database_url/i.test(key)
      || binding?.type === 'secret')) {
    throw new Error('ENVIRONMENT_WORKER_ADMIN_BUILD_CONFIG_INVALID')
  }

  await rm(outputRoot, { recursive: true, force: true })
  await mkdir(outputRoot, { recursive: true })
  await cp(publicServer, path.join(outputRoot, 'public-worker'), {
    recursive: true,
    filter: (source) => !['wrangler.json', '.wrangler'].includes(path.basename(source)),
  })
  await cp(adminBundle, path.join(outputRoot, 'admin-worker'), { recursive: true })
  await cp(publicAssets, path.join(outputRoot, 'assets'), { recursive: true })
  // The Admin adapter already emits files under `admin/` for its basePath.
  // Copying into assets/admin would create `/admin/admin/_next/...` and break
  // the paths rendered by its HTML.
  await cp(adminAssets, path.join(outputRoot, 'assets'), { recursive: true })
  await cp(path.join(repositoryRoot, 'apps/environment-worker/worker.mjs'), path.join(outputRoot, 'worker.mjs'))
  await cp(path.join(repositoryRoot, 'apps/environment-worker/dispatch.mjs'), path.join(outputRoot, 'dispatch.mjs'))
  await writeFile(path.join(outputRoot, 'assets/_headers'), [
    'https://:version.:subdomain.workers.dev/*',
    '  X-Robots-Tag: noindex, nofollow',
    '/admin/*',
    '  Cache-Control: private, no-store',
    '  X-Robots-Tag: noindex, nofollow',
    '/admin/_next/static/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '/_next/static/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n'), 'utf8')

  const wranglerConfig = {
    name: expectedName,
    main: 'worker.mjs',
    compatibility_date: '2026-11-12',
    compatibility_flags: ['nodejs_compat'],
    workers_dev: true,
    preview_urls: false,
    assets: { directory: 'assets', binding: 'ASSETS', not_found_handling: 'none', run_worker_first: ['/*'] },
    observability: {
      enabled: true,
      logs: { enabled: true, persist: false, invocation_logs: true },
      traces: { enabled: false, persist: false },
    },
    vars: {
      APP_ENV: appEnvironment,
      APP_ORIGIN: origin,
      PREVIEW_NOINDEX: 'true',
      BUILD_SOURCE_SHA: sourceSha,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      ADMIN_BASE_PATH: '/admin',
    },
  }
  const configText = `${JSON.stringify(wranglerConfig, null, 2)}\n`
  await writeFile(path.join(outputRoot, 'wrangler.json'), configText, 'utf8')

  const [publicWorkerDigest, adminWorkerDigest, assetsDigest] = await Promise.all([
    digestDirectory(path.join(outputRoot, 'public-worker')),
    digestDirectory(path.join(outputRoot, 'admin-worker')),
    digestDirectory(path.join(outputRoot, 'assets')),
  ])
  const manifest = {
    contract: 'dpg:combined-environment-worker:v1',
    sourceSha,
    appEnvironment,
    workerName: expectedName,
    origin,
    apps: {
      public: { entrypoint: 'public-worker/index.js', ...publicWorkerDigest },
      admin: { entrypoint: 'admin-worker/index.js', basePath: '/admin', assetsBasePath: '/admin/', ...adminWorkerDigest },
    },
    assets: assetsDigest,
    dispatcher: {
      entrypoint: 'worker.mjs',
      sha256: createHash('sha256').update(await readFile(path.join(outputRoot, 'worker.mjs'))).digest('hex'),
      dispatchSha256: createHash('sha256').update(await readFile(path.join(outputRoot, 'dispatch.mjs'))).digest('hex'),
    },
    configSha256: createHash('sha256').update(configText).digest('hex'),
    supabase: { url: supabaseUrl, publishableKeySha256: createHash('sha256').update(publishableKey).digest('hex') },
    deployment: { workersDev: true, previewUrls: false, customDomains: [], routes: [], noindex: true },
    dataMode: 'synthetic-fixtures',
    observability: { logs: true, persist: false, traces: false },
  }
  await writeFile(path.join(outputRoot, 'candidate-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  const wrangler = path.join(repositoryRoot, 'apps/environment-worker/node_modules/wrangler/bin/wrangler.js')
  const dryRunEnvironment = { ...commonBuildEnvironment, WRANGLER_SEND_METRICS: 'false' }
  delete dryRunEnvironment.CLOUDFLARE_API_TOKEN
  delete dryRunEnvironment.CLOUDFLARE_ACCOUNT_ID
  delete dryRunEnvironment.CLOUDFLARE_PREVIEW_WORKER_EDITOR_TOKEN
  delete dryRunEnvironment.CLOUDFLARE_STAGING_WORKER_EDITOR_TOKEN
  await run(process.execPath, [wrangler, 'deploy', '--dry-run', '--strict', '--config', 'wrangler.json'], outputRoot, {
    ...dryRunEnvironment,
  })
  process.stdout.write(`${JSON.stringify({ status: 'ENVIRONMENT_WORKER_BUILD_PASS', sourceSha, appEnvironment, workerName: expectedName, outputRoot, manifest })}\n`)
}

main().catch((error) => {
  console.error(`ENVIRONMENT_WORKER_BUILD_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}`)
  process.exitCode = 1
})
