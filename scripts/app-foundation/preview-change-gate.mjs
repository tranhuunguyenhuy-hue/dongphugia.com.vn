import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const APPLICATION_SOURCE_PREFIXES = {
  // The Cloudflare storefront reuses legacy Public components and assets.
  // Excluding src/ or public/ silently misses changes to the shipped UI.
  public: ['apps/public/', 'src/', 'public/'],
  admin: ['apps/admin/'],
  shared: ['packages/app-contracts/'],
}

const SHARED_BUILD_FILES = new Set([
  '.github/workflows/migration-preview.yml',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'next.config.ts',
  'next.config.mjs',
  'postcss.config.mjs',
])

const ARTIFACT_FOUNDATION_PREFIX = 'scripts/app-foundation/'
const CATALOGUE_BUILD_PREFIX = 'scripts/catalogue-direct/'

// Only data/auth/commerce/CI-control changes pay for a second, database-backed
// test pass. Every source change still goes through npm test in quality.yml.
const INTEGRATION_PATH_PREFIXES = [
  'db/', 'prisma/', 'supabase/', 'scripts/db/', 'scripts/migration/',
  'scripts/backup/', 'src/app/api/', 'src/lib/auth', 'src/lib/checkout',
  'src/lib/order', 'src/lib/prisma', 'apps/admin/src/supabase/',
  'apps/admin/src/auth/', 'apps/admin/app/api/',
]
const INTEGRATION_EXACT_FILES = new Set([
  '.github/workflows/migration-preview.yml',
  '.github/workflows/quality.yml',
  'scripts/app-foundation/preview-change-gate.mjs',
])
const B11_PREFIXES = [
  'scripts/backup/b11_', 'scripts/backup/test_b11_',
  'scripts/backup/fixtures/b11-', '.github/workflows/b11-',
]

export function requiresIntegrationChecks(path) {
  const normalized = path.replaceAll('\\', '/')
  return INTEGRATION_EXACT_FILES.has(normalized) ||
    INTEGRATION_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

export function requiresB11Checks(path) {
  const normalized = path.replaceAll('\\', '/')
  return normalized === '.github/workflows/migration-preview.yml' ||
    B11_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

function isTestOrDocumentationPath(path) {
  const normalized = path.replaceAll('\\', '/')
  return (
    normalized.endsWith('.md') ||
    normalized.endsWith('.test.ts') ||
    normalized.endsWith('.test.tsx') ||
    normalized.endsWith('.test.mts') ||
    normalized.endsWith('.test.mjs') ||
    normalized.includes('/__tests__/')
  )
}

export function isMaterialApplicationPath(path) {
  const normalized = path.replaceAll('\\', '/')
  if (SHARED_BUILD_FILES.has(normalized)) return true
  if (normalized.startsWith(ARTIFACT_FOUNDATION_PREFIX) && !isTestOrDocumentationPath(normalized)) return true
  if (normalized.startsWith(CATALOGUE_BUILD_PREFIX) && !isTestOrDocumentationPath(normalized)) return true
  if (isTestOrDocumentationPath(normalized)) return false

  return Object.values(APPLICATION_SOURCE_PREFIXES)
    .flat()
    .some((prefix) => normalized.startsWith(prefix))
}

export function classifyChangedPaths(paths) {
  const materialPaths = paths.filter(isMaterialApplicationPath)
  const sharedChanged = materialPaths.some((path) =>
    APPLICATION_SOURCE_PREFIXES.shared.some((prefix) => path.startsWith(prefix)),
  )
  const rootBuildChanged = materialPaths.some((path) => SHARED_BUILD_FILES.has(path))
  const artifactFoundationChanged = materialPaths.some((path) =>
    path.startsWith(ARTIFACT_FOUNDATION_PREFIX) || path.startsWith(CATALOGUE_BUILD_PREFIX),
  )
  const publicChanged =
    rootBuildChanged ||
    artifactFoundationChanged ||
    sharedChanged ||
    materialPaths.some((path) =>
      APPLICATION_SOURCE_PREFIXES.public.some((prefix) => path.startsWith(prefix)),
    )
  const adminChanged =
    rootBuildChanged ||
    artifactFoundationChanged ||
    sharedChanged ||
    materialPaths.some((path) =>
      APPLICATION_SOURCE_PREFIXES.admin.some((prefix) => path.startsWith(prefix)),
    )

  const previewRequired = publicChanged || adminChanged
  const integrationRequired = paths.some(requiresIntegrationChecks)
  const b11Required = paths.some(requiresB11Checks)
  return {
    materialPaths, publicChanged, adminChanged, previewRequired,
    integrationRequired, b11Required,
    ciRequired: previewRequired || integrationRequired || b11Required,
  }
}

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument.startsWith('--')) continue
    const key = argument.slice(2)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`)
    args[key] = value
    index += 1
  }
  return args
}

function requireSha(value, name) {
  if (!/^[0-9a-f]{40}$/.test(value || '')) {
    throw new Error(`${name} must be a 40-character lowercase commit SHA`)
  }
  return value
}

export function readChangedPaths(baseSha, headSha) {
  requireSha(baseSha, 'base SHA')
  requireSha(headSha, 'head SHA')
  return execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACDMRT', '-z', baseSha, headSha],
    { encoding: 'utf8' },
  ).split('\0').filter(Boolean)
}

function writeOutputs(outputs) {
  const content = `${Object.entries(outputs).map(([key, value]) => `${key}=${value}`).join('\n')}\n`
  process.stdout.write(content)
}

export function runPreviewChangeGate({ baseSha, headSha, outputPath }) {
  const changedPaths = readChangedPaths(baseSha, headSha)
  const result = classifyChangedPaths(changedPaths)
  const outputs = {
    source_sha: headSha,
    public_changed: String(result.publicChanged),
    admin_changed: String(result.adminChanged),
    preview_required: String(result.previewRequired),
    integration_required: String(result.integrationRequired),
    b11_required: String(result.b11Required),
    ci_required: String(result.ciRequired),
  }

  if (outputPath) {
    appendFileSync(outputPath, `${Object.entries(outputs).map(([key, value]) => `${key}=${value}`).join('\n')}\n`)
  } else {
    writeOutputs(outputs)
  }

  process.stderr.write(
    `LEO563_REPO_CODE_GATE material_paths=${result.materialPaths.length} preview_required=${result.previewRequired}\n`,
  )
  return { ...result, outputs }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const baseSha = requireSha(args.base, 'base SHA')
  const headSha = requireSha(args.head, 'head SHA')
  runPreviewChangeGate({ baseSha, headSha, outputPath: args.output })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`LEO563_REPO_CODE_GATE_FAILED: ${error.message}`)
    process.exitCode = 1
  })
}
