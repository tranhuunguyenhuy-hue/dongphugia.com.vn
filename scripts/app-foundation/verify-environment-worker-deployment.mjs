const ACCOUNT_ID = 'd54f3402b9d112ab64d6135e0e3f1fb1'
const ENVIRONMENTS = {
  staging: { workerName: 'dpg-staging' },
}
const SHA = /^[a-f0-9]{40}$/
const UUID = /^[a-f0-9-]{36}$/i

function fail(code) {
  throw new Error(code)
}

function assertIdentity(response, sourceSha, app) {
  if (response.headers.get('x-dpg-source-sha') !== sourceSha) fail('ENVIRONMENT_WORKER_RUNTIME_SHA_MISMATCH')
  if (response.headers.get('x-robots-tag')?.toLowerCase().includes('noindex') !== true) {
    fail('ENVIRONMENT_WORKER_RUNTIME_NOINDEX_MISSING')
  }
  if (response.headers.get('x-dpg-app') !== app) fail('ENVIRONMENT_WORKER_RUNTIME_APP_MISMATCH')
}

async function fetchChecked(fetchImpl, url, init, expectedStatus, sourceSha, app) {
  const response = await fetchImpl(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(20000) })
  if (response.status !== expectedStatus) fail(`ENVIRONMENT_WORKER_RUNTIME_STATUS_${expectedStatus}_REQUIRED`)
  assertIdentity(response, sourceSha, app)
  return response
}

export async function verifyHeadRuntime({
  fetchImpl = fetch,
  origin,
  pathname,
  sourceSha,
  app,
}) {
  const response = await fetchChecked(fetchImpl, `${origin}${pathname}`, {
    method: 'HEAD',
    cache: 'no-store',
  }, 200, sourceSha, app)
  if ((await response.text()) !== '') fail('ENVIRONMENT_WORKER_RUNTIME_HEAD_BODY_INVALID')
  return { status: response.status, sourceSha, app, noindex: true }
}

async function verifyRuntime({ fetchImpl = fetch, origin, sourceSha }) {
  const publicResponse = await fetchChecked(fetchImpl, `${origin}/`, { cache: 'no-store' }, 200, sourceSha, 'public')
  await verifyHeadRuntime({ fetchImpl, origin, pathname: '/', sourceSha, app: 'public' })
  const publicHtml = await publicResponse.text()
  if (publicResponse.headers.get('x-dpg-data-source') !== 'production-published-public-catalogue'
    || !publicHtml.includes('Dữ liệu sản phẩm và giá được đọc trực tiếp từ catalogue công khai')) {
    fail('ENVIRONMENT_WORKER_RUNTIME_PRODUCTION_CATALOGUE_NOTICE_MISSING')
  }
  if (/(SUPABASE_SERVICE_ROLE_KEY|AUTH_ADMIN_SECRET|DATABASE_URL|staff_context)/i.test(publicHtml)) {
    fail('ENVIRONMENT_WORKER_RUNTIME_PUBLIC_PRIVILEGED_STATE_EXPOSED')
  }

  const healthResponse = await fetchChecked(fetchImpl, `${origin}/api/health`, { cache: 'no-store' }, 200, sourceSha, 'public')
  const publicHealth = await healthResponse.json()
  if (publicHealth.catalogueMode !== 'production-published-public-catalogue'
    || !SHA.test(publicHealth.catalogueCheckpoint || '') || publicHealth.publicProducts < 1) {
    fail('ENVIRONMENT_WORKER_RUNTIME_PRODUCTION_CATALOGUE_CHECKPOINT_INVALID')
  }
  const listingResponse = await fetchChecked(fetchImpl,
    `${origin}/api/catalogue/listings/thiet-bi-bep/bep-dien-tu`, { cache: 'no-store' }, 200, sourceSha, 'public')
  const listing = await listingResponse.json()
  if (listing.contract !== 'dpg:public-catalogue-listing-shard:v1'
    || listing.checkpoint !== publicHealth.catalogueCheckpoint
    || !Array.isArray(listing.products) || listing.products.length < 1) {
    fail('ENVIRONMENT_WORKER_RUNTIME_PRODUCTION_CATALOGUE_LISTING_INVALID')
  }
  const searchResponse = await fetchChecked(fetchImpl, `${origin}/api/search?q=toto&limit=1`, { cache: 'no-store' }, 200, sourceSha, 'public')
  const search = await searchResponse.json()
  if (!Array.isArray(search.results) || search.results.length !== 1 || typeof search.results[0].sku !== 'string') {
    fail('ENVIRONMENT_WORKER_RUNTIME_PRODUCTION_CATALOGUE_SEARCH_INVALID')
  }

  const adminResponse = await fetchChecked(fetchImpl, `${origin}/admin/login`, { cache: 'no-store' }, 200, sourceSha, 'admin')
  if (adminResponse.headers.get('cache-control')?.toLowerCase().includes('private') !== true) {
    fail('ENVIRONMENT_WORKER_RUNTIME_ADMIN_CACHE_NOT_PRIVATE')
  }
  if (adminResponse.headers.get('x-dpg-authentication') !== 'disabled'
    || adminResponse.headers.get('x-dpg-private-data') !== 'unavailable'
    || adminResponse.headers.has('set-cookie')) {
    fail('ENVIRONMENT_WORKER_RUNTIME_ADMIN_PRIVATE_BOUNDARY_INVALID')
  }
  const adminHtml = await adminResponse.text()
  if (!adminHtml.includes('Admin sign-in shell')
    || !adminHtml.includes('Đăng nhập bị tắt trong môi trường này')
    || !/disabled/.test(adminHtml)
    || /staff_context|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|dpg_v1_api/i.test(adminHtml)) {
    fail('ENVIRONMENT_WORKER_RUNTIME_ADMIN_RENDERED_SHELL_INVALID')
  }
  const privatePage = await fetchChecked(fetchImpl, `${origin}/admin`, { cache: 'no-store' }, 307, sourceSha, 'admin')
  if (!privatePage.headers.get('location')?.includes('/admin/login') || privatePage.headers.has('set-cookie')) {
    fail('ENVIRONMENT_WORKER_RUNTIME_ADMIN_PRIVATE_PAGE_NOT_GATED')
  }
  for (const [pathname, expectedStatus, disabledText] of [
    ['/admin/forgot-password', 200, 'Khôi phục tài khoản bị tắt'],
    ['/admin/reset-password', 200, 'Đổi mật khẩu bị tắt'],
  ]) {
    const response = await fetchChecked(fetchImpl, `${origin}${pathname}`, { cache: 'no-store' }, expectedStatus, sourceSha, 'admin')
    const html = await response.text()
    if (!html.includes(disabledText) || !html.includes('disabled') || response.headers.has('set-cookie')) {
      fail('ENVIRONMENT_WORKER_RUNTIME_ADMIN_AUTH_SIDE_EFFECT_UI_NOT_DISABLED')
    }
  }
  const adminHealthResponse = await fetchChecked(fetchImpl, `${origin}/admin/api/health`, { cache: 'no-store' }, 200, sourceSha, 'admin')
  const adminHealth = await adminHealthResponse.json()
  if (adminHealth.application !== 'admin' || adminHealth.status !== 'ok'
    || Object.keys(adminHealth).some((key) => /staff|customer|role|email|credential|database/i.test(key))
    || adminHealthResponse.headers.has('set-cookie')) {
    fail('ENVIRONMENT_WORKER_RUNTIME_ADMIN_HEALTH_LEAK')
  }
  const privateApi = await fetchChecked(fetchImpl, `${origin}/admin/api/orders`, { cache: 'no-store' }, 307, sourceSha, 'admin')
  if (!privateApi.headers.get('location')?.includes('/admin/login') || privateApi.headers.has('set-cookie')) {
    fail('ENVIRONMENT_WORKER_RUNTIME_ADMIN_PRIVATE_API_NOT_GATED')
  }

  await verifyHeadRuntime({ fetchImpl, origin, pathname: '/admin/login', sourceSha, app: 'admin' })

  const unknownRoute = await fetchChecked(fetchImpl, `${origin}/admin/unknown`, { cache: 'no-store' }, 307, sourceSha, 'admin')
  if (!unknownRoute.headers.get('location')?.includes('/admin/login')) {
    fail('ENVIRONMENT_WORKER_RUNTIME_ADMIN_UNKNOWN_ROUTE_NOT_GATED')
  }

  const callbackResponse = await fetchChecked(fetchImpl,
    `${origin}/admin/auth/callback?code=synthetic`, { cache: 'no-store' }, 503, sourceSha, 'admin')
  const blogResponse = await fetchChecked(fetchImpl, `${origin}/blog`, { cache: 'no-store' }, 503, sourceSha, 'public')

  return {
    public: {
      status: publicResponse.status,
      sha: sourceSha,
      noindex: true,
      dataMode: 'production-published-public-catalogue',
      checkpoint: publicHealth.catalogueCheckpoint,
      listingProducts: listing.products.length,
      searchResults: search.results.length,
      unverifiedBlogStatus: blogResponse.status,
    },
    admin: { status: adminResponse.status, authentication: 'disabled', privateData: 'unavailable', noindex: true, privatePages: 'redirect-to-disabled-login' },
    adminBoundary: {
      loginShellStatus: 200,
      privatePageStatus: privatePage.status,
      disabledRecoveryRoutes: ['/admin/forgot-password', '/admin/reset-password'],
      publicHealthStatus: healthResponse.status,
      privateApiStatus: privateApi.status,
      callbackStatus: callbackResponse.status,
      hostedMutationProbe: 'not-performed',
    },
  }
}

export async function verifyEnvironmentWorkerDeployment({
  environment,
  sourceSha,
  accountId,
  apiToken,
  fetchImpl = fetch,
}) {
  const target = ENVIRONMENTS[environment]
  if (!target) fail('ENVIRONMENT_WORKER_VERIFY_ENVIRONMENT_INVALID')
  if (!SHA.test(sourceSha || '')) fail('ENVIRONMENT_WORKER_VERIFY_SOURCE_SHA_INVALID')
  if (accountId !== ACCOUNT_ID) fail('ENVIRONMENT_WORKER_VERIFY_ACCOUNT_MISMATCH')
  if (!apiToken) fail('ENVIRONMENT_WORKER_VERIFY_TOKEN_REQUIRED')

  const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${target.workerName}/deployments?per_page=1`
  const response = await fetchImpl(apiUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiToken}`, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) fail(`ENVIRONMENT_WORKER_VERIFY_API_HTTP_${response.status}`)
  const payload = await response.json()
  const deployment = payload?.result?.deployments?.[0]
  const versions = deployment?.versions
  if (payload?.success !== true || !UUID.test(deployment?.id || '')
    || !Array.isArray(versions) || versions.length !== 1
    || versions[0].percentage !== 100 || !UUID.test(versions[0].version_id || '')) {
    fail('ENVIRONMENT_WORKER_VERIFY_SINGLE_ACTIVE_DEPLOYMENT_REQUIRED')
  }

  const origin = `https://${target.workerName}.tranhuunguyenhuy.workers.dev`
  const runtime = await verifyRuntime({ fetchImpl, origin, sourceSha })
  return {
    status: 'ENVIRONMENT_WORKER_DEPLOYMENT_ACCEPTANCE_PASS',
    environment,
    workerName: target.workerName,
    origin,
    sourceSha,
    deploymentId: deployment.id,
    versionId: versions[0].version_id,
    trafficPercentage: versions[0].percentage,
    runtime,
  }
}

async function main() {
  const [environment, sourceSha] = process.argv.slice(2)
  const result = await verifyEnvironmentWorkerDeployment({
    environment,
    sourceSha,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    process.stderr.write(`ENVIRONMENT_WORKER_DEPLOYMENT_ACCEPTANCE_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}\n`)
    process.exitCode = 1
  })
}
