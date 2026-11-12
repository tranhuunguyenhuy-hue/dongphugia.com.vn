import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const ENVIRONMENTS = {
  preview: { workerName: 'dpg-preview' },
  staging: { workerName: 'dpg-staging' },
}
const SOURCE_SHA = /^[a-f0-9]{40}$/

function fail(code) {
  throw new Error(code)
}

async function freePort() {
  const server = createServer()
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return port
}

async function waitForServer(url, child, getOutput) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) fail(`ENVIRONMENT_WORKER_BROWSER_WRANGLER_EXITED:${getOutput()}`)
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
  page.on('request', async (request) => {
    const url = new URL(request.url())
    if (url.origin === origin) {
      requests.push({ pathname: url.pathname, headers: await request.allHeaders() })
    }
  })
  page.on('response', (response) => {
    const url = new URL(response.url())
    if (url.origin === origin && /\/_next\/static\//.test(url.pathname)) {
      assetResponses.push({ pathname: url.pathname, status: response.status() })
    }
  })

  const publicResponse = await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  if (publicResponse?.status() !== 200) fail(`ENVIRONMENT_WORKER_BROWSER_PUBLIC_STATUS:${viewportName}`)
  const publicHeaders = await publicResponse.allHeaders()
  if (publicHeaders['x-dpg-source-sha'] !== expected.sourceSha
    || !publicHeaders['x-robots-tag']?.includes('noindex')
    || publicHeaders['x-dpg-app'] !== 'public') {
    fail(`ENVIRONMENT_WORKER_BROWSER_PUBLIC_IDENTITY:${viewportName}`)
  }
  const publicBody = await page.locator('body').innerText()
  if (!publicBody.includes('Dữ liệu minh họa') || !publicBody.includes('fixture kiểm thử')) {
    fail(`ENVIRONMENT_WORKER_BROWSER_SYNTHETIC_FIXTURE_MISSING:${viewportName}:${JSON.stringify({
      notice: publicBody.includes('Dữ liệu minh họa'),
      fixtureLabel: publicBody.includes('fixture kiểm thử'),
      text: publicBody.slice(0, 200),
    })}`)
  }
  const publicLayout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  if (publicLayout.scrollWidth > publicLayout.width + 1) fail(`ENVIRONMENT_WORKER_BROWSER_PUBLIC_OVERFLOW:${viewportName}`)
  if (!requests.find((request) => request.pathname === '/' && !String(request.headers.cookie || '').includes('dpg_admin_cookie_test='))) {
    fail(`ENVIRONMENT_WORKER_BROWSER_ADMIN_COOKIE_REACHED_PUBLIC:${viewportName}`)
  }

  const loginResponse = await page.goto(`${origin}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  if (loginResponse?.status() !== 200) fail(`ENVIRONMENT_WORKER_BROWSER_ADMIN_LOGIN_STATUS:${viewportName}`)
  const loginHeaders = await loginResponse.allHeaders()
  if (loginHeaders['x-dpg-source-sha'] !== expected.sourceSha
    || !loginHeaders['x-robots-tag']?.includes('noindex')
    || loginHeaders['x-dpg-app'] !== 'admin'
    || !loginHeaders['cache-control']?.includes('private')) {
    fail(`ENVIRONMENT_WORKER_BROWSER_ADMIN_IDENTITY:${viewportName}`)
  }
  if (await page.title() !== 'Dong Phu Gia Admin Application'
    || await page.getByRole('textbox', { name: /email/i }).count() !== 1
    || await page.getByLabel(/mật khẩu/i).count() !== 1
    || await page.getByRole('link', { name: /quên mật khẩu/i }).getAttribute('href') !== '/admin/forgot-password') {
    fail(`ENVIRONMENT_WORKER_BROWSER_ADMIN_LOGIN_CONTENT:${viewportName}`)
  }
  const loginLayout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  if (loginLayout.scrollWidth > loginLayout.width + 1) fail(`ENVIRONMENT_WORKER_BROWSER_ADMIN_OVERFLOW:${viewportName}`)

  const forgotResponse = await page.goto(`${origin}/admin/forgot-password`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  if (forgotResponse?.status() !== 200
    || await page.getByRole('heading', { name: 'Đặt lại mật khẩu' }).count() !== 1
    || await page.getByRole('textbox', { name: /email/i }).count() !== 1
    || await page.getByRole('link', { name: /quay lại đăng nhập/i }).getAttribute('href') !== '/admin/login') {
    fail(`ENVIRONMENT_WORKER_BROWSER_ADMIN_FORGOT_PASSWORD_ROUTE:${viewportName}`)
  }

  const resetResponse = await page.goto(`${origin}/admin/reset-password`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  if (resetResponse?.status() !== 200
    || await page.getByRole('heading', { name: 'Đặt mật khẩu mới' }).count() !== 1
    || await page.getByLabel('Mật khẩu mới').count() !== 1
    || await page.getByLabel('Xác nhận mật khẩu').count() !== 1) {
    fail(`ENVIRONMENT_WORKER_BROWSER_ADMIN_RESET_PASSWORD_ROUTE:${viewportName}`)
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

  const protectedResponse = await page.request.get(`${origin}/admin`, { maxRedirects: 0 })
  if (protectedResponse.status() !== 307
    || new URL(protectedResponse.headers().location || '', origin).pathname !== '/admin/login') {
    fail(`ENVIRONMENT_WORKER_BROWSER_UNAUTHORIZED_ADMIN_BOUNDARY:${viewportName}`)
  }
  return {
    viewport: viewportName,
    publicStatus: publicResponse.status(),
    adminLoginStatus: loginResponse.status(),
    publicWidth: publicLayout.width,
    publicScrollWidth: publicLayout.scrollWidth,
    adminWidth: loginLayout.width,
    adminScrollWidth: loginLayout.scrollWidth,
    adminAuthRoutes: ['/admin/login', '/admin/forgot-password', '/admin/reset-password'],
    localAssetRequests: assetResponses.length,
    adminCookieExcludedFromPublic: true,
    adminCookieSentOnAdminPath: true,
    unauthorizedAdminRedirect: '/admin/login',
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
  const port = await freePort()
  const origin = `http://127.0.0.1:${port}`
  const wrangler = path.join(repositoryRoot, 'apps/environment-worker/node_modules/wrangler/bin/wrangler.js')
  const output = []
  const child = spawn(process.execPath, [wrangler, 'dev', '--local', '--config', configPath, '--ip', '127.0.0.1', '--port', String(port)], {
    cwd: repositoryRoot,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (chunk) => output.push(String(chunk)))
  child.stderr.on('data', (chunk) => output.push(String(chunk)))
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
      results.push(await checkApp(page, origin, { sourceSha }, viewport.name))
      await context.close()
    }
    process.stdout.write(`${JSON.stringify({ status: 'ENVIRONMENT_WORKER_BROWSER_PASS', environment, workerName: target.workerName, localOrigin: origin, sourceSha, results })}\n`)
  } finally {
    await browser?.close()
    if (child.exitCode === null) {
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
