import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const ENVIRONMENTS = {
  preview: { workerName: 'dpg-local-preview' },
  staging: { workerName: 'dpg-staging' },
}
const SOURCE_SHA = /^[a-f0-9]{40}$/
const CHECKPOINT = /^[a-f0-9]{40}$/
const CREDENTIAL_NAME = /(CLOUDFLARE|CF_|WRANGLER|SUPABASE|BUNNY|AWS_|GITHUB_|SERVICE_ROLE|AUTH_ADMIN|DATABASE|DIRECT_URL|PRIVATE_KEY|CREDENTIAL|PASSWORD|SECRET|TOKEN|ACCESS_KEY)/i

function fail(code) {
  throw new Error(code)
}

async function waitForServer(url, child, getOutput) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child && child.exitCode !== null) fail(`ENVIRONMENT_WORKER_BROWSER_WRANGLER_EXITED:${getOutput()}`)
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) })
      if (response.status < 500) return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  fail(`ENVIRONMENT_WORKER_BROWSER_SERVER_TIMEOUT:${getOutput()}`)
}

async function checkApp(page, origin, expected, viewportName) {
  const requests = []
  const assetResponses = []
  const catalogueResponses = []
  const routeSequence = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin === origin) {
      routeSequence.push({ type: 'request', method: request.method(), pathname: url.pathname })
      requests.push({ pathname: url.pathname, headers: request.headers() })
    }
  })
  page.on('response', (response) => {
    const url = new URL(response.url())
    if (url.origin === origin) {
      routeSequence.push({ type: 'response', method: response.request().method(), pathname: url.pathname, status: response.status() })
    }
    if (url.origin === origin && (url.pathname.startsWith('/api/catalogue/') || url.pathname === '/api/health')) {
      catalogueResponses.push({ pathname: url.pathname, status: response.status() })
    }
    if (url.origin === origin && /\/_next\/static\//.test(url.pathname)) {
      assetResponses.push({ pathname: url.pathname, status: response.status() })
    }
  })

  const publicResponse = await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  if (publicResponse?.status() !== 200) {
    const html = (await publicResponse?.text().catch(() => '')) || ''
    const digest = html.match(/(?:"digest"|data-digest)["'=:\s]{1,12}([A-Za-z0-9_-]{1,80})/i)?.[1] || 'none'
    fail(`ENVIRONMENT_WORKER_BROWSER_PUBLIC_STATUS:${viewportName}:status=${publicResponse?.status() ?? 'none'}:failure=${publicResponse?.headers()['x-dpg-render-failure'] || 'none'}:bytes=${Buffer.byteLength(html)}:defaultErrorShell=${/This page couldn.t load/i.test(html)}:digest=${digest}:routeSequence=${JSON.stringify(routeSequence.slice(-80))}`)
  }
  await page.getByRole('note').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {
    fail(`ENVIRONMENT_WORKER_BROWSER_PRODUCTION_CATALOGUE_NOTICE_TIMEOUT:${viewportName}`)
  })
  const publicHeaders = await publicResponse.allHeaders()
  if (publicHeaders['x-dpg-source-sha'] !== expected.sourceSha
    || !publicHeaders['x-robots-tag']?.includes('noindex')
    || publicHeaders['x-dpg-app'] !== 'public'
    || publicHeaders['x-dpg-data-source'] !== 'production-published-public-catalogue') {
    fail(`ENVIRONMENT_WORKER_BROWSER_PUBLIC_IDENTITY:${viewportName}`)
  }
  const publicBody = await page.locator('body').innerText()
  if (!publicBody.includes('Dữ liệu sản phẩm và giá được đọc trực tiếp từ catalogue công khai')
    || !publicBody.includes('Banner và Blog được ẩn')) {
    fail(`ENVIRONMENT_WORKER_BROWSER_PRODUCTION_CATALOGUE_NOTICE_MISSING:${viewportName}:${publicBody.slice(0, 240)}`)
  }
  const publicLayout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  if (publicLayout.scrollWidth > publicLayout.width + 1) fail(`ENVIRONMENT_WORKER_BROWSER_PUBLIC_OVERFLOW:${viewportName}`)
  if (!requests.find((request) => request.pathname === '/' && !String(request.headers.cookie || '').includes('dpg_admin_cookie_test='))) {
    fail(`ENVIRONMENT_WORKER_BROWSER_ADMIN_COOKIE_REACHED_PUBLIC:${viewportName}`)
  }

  const healthResponse = await page.request.get(`${origin}/api/health`, { maxRedirects: 0 })
  routeSequence.push({ type: 'api-response', method: 'GET', pathname: '/api/health', status: healthResponse.status() })
  if (healthResponse.status() !== 200
    || healthResponse.headers()['x-dpg-data-source'] !== 'production-published-public-catalogue') {
    fail(`ENVIRONMENT_WORKER_BROWSER_CATALOGUE_HEALTH:${viewportName}`)
  }
  const health = await healthResponse.json()
  if (health.catalogueMode !== 'production-published-public-catalogue'
    || !CHECKPOINT.test(health.catalogueCheckpoint || '')
    || health.publicProducts < 1) {
    fail(`ENVIRONMENT_WORKER_BROWSER_CATALOGUE_CHECKPOINT:${viewportName}`)
  }

  const listingResponse = await page.request.get(`${origin}/api/catalogue/listings/thiet-bi-bep/bep-dien-tu`, { maxRedirects: 0 })
  routeSequence.push({ type: 'api-response', method: 'GET', pathname: '/api/catalogue/listings/thiet-bi-bep/bep-dien-tu', status: listingResponse.status() })
  if (listingResponse.status() !== 200) fail(`ENVIRONMENT_WORKER_BROWSER_CATALOGUE_LISTING:${viewportName}`)
  const listing = await listingResponse.json()
  if (listing.contract !== 'dpg:public-catalogue-listing-shard:v1'
    || listing.checkpoint !== health.catalogueCheckpoint
    || !Array.isArray(listing.products) || listing.products.length < 1) {
    fail(`ENVIRONMENT_WORKER_BROWSER_CATALOGUE_LISTING_CHECKPOINT:${viewportName}`)
  }
  const listingPage = await page.goto(`${origin}/thiet-bi-bep/bep-dien-tu`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  if (listingPage?.status() !== 200) {
    const responseText = (await listingPage?.text().catch(() => ''))?.slice(-1200) || ''
    const failure = listingPage?.headers()['x-dpg-render-failure'] || 'none'
    fail(`ENVIRONMENT_WORKER_BROWSER_CATALOGUE_LISTING_RENDER:${viewportName}:status=${listingPage?.status() ?? 'none'}:failure=${failure}:body=${responseText}:routeSequence=${JSON.stringify(routeSequence.slice(-80))}:catalogue=${JSON.stringify(catalogueResponses)}`)
  }
  try {
    await page.getByText(listing.products[0].name, { exact: true }).waitFor({ state: 'visible', timeout: 20000 })
  } catch {
    const body = (await page.locator('body').innerText()).slice(0, 240)
    fail(`ENVIRONMENT_WORKER_BROWSER_CATALOGUE_LISTING_RENDER:${viewportName}:${body}`)
  }
  const searchResponse = await page.request.get(`${origin}/api/search?q=toto&limit=1`, { maxRedirects: 0 })
  routeSequence.push({ type: 'api-response', method: 'GET', pathname: '/api/search', status: searchResponse.status() })
  const search = await searchResponse.json()
  if (searchResponse.status() !== 200 || !Array.isArray(search.results) || search.results.length !== 1
    || typeof search.results[0].sku !== 'string') {
    fail(`ENVIRONMENT_WORKER_BROWSER_CATALOGUE_SEARCH:${viewportName}`)
  }

  const adminResponse = await page.goto(`${origin}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  if (adminResponse?.status() !== 200) fail(`ENVIRONMENT_WORKER_BROWSER_ADMIN_RENDER_STATUS:${viewportName}`)
  const loginResponse = adminResponse
  const loginHeaders = await loginResponse.allHeaders()
  if (loginHeaders['x-dpg-source-sha'] !== expected.sourceSha
    || !loginHeaders['x-robots-tag']?.includes('noindex')
    || loginHeaders['x-dpg-app'] !== 'admin'
    || !loginHeaders['cache-control']?.includes('private')
    || loginHeaders['x-dpg-authentication'] !== 'disabled'
    || loginHeaders['x-dpg-private-data'] !== 'unavailable'
    || loginHeaders['set-cookie']) {
    fail(`ENVIRONMENT_WORKER_BROWSER_ADMIN_IDENTITY:${viewportName}`)
  }
  if (await page.getByRole('heading', { name: 'Admin sign-in shell' }).count() !== 1
    || !(await page.getByRole('status').innerText()).includes('Đăng nhập bị tắt trong môi trường này')
    || await page.locator('form').count() !== 1
    || await page.locator('input,button').evaluateAll((elements) => elements.some((element) => !element.disabled))) {
    fail(`ENVIRONMENT_WORKER_BROWSER_ADMIN_AUTH_DISABLED:${viewportName}`)
  }
  const loginLayout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  if (loginLayout.scrollWidth > loginLayout.width + 1) fail(`ENVIRONMENT_WORKER_BROWSER_ADMIN_OVERFLOW:${viewportName}`)

  const privatePage = await page.request.get(`${origin}/admin`, { maxRedirects: 0 })
  const forgotPage = await page.request.get(`${origin}/admin/forgot-password`, { maxRedirects: 0 })
  const resetPage = await page.request.get(`${origin}/admin/reset-password`, { maxRedirects: 0 })
  const adminHealth = await page.request.get(`${origin}/admin/api/health`, { maxRedirects: 0 })
  if (![301, 302, 303, 307, 308].includes(privatePage.status())
    || !privatePage.headers().location?.includes('/admin/login')
    || forgotPage.status() !== 200 || resetPage.status() !== 200 || adminHealth.status() !== 200
    || [privatePage, forgotPage, resetPage, adminHealth].some((response) => response.headers()['set-cookie'])) {
    fail(`ENVIRONMENT_WORKER_BROWSER_ADMIN_PRIVATE_BOUNDARY:${viewportName}`)
  }
  const healthBody = await adminHealth.json()
  if (healthBody.application !== 'admin' || healthBody.status !== 'ok'
    || Object.keys(healthBody).some((key) => /staff|customer|role|email|credential|database/i.test(key))) {
    fail(`ENVIRONMENT_WORKER_BROWSER_ADMIN_HEALTH_LEAK:${viewportName}`)
  }
  const forgotBody = await forgotPage.text()
  const resetBody = await resetPage.text()
  if (!forgotBody.includes('Khôi phục tài khoản bị tắt') || !resetBody.includes('Đổi mật khẩu bị tắt')
    || !forgotBody.includes('disabled') || !resetBody.includes('disabled')) {
    fail(`ENVIRONMENT_WORKER_BROWSER_ADMIN_RECOVERY_NOT_DISABLED:${viewportName}`)
  }

  const adminRequest = requests.find((request) => request.pathname === '/admin/login')
  if (!adminRequest || !String(adminRequest.headers.cookie || '').includes('dpg_admin_cookie_test=synthetic')) {
    fail(`ENVIRONMENT_WORKER_BROWSER_ADMIN_COOKIE_SCOPE_INVALID:${viewportName}`)
  }
  if (assetResponses.some(({ status }) => status < 200 || status >= 400)
    || !assetResponses.some(({ pathname }) => pathname.startsWith('/_next/static/'))
    || !assetResponses.some(({ pathname }) => pathname.startsWith('/admin/_next/static/'))) {
    fail(`ENVIRONMENT_WORKER_BROWSER_ASSET_LOAD_FAILED:${viewportName}`)
  }

  const authCallback = await page.request.get(`${origin}/admin/auth/callback?code=synthetic`, { maxRedirects: 0 })
  const blockedRequests = await Promise.all([
    page.request.post(`${origin}/admin/auth/login`),
    page.request.post(`${origin}/admin/auth/logout`),
    page.request.post(`${origin}/admin/api/orders`),
    page.request.patch(`${origin}/admin/api/cms`),
    page.request.put(`${origin}/admin/api/media/upload`),
    page.request.delete(`${origin}/admin/api/orders/synthetic`),
  ])
  if (authCallback.status() !== 503 || blockedRequests.some((response) =>
    response.status() !== 405 || response.headers()['x-dpg-private-data'] !== 'unavailable')) {
    fail(`ENVIRONMENT_WORKER_BROWSER_ADMIN_SIDE_EFFECTS_NOT_BLOCKED:${viewportName}`)
  }

  // Exercise actual SSR ordering in both directions and under concurrent requests.
  const adminToPublic = await page.goto(`${origin}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  const publicAfterAdminPage = await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  if (adminToPublic?.status() !== 200 || publicAfterAdminPage?.status() !== 200
    || publicAfterAdminPage.headers()['x-dpg-app'] !== 'public'
    || !(await page.locator('body').innerText()).includes('Dữ liệu sản phẩm và giá được đọc trực tiếp')) {
    fail(`ENVIRONMENT_WORKER_BROWSER_ADMIN_TO_PUBLIC_SSR:${viewportName}`)
  }
  const [concurrentPublic, concurrentAdmin] = await Promise.all([
    page.request.get(`${origin}/`, { maxRedirects: 0 }),
    page.request.get(`${origin}/admin/login`, { maxRedirects: 0 }),
  ])
  if (concurrentPublic.status() !== 200 || concurrentPublic.headers()['x-dpg-app'] !== 'public'
    || concurrentAdmin.status() !== 200 || concurrentAdmin.headers()['x-dpg-app'] !== 'admin') {
    fail(`ENVIRONMENT_WORKER_BROWSER_CONCURRENT_SSR:${viewportName}`)
  }
  const publicFirstPage = await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  const adminAfterPublicPage = await page.goto(`${origin}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  if (publicFirstPage?.status() !== 200 || adminAfterPublicPage?.status() !== 200
    || adminAfterPublicPage.headers()['x-dpg-app'] !== 'admin') {
    fail(`ENVIRONMENT_WORKER_BROWSER_PUBLIC_TO_ADMIN_SSR:${viewportName}`)
  }

  const publicAfterAdminResponse = await page.request.get(`${origin}/`, { maxRedirects: 0 })
  if (publicAfterAdminResponse.status() !== 200
    || publicAfterAdminResponse.headers()['x-dpg-app'] !== 'public'
    || publicAfterAdminResponse.headers()['x-dpg-source-sha'] !== expected.sourceSha) {
    fail(`ENVIRONMENT_WORKER_BROWSER_PUBLIC_AFTER_ADMIN:${viewportName}`)
  }
  const blogResponse = await page.request.get(`${origin}/blog`, { maxRedirects: 0 })
  if (blogResponse.status() !== 503 || !blogResponse.headers()['x-robots-tag']?.includes('noindex')) {
    fail(`ENVIRONMENT_WORKER_BROWSER_UNVERIFIED_BLOG_NOT_BLOCKED:${viewportName}`)
  }
  return {
    viewport: viewportName,
    publicStatus: publicResponse.status(),
    adminStatus: loginResponse.status(),
    publicWidth: publicLayout.width,
    publicScrollWidth: publicLayout.scrollWidth,
    adminWidth: loginLayout.width,
    adminScrollWidth: loginLayout.scrollWidth,
    adminRoutes: ['GET /admin/login -> rendered with auth disabled', 'GET /admin -> redirected to sign-in'],
    localAssetRequests: assetResponses.length,
    adminCookieExcludedFromPublic: true,
    adminCookieSentOnAdminPath: true,
    adminAuthentication: 'disabled',
    privateAdminData: 'unavailable',
    adminSSR: 'passed-in-both-orders-and-concurrently',
    productionCatalogueCheckpoint: health.catalogueCheckpoint,
    listingProducts: listing.products.length,
    searchResults: search.results.length,
    deniedMutationMethods: blockedRequests.map((response) => response.status()),
    publicAfterAdminStatus: publicAfterAdminResponse.status(),
    unverifiedBlog: 'unavailable',
  }
}

async function main() {
  const environment = process.argv[2]
  const target = ENVIRONMENTS[environment]
  const sourceSha = process.env.BUILD_SOURCE_SHA?.trim()
  if (!target) fail('ENVIRONMENT_WORKER_BROWSER_ENVIRONMENT_INVALID')
  if (!SOURCE_SHA.test(sourceSha || '')) fail('ENVIRONMENT_WORKER_BROWSER_SOURCE_SHA_REQUIRED')
  const repositoryRoot = process.cwd()
  const artifactRoot = path.join(repositoryRoot, '.artifacts', 'environment-worker', environment)
  const configPath = path.join(artifactRoot, 'wrangler.json')
  const existingOrigin = process.env.ENVIRONMENT_WORKER_BROWSER_ORIGIN?.trim()
  let origin
  if (existingOrigin) {
    let parsed
    try { parsed = new URL(existingOrigin) } catch { fail('ENVIRONMENT_WORKER_BROWSER_ORIGIN_INVALID') }
    if (parsed.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(parsed.hostname)
      || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
      fail('ENVIRONMENT_WORKER_BROWSER_ORIGIN_INVALID')
    }
    origin = parsed.origin
  } else {
    const port = Number(process.env.ENVIRONMENT_WORKER_BROWSER_PORT || '8787')
    if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) fail('ENVIRONMENT_WORKER_BROWSER_PORT_INVALID')
    origin = `http://127.0.0.1:${port}`
  }
  const wrangler = path.join(repositoryRoot, 'apps/environment-worker/node_modules/wrangler/bin/wrangler.js')
  const output = []
  const safeEnvironment = { ...process.env }
  for (const name of Object.keys(safeEnvironment)) {
    if (CREDENTIAL_NAME.test(name)) delete safeEnvironment[name]
  }
  delete safeEnvironment.NEXT_PUBLIC_SUPABASE_URL
  delete safeEnvironment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  let child = null
  if (!existingOrigin) {
    const port = new URL(origin).port
    child = spawn(process.execPath, [wrangler, 'dev', '--local', '--config', configPath, '--ip', '127.0.0.1', '--port', port], {
      cwd: repositoryRoot,
      env: { ...safeEnvironment, WRANGLER_SEND_METRICS: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout.on('data', (chunk) => output.push(String(chunk)))
    child.stderr.on('data', (chunk) => output.push(String(chunk)))
  }
  const getOutput = () => output.join('').slice(-5000)
  let browser
  try {
    await waitForServer(`${origin}/`, child, getOutput)
    browser = await chromium.launch({ headless: true })
    const results = []
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 1000, isMobile: false },
      { name: 'mobile', width: 390, height: 844, isMobile: true },
    ]) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.isMobile,
        deviceScaleFactor: viewport.isMobile ? 2 : 1,
      })
      await context.route('https://**/*', (route) => route.abort())
      await context.addCookies([{
        name: 'dpg_admin_cookie_test', value: 'synthetic', domain: '127.0.0.1', path: '/admin',
        httpOnly: true, secure: false, sameSite: 'Lax',
      }])
      const page = await context.newPage()
      try {
        results.push(await checkApp(page, origin, { sourceSha }, viewport.name))
      } catch (error) {
        fail(`${error instanceof Error ? error.message : 'ENVIRONMENT_WORKER_BROWSER_CHECK_FAILED'}:worker=${getOutput()}`)
      }
      await context.close()
    }
    process.stdout.write(`${JSON.stringify({ status: 'ENVIRONMENT_WORKER_BROWSER_PASS', environment, workerName: target.workerName, localOrigin: origin, sourceSha, results })}\n`)
  } finally {
    await browser?.close()
    if (child && child.exitCode === null) {
      child.kill('SIGTERM')
      await Promise.race([
        new Promise((resolve) => child.once('exit', resolve)),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ])
      if (child.exitCode === null) child.kill('SIGKILL')
    }
  }
}

main().catch((error) => {
  process.stderr.write(`ENVIRONMENT_WORKER_BROWSER_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}\n`)
  process.exitCode = 1
})
