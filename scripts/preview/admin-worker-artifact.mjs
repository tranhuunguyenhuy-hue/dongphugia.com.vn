import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const CONTRACT = 'dongphugia:phase2-admin-worker-artifact:v1'
const WORKER_NAME = 'dongphugia-phase2-admin-preview-290'
const WORKER_ORIGIN = 'https://dongphugia-phase2-admin-preview-290.tranhuunguyenhuy.workers.dev'
const SUPABASE_URL = 'https://uybumsnyqpwcidjxmfsv.supabase.co'
const SOURCE_SHA_PATTERN = /^[0-9a-f]{40}$/

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function digestDirectory(root) {
  const hash = createHash('sha256')
  let fileCount = 0
  let totalBytes = 0
  const walk = async (relative = '') => {
    const entries = await readdir(path.join(root, relative), { withFileTypes: true })
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const child = path.join(relative, entry.name)
      if (entry.isSymbolicLink()) throw new Error('DPG_ADMIN_WORKER_ARTIFACT_SYMLINK_FORBIDDEN')
      if (entry.isDirectory()) {
        await walk(child)
      } else if (entry.isFile()) {
        const bytes = await readFile(path.join(root, child))
        hash.update(`${child.split(path.sep).join('/')}\0`)
        hash.update(bytes)
        hash.update('\0')
        fileCount += 1
        totalBytes += bytes.byteLength
      }
    }
  }
  await walk()
  if (fileCount === 0) throw new Error('DPG_ADMIN_WORKER_ARTIFACT_EMPTY')
  return { sha256: hash.digest('hex'), fileCount, totalBytes }
}

export async function createAdminWorkerArtifactEvidence({ buildOutputDir, sourceSha }) {
  if (!SOURCE_SHA_PATTERN.test(sourceSha ?? '')) throw new Error('DPG_ADMIN_WORKER_SOURCE_SHA_INVALID')
  const configPath = path.join(buildOutputDir, 'workers/default/worker.config.json')
  const workerEntry = path.join(buildOutputDir, 'workers/default/bundle/index.js')
  const assetRoot = path.join(buildOutputDir, 'workers/default/assets')
  let config
  try {
    config = JSON.parse(await readFile(configPath, 'utf8'))
  } catch {
    throw new Error('DPG_ADMIN_WORKER_CONFIG_MISSING_OR_INVALID')
  }
  const bindings = config.env ?? {}
  const textBinding = (name) => bindings[name]?.type === 'text' ? bindings[name].value : null
  const publishableKey = textBinding('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')

  if (
    config.name !== WORKER_NAME ||
    config.workersDev !== true ||
    config.previewUrls !== false ||
    !Array.isArray(config.domains) || config.domains.length !== 0 ||
    config.cache?.enabled !== false ||
    config.observability?.enabled !== false ||
    config.manifest?.mainModule !== 'index.js' ||
    textBinding('APP_ENV') !== 'preview' ||
    textBinding('APP_BUILD_TARGET') !== 'admin' ||
    textBinding('APP_ORIGIN') !== WORKER_ORIGIN ||
    textBinding('PREVIEW_NOINDEX') !== 'true' ||
    textBinding('BUILD_SOURCE_SHA') !== sourceSha ||
    textBinding('NEXT_PUBLIC_SUPABASE_URL') !== SUPABASE_URL ||
    !publishableKey?.startsWith('sb_publishable_') ||
    Object.keys(bindings).some((name) => /secret|password|service_role|database_url/i.test(name)) ||
    Object.values(bindings).some((binding) => binding?.type === 'secret')
  ) throw new Error('DPG_ADMIN_WORKER_PREVIEW_CONFIG_INVALID')

  const [entry, digest] = await Promise.all([
    readFile(workerEntry).catch(() => null),
    digestDirectory(buildOutputDir),
  ])
  if (!entry?.byteLength) throw new Error('DPG_ADMIN_WORKER_ENTRY_MISSING')
  try {
    const assets = await readdir(assetRoot)
    if (assets.length === 0) throw new Error('DPG_ADMIN_WORKER_ASSETS_EMPTY')
  } catch {
    throw new Error('DPG_ADMIN_WORKER_ASSETS_MISSING')
  }

  return Object.freeze({
    contract: CONTRACT,
    sourceCommit: sourceSha,
    workerName: WORKER_NAME,
    workerOrigin: WORKER_ORIGIN,
    supabaseProjectRef: 'uybumsnyqpwcidjxmfsv',
    publicKeySha256: sha256(publishableKey),
    deploymentPosture: {
      workersDev: true,
      previewUrls: false,
      customDomains: [],
      noindex: true,
      cache: false,
      observability: false,
    },
    buildOutput: digest,
  })
}

export async function verifyAdminWorkerArtifactEvidence({ buildOutputDir, evidencePath, sourceSha }) {
  const expected = await createAdminWorkerArtifactEvidence({ buildOutputDir, sourceSha })
  let recorded
  try {
    recorded = JSON.parse(await readFile(evidencePath, 'utf8'))
  } catch {
    throw new Error('DPG_ADMIN_WORKER_EVIDENCE_MISSING_OR_INVALID')
  }
  if (JSON.stringify(recorded) !== JSON.stringify(expected)) {
    throw new Error('DPG_ADMIN_WORKER_ARTIFACT_IDENTITY_MISMATCH')
  }
  return expected
}

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith('--') || !value || value.startsWith('--')) throw new Error('DPG_ADMIN_WORKER_ARGUMENT_INVALID')
    args[key.slice(2)] = value
    index += 1
  }
  if (!['capture', 'verify'].includes(args.mode)) throw new Error('DPG_ADMIN_WORKER_MODE_INVALID')
  if (!args['build-output'] || !args.evidence || !SOURCE_SHA_PATTERN.test(args['source-sha'] ?? '')) {
    throw new Error('DPG_ADMIN_WORKER_ARGUMENTS_REQUIRED')
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const input = {
    buildOutputDir: path.resolve(args['build-output']),
    evidencePath: path.resolve(args.evidence),
    sourceSha: args['source-sha'],
  }
  if (args.mode === 'capture') {
    const evidence = await createAdminWorkerArtifactEvidence(input)
    await writeFile(input.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
    process.stdout.write(`${JSON.stringify({ status: 'ADMIN_WORKER_ARTIFACT_RECORDED', artifactSha256: evidence.buildOutput.sha256 })}\n`)
    return
  }
  const evidence = await verifyAdminWorkerArtifactEvidence(input)
  process.stdout.write(`${JSON.stringify({ status: 'ADMIN_WORKER_ARTIFACT_VERIFIED', artifactSha256: evidence.buildOutput.sha256 })}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'DPG_ADMIN_WORKER_ARTIFACT_FAILED')
    process.exitCode = 1
  })
}
