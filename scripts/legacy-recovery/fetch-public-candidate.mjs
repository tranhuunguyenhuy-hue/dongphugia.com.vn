import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  expectedPublicAssetPaths,
  readVerifiedBundle,
  sha256,
  validateCandidateManifest,
} from './public-source-contract.mjs'

const ORIGIN = 'https://www.dongphugia.vn'
const USER_AGENT = 'DongPhuGia-Public-Snapshot-Recovery/1.0'
const MAX_ASSET_BYTES = 2_000_000
const MAX_TOTAL_BYTES = 250_000_000
const CONCURRENCY = 4

function allowedAssetPath(path) {
  return path === 'manifest.json'
    || /^products\/[a-f0-9]{2}\.json$/.test(path)
    || /^listings\/[a-z0-9-]+\/[a-z0-9-]+\/[1-9][0-9]{0,3}\.json$/.test(path)
    || /^search\/[0-3]\.json$/.test(path)
}

export async function fetchBoundedPublicJson(path, fetchImpl = fetch) {
  if (!allowedAssetPath(path)) throw new Error('PUBLIC_ASSET_PATH_FORBIDDEN')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const url = new URL(`/__catalogue/v1/${path}`, ORIGIN)
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache', 'User-Agent': USER_AGENT },
      credentials: 'omit',
      redirect: 'manual',
      cache: 'no-store',
      signal: controller.signal,
    })
    const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
    const contentLength = Number(response.headers.get('content-length') ?? 0)
    if (response.status !== 200 || contentType !== 'application/json'
      || response.headers.has('set-cookie') || contentLength > MAX_ASSET_BYTES || !response.body) {
      throw new Error(`PUBLIC_ASSET_RESPONSE_REJECTED:${path}`)
    }
    const reader = response.body.getReader()
    const chunks = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_ASSET_BYTES) {
        await reader.cancel()
        throw new Error(`PUBLIC_ASSET_TOO_LARGE:${path}`)
      }
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks, size)
  } finally {
    clearTimeout(timer)
  }
}

async function capture(output) {
  const lock = JSON.parse(await readFile(new URL('./public-source-candidate-lock.proposed.json', import.meta.url), 'utf8'))
  if (lock.proposalState !== 'PROPOSED_REVIEW_REQUIRED' || lock.origin !== ORIGIN) {
    throw new Error('PUBLIC_SOURCE_PROPOSAL_REQUIRED')
  }
  const target = resolve(output)
  const relativeTarget = relative(process.cwd(), target)
  if (!isAbsolute(output) || relativeTarget === '' || (!relativeTarget.startsWith(`..${sep}`) && relativeTarget !== '..')) {
    throw new Error('PUBLIC_CAPTURE_OUTPUT_MUST_BE_OUTSIDE_CHECKOUT')
  }
  await mkdir(target, { recursive: false, mode: 0o700 })

  const manifestBytes = await fetchBoundedPublicJson('manifest.json')
  if (sha256(manifestBytes) !== lock.manifest.sha256) throw new Error('PUBLIC_MANIFEST_DIGEST_MISMATCH')
  const manifest = JSON.parse(manifestBytes)
  const paths = validateCandidateManifest(manifest, lock)
  if (expectedPublicAssetPaths(manifest).length !== paths.length) throw new Error('PUBLIC_ASSET_SET_MISMATCH')
  const manifestDestination = join(target, 'manifest.json')
  await writeFile(manifestDestination, manifestBytes, { flag: 'wx', mode: 0o600 })

  let cursor = 1
  let totalBytes = manifestBytes.length
  let captured = 0
  const worker = async () => {
    while (cursor < paths.length) {
      const path = paths[cursor++]
      const bytes = await fetchBoundedPublicJson(path)
      if (sha256(bytes) !== lock.assets[path]) throw new Error(`PUBLIC_ASSET_DIGEST_MISMATCH:${path}`)
      totalBytes += bytes.length
      if (totalBytes > MAX_TOTAL_BYTES) throw new Error('PUBLIC_CAPTURE_TOTAL_LIMIT')
      const destination = join(target, path)
      await mkdir(dirname(destination), { recursive: true, mode: 0o700 })
      await writeFile(destination, bytes, { flag: 'wx', mode: 0o600 })
      captured++
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  const bundle = await readVerifiedBundle(target, lock)
  const report = {
    contract: 'dpg:legacy-admin-public-capture-report:v1',
    status: 'PASS',
    sourceIdentity: lock.identity,
    manifestSha256: lock.manifest.sha256,
    assets: paths.length,
    capturedDataAssets: captured,
    products: bundle.products.length,
    uniqueProductIds: bundle.productIds.size,
    listingProducts: bundle.listingCount,
    searchProducts: bundle.searchCount,
    sitemapProducts: bundle.sitemapIds.size,
    categories: manifest.categories.length,
    listings: manifest.categories.reduce((total, category) => total + category.listings.length, 0),
    verifiedBytes: totalBytes,
    mediaBytesVerified: false,
    sourceLockState: lock.proposalState,
  }
  await writeFile(join(target, 'capture-summary.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
  process.stdout.write(`${JSON.stringify(report)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const output = process.argv[2]
  if (!output) {
    process.stderr.write('Usage: node scripts/legacy-recovery/fetch-public-candidate.mjs /absolute/path/outside/checkout\n')
    process.exitCode = 2
  } else {
    capture(output).catch((error) => {
      const message = error instanceof Error ? error.message : 'UNKNOWN'
      process.stderr.write(`${JSON.stringify({ status: 'STOP', reason: message })}\n`)
      process.exitCode = 1
    })
  }
}
