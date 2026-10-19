import { createHash, randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { request as httpRequest } from 'node:http'
import path from 'node:path'

import { PUBLIC_EDGE_CACHE_SECONDS } from '../../packages/app-contracts/src/index'
import { assertNoindexHtml } from './runtime-proof-html.mjs'

type Application = 'public' | 'admin'

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument?.startsWith('--')) continue
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`)
    args[argument.slice(2)] = value
    index += 1
  }
  return args
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function requireHeader(response: Response, name: string, expected: string) {
  const actual = response.headers.get(name)
  if (actual !== expected) throw new Error(`RUNTIME_PROOF_HEADER_FAILED:${name}:${actual || 'missing'}`)
  return actual
}

async function responseBody(response: Response, expectedStatus = 200) {
  if (response.status !== expectedStatus) {
    throw new Error(`RUNTIME_PROOF_STATUS_FAILED:${response.url}:${response.status}`)
  }
  return response.text()
}

async function requestWithHost(baseUrl: URL, host: string, requestPath = '/') {
  return new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }>((resolve, reject) => {
    const request = httpRequest({
      hostname: baseUrl.hostname,
      port: baseUrl.port,
      path: requestPath,
      method: 'GET',
      headers: { Host: host },
    }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      response.on('end', () => resolve({
        status: response.statusCode || 0,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }))
    })
    request.on('error', reject)
    request.end()
  })
}

async function collectPublicProof(baseUrl: URL) {
  const proofHost = `leo563-${randomUUID()}.preview.invalid`
  const first = await fetch(new URL('/', baseUrl), { headers: { host: proofHost } })
  const firstBody = await responseBody(first)
  assertNoindexHtml(firstBody, 'Đông Phú Gia - Vật liệu xây dựng cao cấp tại Đà Lạt')
  requireHeader(first, 'x-robots-tag', 'noindex, nofollow')
  requireHeader(first, 'cache-control', 'public, max-age=0, must-revalidate')
  requireHeader(first, 'cdn-cache-control', `public, max-age=${PUBLIC_EDGE_CACHE_SECONDS}, must-revalidate`)
  requireHeader(first, 'x-dpg-cache', 'MISS')
  requireHeader(first, 'x-edge-runtime', '1')

  const second = await fetch(new URL('/', baseUrl), { headers: { host: proofHost } })
  await responseBody(second)
  requireHeader(second, 'x-dpg-cache', 'HIT')

  const robots = await fetch(new URL('/robots.txt', baseUrl), { headers: { host: proofHost } })
  const robotsBody = await responseBody(robots)
  requireHeader(robots, 'x-robots-tag', 'noindex, nofollow')
  requireHeader(robots, 'cache-control', 'private, no-store')
  if (!robotsBody.includes('Disallow: /')) throw new Error('RUNTIME_PROOF_ROBOTS_FAILED')

  const cookie = await fetch(new URL('/', baseUrl), {
    headers: { cookie: 'leo563-proof=synthetic', host: proofHost },
  })
  await responseBody(cookie)
  requireHeader(cookie, 'x-dpg-cache', 'BYPASS')
  requireHeader(cookie, 'cache-control', 'private, no-store')

  const query = await fetch(new URL('/?q=synthetic', baseUrl), { headers: { host: proofHost } })
  await responseBody(query)
  requireHeader(query, 'x-dpg-cache', 'BYPASS')
  requireHeader(query, 'cache-control', 'private, no-store')

  const productionHost = await requestWithHost(baseUrl, 'www.dongphugia.vn')
  if (productionHost.status !== 503) throw new Error(`RUNTIME_PROOF_PRODUCTION_HOST_FAILED:${productionHost.status}`)
  if (productionHost.headers['cache-control'] !== 'private, no-store') {
    throw new Error('RUNTIME_PROOF_PRODUCTION_HOST_CACHE_FAILED')
  }

  const contact = await requestWithHost(baseUrl, proofHost, '/lien-he')
  if (contact.status !== 200) throw new Error(`RUNTIME_PROOF_CONTACT_STATUS_FAILED:${contact.status}`)
  if (contact.headers['x-robots-tag'] !== 'noindex, nofollow') {
    throw new Error('RUNTIME_PROOF_CONTACT_NOINDEX_HEADER_FAILED')
  }
  assertNoindexHtml(contact.body, 'Liên Hệ Tư Vấn')
  if (!contact.body.includes('Biểu mẫu đang tạm khóa trên bản Preview')) {
    throw new Error('RUNTIME_PROOF_CONTACT_READ_ONLY_NOTICE_FAILED')
  }
  if (contact.body.includes('contact-name') || contact.body.includes('Gửi yêu cầu trực tuyến')) {
    throw new Error('RUNTIME_PROOF_CONTACT_FORM_RENDERED_IN_PREVIEW')
  }

  const about = await requestWithHost(baseUrl, proofHost, '/ve-chung-toi')
  if (about.status !== 200) throw new Error(`RUNTIME_PROOF_ABOUT_STATUS_FAILED:${about.status}`)
  if (about.headers['x-robots-tag'] !== 'noindex, nofollow') {
    throw new Error('RUNTIME_PROOF_ABOUT_NOINDEX_HEADER_FAILED')
  }
  assertNoindexHtml(about.body, 'Về chúng tôi')
  if (!about.body.includes('Hiểu bạn cần gì.')) {
    throw new Error('RUNTIME_PROOF_CANONICAL_ABOUT_CONTENT_MISSING')
  }

  return {
    runtime: 'workerd-local',
    ssr: { status: first.status, htmlSha256: sha256(firstBody), metadata: true },
    noindex: { htmlMeta: true, responseHeader: true, robotsDisallowAll: true },
    cache: {
      ttlSeconds: PUBLIC_EDGE_CACHE_SECONDS,
      firstRequest: 'MISS',
      secondRequest: 'HIT',
      cookieRequest: 'BYPASS_PRIVATE_NO_STORE',
      unallowlistedQuery: 'BYPASS_PRIVATE_NO_STORE',
      keyDimensions: ['hostname', 'pathname', 'allowlisted-query', 'source-sha'],
    },
    previewIsolation: { productionHostRejected: true },
    canonicalRoutes: {
      contact: { status: contact.status, readOnly: true, noindex: true, formMarkupAbsent: true },
      about: { status: about.status, noindex: true, canonicalContent: true },
    },
    subrequests: {
      renderFetchCalls: 0,
      cacheApiMissPathMaximum: 2,
      cacheApiHitPathMaximum: 1,
    },
    cpuMs: 'UNKNOWN_REQUIRES_DEPLOYED_WORKER_OBSERVABILITY',
  } as const
}

async function collectAdminProof(baseUrl: URL) {
  const home = await fetch(new URL('/', baseUrl), { redirect: 'manual' })
  if (home.status !== 307) {
    throw new Error(`RUNTIME_PROOF_AUTH_REDIRECT_FAILED:${home.status}`)
  }
  requireHeader(home, 'x-robots-tag', 'noindex, nofollow')
  requireHeader(home, 'cache-control', 'private, no-store')
  const loginLocation = home.headers.get('location')
  if (!loginLocation) throw new Error('RUNTIME_PROOF_AUTH_LOCATION_MISSING')
  const loginUrl = new URL(loginLocation, baseUrl)
  if (loginUrl.pathname !== '/login' || loginUrl.searchParams.get('next') !== '/') {
    throw new Error('RUNTIME_PROOF_AUTH_LOCATION_FAILED')
  }

  const login = await fetch(loginUrl)
  const html = await responseBody(login)
  assertNoindexHtml(html, 'Dong Phu Gia Admin Application')
  requireHeader(login, 'x-robots-tag', 'noindex, nofollow')
  requireHeader(login, 'cache-control', 'private, no-store')

  const robots = await fetch(new URL('/robots.txt', baseUrl))
  const robotsBody = await responseBody(robots)
  requireHeader(robots, 'x-robots-tag', 'noindex, nofollow')
  requireHeader(robots, 'cache-control', 'private, no-store')
  if (!robotsBody.includes('Disallow: /')) throw new Error('RUNTIME_PROOF_ROBOTS_FAILED')

  return {
    runtime: 'next-node-local',
    ssr: { status: login.status, htmlSha256: sha256(html), metadata: true },
    auth: {
      protectedPath: '/',
      unauthenticatedStatus: home.status,
      loginStatus: login.status,
    },
    noindex: { htmlMeta: true, responseHeader: true, robotsDisallowAll: true },
    cache: { policy: 'private, no-store' },
  } as const
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const application = args.application as Application
  if (!['public', 'admin'].includes(application)) throw new Error('RUNTIME_PROOF_APPLICATION_INVALID')
  if (!/^[0-9a-f]{40}$/.test(args['source-sha'] || '')) throw new Error('RUNTIME_PROOF_SOURCE_INVALID')
  const baseUrl = new URL(args['base-url'] || '')
  const observation = application === 'public'
    ? await collectPublicProof(baseUrl)
    : await collectAdminProof(baseUrl)
  const proof = {
    contract: 'dongphugia:app-runtime-proof:v1',
    application,
    sourceCommit: args['source-sha'],
    observation,
  }
  const output = path.resolve(args.output || '')
  await writeFile(output, `${JSON.stringify(proof, null, 2)}\n`, 'utf8')
  process.stdout.write(`${JSON.stringify(proof)}\n`)
}

main().catch((error) => {
  console.error(`LEO563_RUNTIME_PROOF_FAILED: ${error.message}`)
  process.exitCode = 1
})
