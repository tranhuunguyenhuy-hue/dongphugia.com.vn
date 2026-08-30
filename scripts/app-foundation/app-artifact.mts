import { createHash } from 'node:crypto'
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  APPLICATIONS,
  APPLICATION_CONTRACT_VERSION,
  type ApplicationName,
} from '../../packages/app-contracts/src/index'

type ArtifactOptions = Readonly<{
  application: ApplicationName
  buildDir: string
  artifactRoot: string
  sourceCommit: string
  buildTarget: string
  previewNoindex: boolean
}>

type ArtifactManifest = Readonly<{
  contract: 'dongphugia:app-artifact:v1'
  application: ApplicationName
  authority: string
  runtime: string
  sourceCommit: string
  buildTarget: string
  preview: {
    mode: 'preview'
    noindex: {
      htmlMeta: boolean
      headers: boolean
      robots: boolean
    }
  }
  payload: { fileCount: number; totalBytes: number }
  artifactSha256: string
}>

const ARTIFACT_MANIFEST_NAME = 'artifact-manifest.json'
const CANDIDATE_EVIDENCE_NAME = 'candidate-evidence.json'
const EXPECTED_BUILD_TARGETS: Record<ApplicationName, string> = {
  public: 'public-worker-static-assets',
  admin: 'admin-independent-private-runtime',
}
const NON_DEPLOYABLE_BUILD_ENTRIES = new Set([
  'build',
  'cache',
  'diagnostics',
  'required-server-files.js',
  'required-server-files.json',
  'trace',
  'trace-build',
  'turbopack',
  'types',
])

function toPosix(relativePath: string) {
  return relativePath.split(path.sep).join('/')
}

function shouldSkipBuildEntry(relativePath: string) {
  const normalized = toPosix(relativePath)
  return NON_DEPLOYABLE_BUILD_ENTRIES.has(normalized.split('/')[0])
}

function shouldSkipArtifactEntry(relativePath: string) {
  const normalized = toPosix(relativePath)
  if (!normalized.startsWith('build/')) return false
  return shouldSkipBuildEntry(normalized.slice('build/'.length))
}

async function listFiles(root: string, relative = ''): Promise<string[]> {
  const directory = path.join(root, relative)
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const entryRelative = path.join(relative, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listFiles(root, entryRelative))
    } else if (entry.isFile()) {
      files.push(entryRelative)
    }
  }

  return files
}

async function copyTree(source: string, destination: string, relative = '') {
  const sourceDirectory = path.join(source, relative)
  const entries = await readdir(sourceDirectory, { withFileTypes: true })

  for (const entry of entries) {
    const entryRelative = path.join(relative, entry.name)
    if (shouldSkipBuildEntry(entryRelative)) continue

    const sourcePath = path.join(source, entryRelative)
    const destinationPath = path.join(destination, entryRelative)
    if (entry.isDirectory()) {
      await mkdir(destinationPath, { recursive: true })
      await copyTree(source, destination, entryRelative)
    } else if (entry.isFile()) {
      await mkdir(path.dirname(destinationPath), { recursive: true })
      await copyFile(sourcePath, destinationPath)
    }
  }
}

async function digestPayload(
  root: string,
  identity: Pick<ArtifactOptions, 'application' | 'sourceCommit' | 'buildTarget'>,
) {
  const files = (await listFiles(root))
    .filter(
      (file) =>
        file !== ARTIFACT_MANIFEST_NAME &&
        file !== CANDIDATE_EVIDENCE_NAME &&
        !shouldSkipArtifactEntry(file),
    )
    .sort((left, right) => toPosix(left).localeCompare(toPosix(right)))
  const hash = createHash('sha256')
  hash.update(`${APPLICATION_CONTRACT_VERSION}\0${identity.application}\0${identity.sourceCommit}\0${identity.buildTarget}\0`)

  let totalBytes = 0
  for (const file of files) {
    const content = await readFile(path.join(root, file))
    totalBytes += content.byteLength
    hash.update(`${toPosix(file)}\0`)
    hash.update(content)
    hash.update('\0')
  }

  return {
    artifactSha256: hash.digest('hex'),
    fileCount: files.length,
    totalBytes,
  }
}

function assertSafeOutputPath(outputPath: string) {
  const resolved = path.resolve(outputPath)
  if (resolved === path.parse(resolved).root || resolved === process.cwd()) {
    throw new Error('ARTIFACT_OUTPUT_PATH_TOO_BROAD')
  }
}

function assertArtifactsDoNotOverlap(buildDir: string, artifactRoot: string) {
  const resolvedBuildDir = path.resolve(buildDir)
  const resolvedArtifactRoot = path.resolve(artifactRoot)
  const isSameOrDescendant = (parent: string, candidate: string) =>
    candidate === parent || candidate.startsWith(`${parent}${path.sep}`)

  if (
    isSameOrDescendant(resolvedBuildDir, resolvedArtifactRoot) ||
    isSameOrDescendant(resolvedArtifactRoot, resolvedBuildDir)
  ) {
    throw new Error('ARTIFACT_BUILD_OUTPUT_OVERLAP')
  }
}

export async function collectAppArtifact(options: ArtifactOptions): Promise<ArtifactManifest> {
  if (!/^[0-9a-f]{40}$/.test(options.sourceCommit)) {
    throw new Error('ARTIFACT_SOURCE_COMMIT_INVALID')
  }
  if (!options.previewNoindex) throw new Error('ARTIFACT_PREVIEW_NOINDEX_REQUIRED')
  if (!Object.hasOwn(APPLICATIONS, options.application)) throw new Error('ARTIFACT_APPLICATION_INVALID')
  if (options.buildTarget !== EXPECTED_BUILD_TARGETS[options.application]) {
    throw new Error('ARTIFACT_BUILD_TARGET_MISMATCH')
  }

  const buildStats = await stat(options.buildDir).catch(() => null)
  if (!buildStats?.isDirectory()) throw new Error('ARTIFACT_BUILD_OUTPUT_MISSING')
  assertSafeOutputPath(options.artifactRoot)
  assertArtifactsDoNotOverlap(options.buildDir, options.artifactRoot)

  await rm(options.artifactRoot, { recursive: true, force: true })
  await mkdir(path.join(options.artifactRoot, 'build'), { recursive: true })
  await copyTree(options.buildDir, path.join(options.artifactRoot, 'build'))

  const application = APPLICATIONS[options.application]
  const payload = await digestPayload(options.artifactRoot, options)
  const manifest: ArtifactManifest = {
    contract: 'dongphugia:app-artifact:v1',
    application: options.application,
    authority: application.authority,
    runtime: application.runtime,
    sourceCommit: options.sourceCommit,
    buildTarget: options.buildTarget,
    preview: {
      mode: 'preview',
      noindex: {
        htmlMeta: true,
        headers: true,
        robots: true,
      },
    },
    payload: {
      fileCount: payload.fileCount,
      totalBytes: payload.totalBytes,
    },
    artifactSha256: payload.artifactSha256,
  }

  await writeFile(
    path.join(options.artifactRoot, ARTIFACT_MANIFEST_NAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  )
  return manifest
}

export async function recomputeAppArtifactDigest(
  artifactRoot: string,
  manifest: Pick<ArtifactManifest, 'application' | 'sourceCommit' | 'buildTarget'>,
) {
  return digestPayload(artifactRoot, manifest)
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument?.startsWith('--')) continue
    const key = argument.slice(2)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`)
    args[key] = value
    index += 1
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const application = args.application as ApplicationName
  const manifest = await collectAppArtifact({
    application,
    buildDir: path.resolve(args['build-dir'] || ''),
    artifactRoot: path.resolve(args['artifact-root'] || ''),
    sourceCommit: args['source-sha'] || '',
    buildTarget: args['build-target'] || '',
    previewNoindex: args.preview === 'true',
  })
  process.stdout.write(`${JSON.stringify(manifest)}\n`)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(`LEO563_ARTIFACT_FAILED: ${error.message}`)
    process.exitCode = 1
  })
}

export type { ArtifactManifest }
export {
  ARTIFACT_MANIFEST_NAME,
  CANDIDATE_EVIDENCE_NAME,
  EXPECTED_BUILD_TARGETS,
  digestPayload,
}
