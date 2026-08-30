import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const APPLICATION_SOURCE_PREFIXES = {
  public: ['apps/public/'],
  admin: ['apps/admin/'],
  shared: ['packages/app-contracts/'],
}

const SHARED_BUILD_FILES = new Set([
  'package.json',
  'package-lock.json',
  'tsconfig.json',
])

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
  const publicChanged =
    rootBuildChanged ||
    sharedChanged ||
    materialPaths.some((path) =>
      APPLICATION_SOURCE_PREFIXES.public.some((prefix) => path.startsWith(prefix)),
    )
  const adminChanged =
    rootBuildChanged ||
    sharedChanged ||
    materialPaths.some((path) =>
      APPLICATION_SOURCE_PREFIXES.admin.some((prefix) => path.startsWith(prefix)),
    )

  return {
    materialPaths,
    publicChanged,
    adminChanged,
    previewRequired: publicChanged || adminChanged,
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
