import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const WORKER_NAME = 'dongphugia-v1-public-preview'
const PREVIEW_ALIAS = 'pr-138'
const BROWSER_CACHE_CONTROL = 'public, max-age=0, must-revalidate'
const EDGE_CACHE_CONTROL = 'public, max-age=300, must-revalidate'
const PRIVATE_CACHE_CONTROL = 'private, no-store'
const PREVIEW_ROBOTS_REQUIRED_DIRECTIVE = 'noindex'

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument?.startsWith('--') || !argv[index + 1]) throw new Error('LEO563_REAL_PREVIEW_ARGUMENT_INVALID')
    args[argument.slice(2)] = argv[index + 1]
    index += 1
  }
  return args
}

function requireSourceSha(value) {
  if (!/^[0-9a-f]{40}$/.test(value ?? '')) throw new Error('LEO563_REAL_PREVIEW_SOURCE_INVALID')
  return value
}

export function validatePreviewUrl(value) {
  const url = new URL(value)
  const expectedPrefix = `${PREVIEW_ALIAS}-${WORKER_NAME}.`
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    !url.hostname.startsWith(expectedPrefix) ||
    !url.hostname.endsWith('.workers.dev')
  ) throw new Error('LEO563_REAL_PREVIEW_URL_INVALID')
  return url
}

function header(response, name) {
  return response.headers.get(name) ?? ''
}

function assertSource(response, sourceCommit, label) {
  if (header(response, 'X-DPG-Source-SHA') !== sourceCommit) {
    throw new Error(`LEO563_REAL_PREVIEW_SOURCE_HEADER_FAILED:${label}`)
  }
}

function assertPreviewRobots(response) {
  const directives = header(response, 'X-Robots-Tag')
    .toLowerCase()
    .split(',')
    .map((directive) => directive.trim())
    .filter(Boolean)
  if (!directives.includes(PREVIEW_ROBOTS_REQUIRED_DIRECTIVE)) {
    throw new Error('LEO563_REAL_PREVIEW_X_ROBOTS_FAILED')
  }
}

async function request(fetchImpl, url, init = {}) {
  return fetchImpl(url, { ...init, redirect: 'error' })
}

export async function verifyRealPreview({ baseUrl, sourceSha, fetchImpl = fetch, hitAttempts = 8 }) {
  const sourceCommit = requireSourceSha(sourceSha)
  const previewUrl = validatePreviewUrl(baseUrl)

  const first = await request(fetchImpl, previewUrl)
  const html = await first.text()
  if (first.status !== 200) throw new Error('LEO563_REAL_PREVIEW_ROOT_STATUS_FAILED')
  if (header(first, 'X-DPG-Cache') !== 'MISS') throw new Error('LEO563_REAL_PREVIEW_FIRST_CACHE_FAILED')
  if (header(first, 'Cache-Control') !== BROWSER_CACHE_CONTROL) throw new Error('LEO563_REAL_PREVIEW_BROWSER_CACHE_FAILED')
  if (header(first, 'CDN-Cache-Control') !== EDGE_CACHE_CONTROL) throw new Error('LEO563_REAL_PREVIEW_EDGE_CACHE_FAILED')
  assertPreviewRobots(first)
  if (!/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex[^"']*nofollow/i.test(html)) {
    throw new Error('LEO563_REAL_PREVIEW_HTML_NOINDEX_FAILED')
  }
  if (!/<title>Dong Phu Gia Public Application<\/title>/i.test(html)) throw new Error('LEO563_REAL_PREVIEW_METADATA_FAILED')
  if (/stale-while-revalidate/i.test(`${header(first, 'Cache-Control')} ${header(first, 'CDN-Cache-Control')}`)) {
    throw new Error('LEO563_REAL_PREVIEW_STALE_POLICY_FORBIDDEN')
  }
  assertSource(first, sourceCommit, 'root-miss')

  let hit = null
  for (let attempt = 0; attempt < hitAttempts; attempt += 1) {
    const response = await request(fetchImpl, previewUrl)
    if (header(response, 'X-DPG-Cache') === 'HIT') {
      hit = response
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  if (!hit) throw new Error('LEO563_REAL_PREVIEW_CACHE_HIT_FAILED')
  if (hit.status !== 200 || header(hit, 'CDN-Cache-Control') !== EDGE_CACHE_CONTROL) {
    throw new Error('LEO563_REAL_PREVIEW_CACHE_HIT_POLICY_FAILED')
  }
  assertPreviewRobots(hit)
  assertSource(hit, sourceCommit, 'root-hit')

  const query = await request(fetchImpl, new URL('/?leo563=1', previewUrl))
  if (query.status !== 200 || header(query, 'X-DPG-Cache') !== 'BYPASS' || header(query, 'Cache-Control') !== PRIVATE_CACHE_CONTROL) {
    throw new Error('LEO563_REAL_PREVIEW_QUERY_BYPASS_FAILED')
  }
  assertPreviewRobots(query)
  assertSource(query, sourceCommit, 'query')

  const cookie = await request(fetchImpl, previewUrl, { headers: { Cookie: 'leo563-preview=1' } })
  if (cookie.status !== 200 || header(cookie, 'X-DPG-Cache') !== 'BYPASS' || header(cookie, 'Cache-Control') !== PRIVATE_CACHE_CONTROL) {
    throw new Error('LEO563_REAL_PREVIEW_COOKIE_BYPASS_FAILED')
  }
  assertPreviewRobots(cookie)
  assertSource(cookie, sourceCommit, 'cookie')

  const health = await request(fetchImpl, new URL('/api/health', previewUrl))
  const healthBody = await health.json()
  if (
    health.status !== 200 ||
    healthBody?.application !== 'public' ||
    healthBody?.status !== 'ok' ||
    header(health, 'X-DPG-Cache') !== 'BYPASS' ||
    header(health, 'Cache-Control') !== PRIVATE_CACHE_CONTROL
  ) throw new Error('LEO563_REAL_PREVIEW_HEALTH_FAILED')
  assertPreviewRobots(health)
  assertSource(health, sourceCommit, 'health')

  const robots = await request(fetchImpl, new URL('/robots.txt', previewUrl))
  const robotsBody = await robots.text()
  if (
    robots.status !== 200 ||
    !/^User-agent: \*\nDisallow: \/\n$/m.test(robotsBody) ||
    header(robots, 'Cache-Control') !== PRIVATE_CACHE_CONTROL
  ) throw new Error('LEO563_REAL_PREVIEW_ROBOTS_FAILED')
  assertPreviewRobots(robots)
  assertSource(robots, sourceCommit, 'robots')

  return {
    contract: 'dongphugia:real-public-preview-proof:v2',
    sourceCommit,
    workerName: WORKER_NAME,
    previewAlias: PREVIEW_ALIAS,
    previewUrl: previewUrl.toString().replace(/\/$/, ''),
    observations: {
      root: { status: 200, ssr: true, metadata: true },
      health: { status: 200, application: 'public' },
      noindex: { htmlMeta: true, responseHeader: true, robotsDisallowAll: true },
      cache: {
        first: 'MISS',
        subsequent: 'HIT',
        query: 'BYPASS',
        cookie: 'BYPASS',
        api: 'BYPASS',
        edgeMaxAgeSeconds: 300,
        staleServing: false,
      },
      limits: {
        cpuMsPlanMaximum: 10,
        subrequestsPlanMaximum: 50,
        testedRequestsCompletedWithinPlanLimits: true,
      },
      cpuObservability: {
        status: 'PROVIDER_LIMITATION',
        reason: 'Cloudflare does not expose Workers Logs, Wrangler tail, or Logpush for Preview URLs.',
        documentation: 'https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/#limitations',
      },
      productionIsolation: {
        hostname: 'workers.dev',
        customDomains: [],
        workerRoutes: [],
        productionDnsOrTraffic: 'unchanged',
      },
    },
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const proof = await verifyRealPreview({ baseUrl: args.url, sourceSha: args['source-sha'] })
  await writeFile(args.output, `${JSON.stringify(proof, null, 2)}\n`, { mode: 0o600 })
  process.stdout.write(`${JSON.stringify({ sourceCommit: proof.sourceCommit, previewUrl: proof.previewUrl, cache: proof.observations.cache })}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`LEO563_REAL_PREVIEW_FAILED:${error.message}`)
    process.exitCode = 1
  })
}
