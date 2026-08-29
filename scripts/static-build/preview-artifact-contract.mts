import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const PREVIEW_ARTIFACT_CONTRACT = 'dongphugia:static-preview-candidate:v1'
export const PREVIEW_FILE_LIMIT = 20_000
export const PREVIEW_MAX_FILE_BYTES = 25 * 1024 * 1024

type ArtifactInventory = {
  fileCount: number
  totalBytes: number
  largestFile: { path: string; bytes: number }
}

type CandidateEvidenceInput = {
  output: string
  evidencePath: string
  sourceCommit: string
  prNumber: string
  workflowRunId: string
  migrationManifestPath?: string
}

type ShadowCandidateContract = {
  contract: string
  environment: string
  supabase: { project: string; ref: string; region: string; schema: string; migrationManifest: string }
  sideEffects: { staticBuildSource: string; productionWritesAllowed: boolean; syntheticWrites: string }
  runtime: { functions: string[]; auth: string }
  rollback: { productionAuthority: string; trafficOrWriteTargetChange: string }
  exclusions: string[]
}

async function listFiles(root: string) {
  const files: string[] = []
  const walk = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) await walk(target)
      else files.push(target)
    }
  }
  await walk(root)
  return files.sort((a, b) => path.relative(root, a).localeCompare(path.relative(root, b)))
}

async function inventory(root: string, files: string[]): Promise<ArtifactInventory> {
  const entries = await Promise.all(files.map(async (file) => ({
    path: path.relative(root, file),
    bytes: (await stat(file)).size,
  })))
  entries.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path))
  return {
    fileCount: entries.length,
    totalBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
    largestFile: entries[0] ?? { path: '', bytes: 0 },
  }
}

export async function hashArtifact(root: string, files?: string[]) {
  const filesToHash = files ?? await listFiles(root)
  const hash = createHash('sha256')
  for (const file of filesToHash) {
    hash.update(path.relative(root, file))
    hash.update('\0')
    hash.update(await readFile(file))
    hash.update('\0')
  }
  return hash.digest('hex')
}

export async function assertPreviewArtifact(output: string) {
  const root = path.resolve(output)
  const files = await listFiles(root)
  const report = JSON.parse(await readFile(path.join(root, 'static-build-report.json'), 'utf8')) as {
    contract?: string
    mode?: string
    routes?: { products?: number; blogPosts?: number }
    seo?: { bunnyMediaPreserved?: boolean }
    ui?: { renderer?: string; stylesheet?: string; publicAssetsCopied?: boolean }
  }
  if (report.mode !== 'preview') throw new Error('PREVIEW_ARTIFACT_MODE_FAILED')
  if (report.routes?.products !== 4_033) throw new Error('PREVIEW_ARTIFACT_PRODUCT_COUNT_FAILED')
  if (!report.routes?.blogPosts || report.routes.blogPosts < 1) throw new Error('PREVIEW_ARTIFACT_BLOG_PRESERVATION_FAILED')
  if (report.seo?.bunnyMediaPreserved !== true) throw new Error('PREVIEW_ARTIFACT_BUNNY_PRESERVATION_FAILED')
  if (report.ui?.renderer !== 'current-ui-static-adapter:v1' || report.ui.publicAssetsCopied !== true || report.ui.stylesheet !== '/assets/static-ui.css') {
    throw new Error('PREVIEW_ARTIFACT_UI_REPORT_FAILED')
  }
  const stylesheetPath = path.join(root, report.ui.stylesheet.slice(1))
  const stylesheet = await readFile(stylesheetPath, 'utf8').catch(() => null)
  if (!stylesheet?.includes('.dpg-static-header')) throw new Error('PREVIEW_ARTIFACT_STYLESHEET_FAILED')
  await stat(path.join(root, 'images', 'Logo.png')).catch(() => { throw new Error('PREVIEW_ARTIFACT_PUBLIC_ASSET_FAILED') })

  const checkedInventory = await inventory(root, files)
  if (checkedInventory.fileCount > PREVIEW_FILE_LIMIT) throw new Error('PREVIEW_ARTIFACT_FILE_LIMIT_FAILED')
  if (checkedInventory.largestFile.bytes > PREVIEW_MAX_FILE_BYTES) throw new Error('PREVIEW_ARTIFACT_MAX_FILE_FAILED')

  const robots = await readFile(path.join(root, 'robots.txt'), 'utf8')
  if (!/^User-agent: \*\nDisallow: \/\s*$/m.test(robots)) throw new Error('PREVIEW_ARTIFACT_ROBOTS_FAILED')
  const headers = await readFile(path.join(root, '_headers'), 'utf8')
  if (!/X-Robots-Tag:\s*noindex, nofollow/i.test(headers)) throw new Error('PREVIEW_ARTIFACT_HEADERS_FAILED')

  const htmlFiles = files.filter((file) => file.endsWith('.html'))
  if (htmlFiles.length === 0) throw new Error('PREVIEW_ARTIFACT_HTML_FAILED')
  const layoutMarkers = new Set<string>()
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8')
    if (!/<meta\s+name="robots"\s+content="noindex,nofollow"\s*\/?/i.test(html)) {
      throw new Error(`PREVIEW_ARTIFACT_NOINDEX_FAILED: ${path.relative(root, file)}`)
    }
    if (!html.includes('data-static-ui="application-shell"') || !html.includes('data-static-ui="header"') || !html.includes('data-static-ui="footer"') || !html.includes('data-static-ui-asset="stylesheet"')) {
      throw new Error(`PREVIEW_ARTIFACT_UI_LAYOUT_FAILED: ${path.relative(root, file)}`)
    }
    for (const marker of ['homepage-hero', 'category-listing', 'subcategory-listing', 'product-detail', 'brand-listing', 'blog-listing', 'blog-article']) {
      if (html.includes(`data-static-ui="${marker}"`)) layoutMarkers.add(marker)
    }
  }
  const requiredLayoutMarkers = ['homepage-hero', 'category-listing', 'subcategory-listing', 'product-detail', 'brand-listing', 'blog-listing', 'blog-article']
  if (requiredLayoutMarkers.some((marker) => !layoutMarkers.has(marker))) throw new Error('PREVIEW_ARTIFACT_REPRESENTATIVE_UI_FAILED')
  if (!/@media\s*\(/.test(stylesheet)) throw new Error('PREVIEW_ARTIFACT_RESPONSIVE_STYLES_FAILED')
  const bunnyMediaReferenced = (await Promise.all(htmlFiles.map(async (file) => (await readFile(file, 'utf8')).includes('https://cdn.dongphugia.com.vn/')))).some(Boolean)
  if (!bunnyMediaReferenced) throw new Error('PREVIEW_ARTIFACT_BUNNY_REFERENCE_FAILED')

  return {
    contract: report.contract ?? 'dongphugia:public-static-build:v1',
    inventory: checkedInventory,
    htmlFiles: htmlFiles.length,
    noindex: { htmlMeta: true, headers: true, robots: true },
    blog: { staticPosts: report.routes.blogPosts },
    media: { bunnyMediaPreserved: true, bunnyMediaReferenced: true },
    ui: { stylesheet: true, publicAssets: true, applicationShell: true, responsive: true, representativeMarkers: [...layoutMarkers].sort() },
  }
}

export async function writeCandidateEvidence(input: CandidateEvidenceInput) {
  const output = path.resolve(input.output)
  const contract = await assertPreviewArtifact(output)
  const files = await listFiles(output)
  const artifactSha256 = await hashArtifact(output, files)
  const migrationManifestPath = input.migrationManifestPath
    ? path.resolve(input.migrationManifestPath)
    : path.resolve(process.cwd(), 'db/postgres-migrations/checksums.sha256')
  const migrationManifestSha256 = await readFile(migrationManifestPath)
    .then((value) => createHash('sha256').update(value).digest('hex'))
    .catch(() => null)
  const shadowContractPath = path.resolve(process.cwd(), 'docs/deploy/leo-545-shadow-candidate-contract.json')
  const shadowContractBytes = await readFile(shadowContractPath)
  const shadow = JSON.parse(shadowContractBytes.toString('utf8')) as ShadowCandidateContract
  if (shadow.contract !== 'dongphugia:shadow-candidate:v1' || shadow.environment !== 'preview' || shadow.supabase.project !== 'dongphugia-runtime' || shadow.sideEffects.staticBuildSource !== 'read-only-non-production' || shadow.sideEffects.productionWritesAllowed !== false || shadow.runtime.functions.length === 0) {
    throw new Error('SHADOW_CANDIDATE_CONTRACT_FAILED')
  }
  const evidence = {
    contract: PREVIEW_ARTIFACT_CONTRACT,
    candidate: {
      sourceCommit: input.sourceCommit,
      pullRequest: Number(input.prNumber),
      workflowRunId: input.workflowRunId,
      artifactSha256,
      migrationManifestSha256,
      shadowContractSha256: createHash('sha256').update(shadowContractBytes).digest('hex'),
    },
    artifact: { contract: contract.contract, mode: 'preview', ...contract.inventory, htmlFiles: contract.htmlFiles, blog: contract.blog, media: contract.media, ui: contract.ui },
    noindex: contract.noindex,
    shadow,
  }
  await mkdir(path.dirname(path.resolve(input.evidencePath)), { recursive: true })
  await writeFile(path.resolve(input.evidencePath), `${JSON.stringify(evidence, null, 2)}\n`)
  return evidence
}

function cliValue(name: string) {
  const index = process.argv.indexOf(`--${name}`)
  const value = process.argv[index + 1]
  if (index === -1 || !value) throw new Error(`PREVIEW_ARTIFACT_ARGUMENT_FAILED: --${name}`)
  return value
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const evidence = await writeCandidateEvidence({
    output: cliValue('output'),
    evidencePath: cliValue('evidence'),
    sourceCommit: cliValue('source-commit'),
    prNumber: cliValue('pr-number'),
    workflowRunId: cliValue('workflow-run-id'),
  })
  process.stdout.write(`${JSON.stringify(evidence)}\n`)
}
