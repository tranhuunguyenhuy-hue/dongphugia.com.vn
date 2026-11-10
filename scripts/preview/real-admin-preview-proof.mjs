import { pathToFileURL } from 'node:url'

const EXPECTED_ADMIN_ORIGIN = 'https://dongphugia-phase2-admin-preview-290.tranhuunguyenhuy.workers.dev'

export function validateAdminPreviewUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('DPG_ADMIN_PREVIEW_URL_INVALID')
  }

  if (
    url.protocol !== 'https:' ||
    url.origin !== EXPECTED_ADMIN_ORIGIN ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) throw new Error('DPG_ADMIN_PREVIEW_URL_REJECTED')

  return url.origin
}

function assertPrivateNoindex(response, route) {
  const cache = response.headers.get('cache-control')?.toLowerCase() ?? ''
  const robots = response.headers.get('x-robots-tag')?.toLowerCase() ?? ''
  if (!cache.includes('private') || !cache.includes('no-store')) {
    throw new Error(`DPG_ADMIN_PREVIEW_PRIVATE_CACHE_FAILED:${route}`)
  }
  if (!robots.includes('noindex') || !robots.includes('nofollow')) {
    throw new Error(`DPG_ADMIN_PREVIEW_NOINDEX_FAILED:${route}`)
  }
}

async function request(fetchImpl, url, route) {
  const response = await fetchImpl(`${url}${route}`, {
    redirect: 'manual',
    headers: { 'User-Agent': 'DPG-Preview-Acceptance/1.0' },
  })
  assertPrivateNoindex(response, route)
  return response
}

export async function verifyRealAdminPreview({
  baseUrl,
  sourceSha,
  fetchImpl = fetch,
}) {
  const url = validateAdminPreviewUrl(baseUrl)
  if (!/^[0-9a-f]{40}$/.test(sourceSha ?? '')) {
    throw new Error('DPG_ADMIN_PREVIEW_SOURCE_SHA_INVALID')
  }

  const health = await request(fetchImpl, url, '/api/health')
  if (!health.ok) throw new Error('DPG_ADMIN_PREVIEW_HEALTH_FAILED')
  const healthSha = health.headers.get('x-dpg-source-sha')
  const payload = await health.json()
  if (
    healthSha !== sourceSha ||
    payload.source_sha !== sourceSha ||
    payload.status !== 'ok' ||
    payload.application !== 'admin'
  ) throw new Error('DPG_ADMIN_PREVIEW_SOURCE_IDENTITY_FAILED')

  const login = await request(fetchImpl, url, '/login')
  if (!login.ok) throw new Error('DPG_ADMIN_PREVIEW_LOGIN_FAILED')

  const robots = await request(fetchImpl, url, '/robots.txt')
  const robotsText = await robots.text()
  if (!robots.ok || !/Disallow:\s*\//i.test(robotsText)) {
    throw new Error('DPG_ADMIN_PREVIEW_ROBOTS_FAILED')
  }

  const protectedPage = await fetchImpl(`${url}/orders`, { redirect: 'manual' })
  if (
    ![302, 303, 307, 308].includes(protectedPage.status) ||
    !protectedPage.headers.get('location')?.startsWith('/login')
  ) throw new Error('DPG_ADMIN_PREVIEW_UNAUTHENTICATED_ACCESS_FAILED')
  assertPrivateNoindex(protectedPage, '/orders')

  return {
    status: 'ADMIN_PREVIEW_LIVE_PASS',
    sourceSha,
    adminUrl: url,
    observations: {
      health: 'PASS',
      loginNoindexNoStore: 'PASS',
      robotsNoindex: 'PASS',
      unauthenticatedOrdersDenied: 'PASS',
    },
    productionIsolation: {
      hostname: 'workers.dev',
      expectedWorkerOrigin: EXPECTED_ADMIN_ORIGIN,
      customDomains: [],
      productionRoutes: [],
    },
  }
}

function parseArgs(values) {
  const args = {}
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index]
    if (!key.startsWith('--')) continue
    args[key.slice(2)] = values[index + 1]
    index += 1
  }
  if (!args.url || !args['source-sha']) throw new Error('DPG_ADMIN_PREVIEW_ARGS_INVALID')
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const proof = await verifyRealAdminPreview({ baseUrl: args.url, sourceSha: args['source-sha'] })
  process.stdout.write(`${JSON.stringify(proof)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`DPG_ADMIN_PREVIEW_FAILED:${error.message}`)
    process.exitCode = 1
  })
}
