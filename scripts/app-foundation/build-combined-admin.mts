import { createHash } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { digestEnvironmentWorkerArtifact } from './environment-worker-artifact-digest.mjs'
import { namespaceAdminViteRscGlobals } from './namespace-admin-vite-rsc-globals.mjs'

const SOURCE_SHA = /^[0-9a-f]{40}$/
const SECRET_ENVIRONMENT_NAME = /(?:CLOUDFLARE.*(?:TOKEN|SECRET|PASSWORD)|CF_API_TOKEN|WRANGLER.*(?:TOKEN|SECRET)|SUPABASE.*(?:TOKEN|SECRET|PASSWORD|SERVICE_ROLE|DATABASE)|SERVICE_ROLE|AUTH_ADMIN|DATABASE_URL|DIRECT_URL|BUNNY.*(?:KEY|TOKEN)|PRIVATE_KEY)/i
const ENTRYPOINT_IMPORT = "import { createCombinedProductionWorker } from './combined-dispatch.mjs'\n"
const ENTRYPOINT_IMPORTS = [
  "import publicWorker from './public/server/index.js'",
  "import adminWorker from './admin/server/index.mjs'",
]
const ENTRYPOINT_DEFAULT = 'export default createCombinedProductionWorker({ publicWorker, adminWorker })'

function run(command: string, args: string[], cwd: string, environment: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: environment, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`COMBINED_ADMIN_BUILD_COMMAND_FAILED:${code}`)))
  })
}

async function assertNoSymlinks(root: string, relative = ''): Promise<void> {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true })
  for (const entry of entries) {
    const child = path.join(relative, entry.name)
    if (entry.isSymbolicLink()) throw new Error('COMBINED_ADMIN_BUILD_SYMLINK_FORBIDDEN')
    if (entry.isDirectory()) await assertNoSymlinks(root, child)
  }
}

async function copyServerTree(source: string, destination: string) {
  if (!await stat(source).then((entry) => entry.isDirectory()).catch(() => false)) {
    throw new Error('COMBINED_ADMIN_BUILD_SERVER_OUTPUT_MISSING')
  }
  await assertNoSymlinks(source)
  await cp(source, destination, {
    recursive: true,
    filter: (sourcePath) => !['wrangler.json', '.wrangler'].includes(path.basename(sourcePath)),
  })
}

async function copyClientTree(source: string, destination: string) {
  if (!await stat(source).then((entry) => entry.isDirectory()).catch(() => false)) {
    throw new Error('COMBINED_ADMIN_BUILD_CLIENT_OUTPUT_MISSING')
  }
  await assertNoSymlinks(source)
  await cp(source, destination, { recursive: true })
}

async function addAdminWorkerModuleAliases(serverRoot: string) {
  // The root Next/Vinext build emits .mjs server entrypoints but its internal
  // fetch-handler still refers to three .js module paths. Keep the built server
  // tree intact and provide narrow ESM aliases for Wrangler's module graph.
  const aliases = [
    { source: 'index.mjs', target: 'index.js', specifier: './index.mjs' },
    { source: 'ssr/index.mjs', target: 'ssr/index.js', specifier: './index.mjs' },
    {
      source: 'vinext-client-assets.js',
      target: 'admin/_next/static/vinext-client-assets.js',
      specifier: '../../../vinext-client-assets.js',
    },
  ]

  for (const alias of aliases) {
    const sourcePath = path.join(serverRoot, alias.source)
    const targetPath = path.join(serverRoot, alias.target)
    if (!await stat(sourcePath).then((entry) => entry.isFile()).catch(() => false)) {
      throw new Error('COMBINED_ADMIN_RUNTIME_ALIAS_SOURCE_MISSING')
    }
    if (await stat(targetPath).then((entry) => entry.isFile()).catch(() => false)) continue
    await mkdir(path.dirname(targetPath), { recursive: true })
    await writeFile(targetPath, `export { default } from '${alias.specifier}'\nexport * from '${alias.specifier}'\n`, 'utf8')
  }
}

function sha256(bytes: Buffer | string) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function assertNoRuntimeConfig(root: string, relative = ''): Promise<void> {
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const child = path.join(relative, entry.name)
    if (entry.isSymbolicLink()) throw new Error('COMBINED_ADMIN_ARTIFACT_SYMLINK_FORBIDDEN')
    if (entry.isDirectory()) {
      await assertNoRuntimeConfig(root, child)
      continue
    }
    if (!entry.isFile()) throw new Error('COMBINED_ADMIN_ARTIFACT_ENTRY_INVALID')
    if (/^wrangler\.(?:jsonc?|toml)$/i.test(entry.name)) throw new Error('COMBINED_ADMIN_ARTIFACT_WRANGLER_CONFIG_FORBIDDEN')
    // Binary assets can contain arbitrary byte sequences that happen to look
    // like text sentinels (notably the 32-zero local Hyperdrive placeholder).
    // Runtime bindings and local connection strings only enter through text
    // config or code, which remain covered by this scan.
    if (/\.(?:wasm|avif|gif|ico|jpe?g|png|webp|woff2?|ttf|otf)$/i.test(entry.name)) continue
    const content = await readFile(path.join(root, child))
    const text = content.toString('utf8')
    if (text.includes('local-only-spike-pass') || text.includes('127.0.0.1:55439')
      || text.includes('00000000000000000000000000000000')) {
      throw new Error('COMBINED_ADMIN_ARTIFACT_LOCAL_BINDING_FORBIDDEN')
    }
  }
}

async function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const sourceSha = process.env.BUILD_SOURCE_SHA?.trim()
  if (!sourceSha || !SOURCE_SHA.test(sourceSha)) throw new Error('COMBINED_ADMIN_SOURCE_SHA_REQUIRED')
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim()
  if (head !== sourceSha) throw new Error('COMBINED_ADMIN_SOURCE_SHA_MISMATCH')
  const trackedChanges = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim()
  if (trackedChanges) throw new Error('COMBINED_ADMIN_SOURCE_TREE_DIRTY')
  const leakedNames = Object.keys(process.env).filter((name) => process.env[name] && SECRET_ENVIRONMENT_NAME.test(name))
  if (leakedNames.length) throw new Error('COMBINED_ADMIN_BUILD_CREDENTIAL_ENV_FORBIDDEN')

  const catalogueCheckpoint = process.env.PUBLIC_CATALOGUE_CHECKPOINT?.trim()
  if (catalogueCheckpoint && !SOURCE_SHA.test(catalogueCheckpoint)) {
    throw new Error('COMBINED_ADMIN_PUBLIC_CATALOGUE_CHECKPOINT_INVALID')
  }

  const outputRoot = path.join(repositoryRoot, 'dist/combined-admin')
  await rm(outputRoot, { recursive: true, force: true })
  const combinedRoot = path.join(outputRoot, 'combined')
  const publicServerSource = path.join(repositoryRoot, 'apps/public/dist/server')
  const publicAssetsSource = path.join(repositoryRoot, 'apps/public/dist/client')
  const adminServerSource = path.join(repositoryRoot, 'dist/server')
  const adminAssetsSource = path.join(repositoryRoot, 'dist/client')
  const publicServer = path.join(combinedRoot, 'public/server')
  const adminServer = path.join(combinedRoot, 'admin/server')
  const assetsRoot = path.join(combinedRoot, 'assets')

  const buildEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    APP_ENV: 'production',
    APP_ORIGIN: 'https://www.dongphugia.vn',
    APP_BUILD_TARGET: 'public',
    ADMIN_ASSET_PREFIX: '',
    PUBLIC_CATALOGUE_SOURCE: 'production-published-snapshot',
    BUILD_SOURCE_SHA: sourceSha,
    WRANGLER_SEND_METRICS: 'false',
  }
  if (catalogueCheckpoint) buildEnvironment.PUBLIC_CATALOGUE_CHECKPOINT = catalogueCheckpoint
  else delete buildEnvironment.PUBLIC_CATALOGUE_CHECKPOINT

  await run('npm', ['--prefix', 'apps/public', 'run', 'build:worker'], repositoryRoot, buildEnvironment)

  const adminBuildEnvironment = {
    ...buildEnvironment,
    APP_BUILD_TARGET: 'admin',
    ADMIN_ASSET_PREFIX: '/admin',
  }
  await run(process.execPath, [
    path.join(repositoryRoot, 'apps/public/node_modules/vite/bin/vite.js'),
    'build',
    '--config',
    'vite.admin-worker-production.config.ts',
  ], path.join(repositoryRoot, 'apps/public'), adminBuildEnvironment)

  await mkdir(publicServer, { recursive: true })
  await mkdir(adminServer, { recursive: true })
  await mkdir(assetsRoot, { recursive: true })
  await copyServerTree(publicServerSource, publicServer)
  await copyServerTree(adminServerSource, adminServer)
  await copyClientTree(publicAssetsSource, assetsRoot)
  await addAdminWorkerModuleAliases(adminServer)

  const adminPrefixedAssets = path.join(adminAssetsSource, 'admin')
  const adminAssetsToCopy = await stat(adminPrefixedAssets).then((entry) => entry.isDirectory()).catch(() => false)
    ? adminPrefixedAssets
    : adminAssetsSource
  const combinedAdminAssets = path.join(assetsRoot, 'admin')
  if (await stat(path.join(assetsRoot, 'admin')).then((entry) => entry.isDirectory()).catch(() => false)) {
    throw new Error('COMBINED_ADMIN_PUBLIC_ASSET_PATH_COLLISION')
  }
  await copyClientTree(adminAssetsToCopy, combinedAdminAssets)

  const adminRscNamespace = await namespaceAdminViteRscGlobals([adminServer, combinedAdminAssets])
  if (adminRscNamespace.namespace !== 'dpg-rsc0') throw new Error('COMBINED_ADMIN_RSC_NAMESPACE_INVALID')

  const sourceEntrypoint = await readFile(path.join(repositoryRoot, 'apps/public/worker.combined.mjs'), 'utf8')
  if (!ENTRYPOINT_IMPORTS.every((statement) => sourceEntrypoint.includes(`${statement}\n`))
    || !sourceEntrypoint.includes(ENTRYPOINT_IMPORT) || !sourceEntrypoint.includes(ENTRYPOINT_DEFAULT)) {
    throw new Error('COMBINED_ADMIN_WORKER_TEMPLATE_INVALID')
  }
  const dispatchSource = await readFile(path.join(repositoryRoot, 'apps/public/combined-dispatch.mjs'), 'utf8')
  const workerSource = sourceEntrypoint
    .replace(ENTRYPOINT_IMPORT, '')
    .replace(ENTRYPOINT_DEFAULT, '')
  const workerPath = path.join(combinedRoot, 'worker.mjs')
  const combinedWorkerSource = `${workerSource.trim()}\n\n${dispatchSource.trim()}\n\n${ENTRYPOINT_DEFAULT}\n`
  if (!ENTRYPOINT_IMPORTS.every((statement) => combinedWorkerSource.includes(`${statement}\n`))) {
    throw new Error('COMBINED_ADMIN_WORKER_SERVER_IMPORTS_MISSING')
  }
  await writeFile(workerPath, combinedWorkerSource, 'utf8')

  const [publicServerDigest, adminServerDigest, assetsDigest] = await Promise.all([
    digestEnvironmentWorkerArtifact(publicServer),
    digestEnvironmentWorkerArtifact(adminServer),
    digestEnvironmentWorkerArtifact(assetsRoot),
  ])
  const manifest = {
    contract: 'dpg:combined-public-admin-worker:v1',
    sourceSha,
    entrypoint: 'combined/worker.mjs',
    hosts: { admin: '/admin', public: ['dongphugia.vn', 'www.dongphugia.vn'] },
    schema: 'dpg_app',
    bindings: {
      ASSETS: { type: 'assets' },
      HYPERDRIVE_ADMIN_NO_CACHE: { type: 'hyperdrive', cache: 'off' },
    },
    vars: {
      APP_ENV: 'production',
      APP_ORIGIN: 'https://www.dongphugia.vn',
      APP_BUILD_TARGET: 'public',
      RUNTIME_ROLE: 'production',
      WRITE_FREEZE_MODE: 'false',
      PRISMA_REQUEST_SCOPE_REQUIRED: 'true',
      PUBLIC_CATALOGUE_SOURCE: 'production-published-snapshot',
      ...(catalogueCheckpoint ? { PUBLIC_CATALOGUE_CHECKPOINT: catalogueCheckpoint } : {}),
    },
    hashes: {
      worker: sha256(await readFile(workerPath)),
      publicServer: publicServerDigest,
      adminServer: adminServerDigest,
      assets: assetsDigest,
    },
  }
  await writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  await assertNoRuntimeConfig(outputRoot)

  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    stage: 'COMBINED_ADMIN_ARTIFACT',
    sourceSha,
    outputRoot: path.relative(repositoryRoot, outputRoot),
    entrypoint: manifest.entrypoint,
    manifest: path.relative(repositoryRoot, path.join(outputRoot, 'manifest.json')),
    publicServer: publicServerDigest,
    adminServer: adminServerDigest,
    assets: assetsDigest,
    adminRscNamespace,
    publicCatalogueCheckpoint: catalogueCheckpoint ?? null,
  })}\n`)
}

main().catch((error) => {
  process.stderr.write(`COMBINED_ADMIN_BUILD_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}\n`)
  process.exitCode = 1
})
