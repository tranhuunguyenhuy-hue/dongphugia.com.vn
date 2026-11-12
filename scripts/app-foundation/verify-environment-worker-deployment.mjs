const ACCOUNT_ID = 'd54f3402b9d112ab64d6135e0e3f1fb1'
const SUBDOMAIN = 'tranhuunguyenhuy'
const ENVIRONMENTS = {
  preview: { workerName: 'dpg-preview' },
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

async function verifyRuntime({ fetchImpl = fetch, origin, sourceSha }) {
  const publicResponse = await fetchChecked(fetchImpl, `${origin}/`, { cache: 'no-store' }, 200, sourceSha, 'public')
  const publicHtml = await publicResponse.text()
  if (!publicHtml.includes('Dữ liệu minh họa') || !publicHtml.includes('fixture kiểm thử')) {
    fail('ENVIRONMENT_WORKER_RUNTIME_SYNTHETIC_PUBLIC_FIXTURE_MISSING')
  }
  if (/(SUPABASE_SERVICE_ROLE_KEY|AUTH_ADMIN_SECRET|DATABASE_URL|staff_context)/i.test(publicHtml)) {
    fail('ENVIRONMENT_WORKER_RUNTIME_PUBLIC_PRIVILEGED_STATE_EXPOSED')
  }

  const adminResponse = await fetchChecked(fetchImpl, `${origin}/admin/login`, { cache: 'no-store' }, 200, sourceSha, 'admin')
  if (adminResponse.headers.get('cache-control')?.toLowerCase().includes('private') !== true) {
    fail('ENVIRONMENT_WORKER_RUNTIME_ADMIN_CACHE_NOT_PRIVATE')
  }
  const adminHtml = await adminResponse.text()
  if (!adminHtml.includes('name="email"') || !adminHtml.includes('name="password"')
    || !adminHtml.includes('href="/admin/forgot-password"')) {
    fail('ENVIRONMENT_WORKER_RUNTIME_ADMIN_LOGIN_INVALID')
  }
  const cssPath = adminHtml.match(/href="(\/admin\/_next\/static\/[^" ]+\.css)"/)?.[1]
  if (!cssPath) fail('ENVIRONMENT_WORKER_RUNTIME_ADMIN_CSS_MOUNT_MISSING')
  const cssResponse = await fetchChecked(fetchImpl, new URL(cssPath, origin), { cache: 'no-store' }, 200, sourceSha, 'admin')
  if (!cssResponse.headers.get('content-type')?.toLowerCase().includes('text/css')) {
    fail('ENVIRONMENT_WORKER_RUNTIME_ADMIN_CSS_CONTENT_TYPE_INVALID')
  }

  const protectedResponse = await fetchChecked(fetchImpl, `${origin}/admin`, { cache: 'no-store' }, 307, sourceSha, 'admin')
  const protectedLocation = new URL(protectedResponse.headers.get('location') || '', origin)
  if (protectedLocation.origin !== origin || protectedLocation.pathname !== '/admin/login') {
    fail('ENVIRONMENT_WORKER_RUNTIME_ADMIN_AUTH_REDIRECT_INVALID')
  }

  const healthResponse = await fetchChecked(fetchImpl, `${origin}/admin/api/health`, { cache: 'no-store' }, 200, sourceSha, 'admin')
  if (healthResponse.headers.get('cache-control')?.toLowerCase().includes('private') !== true) {
    fail('ENVIRONMENT_WORKER_RUNTIME_ADMIN_HEALTH_CACHE_NOT_PRIVATE')
  }
  const health = await healthResponse.json()
  if (health.application !== 'admin' || health.status !== 'ok') fail('ENVIRONMENT_WORKER_RUNTIME_ADMIN_HEALTH_INVALID')

  return {
    public: { status: publicResponse.status, sha: sourceSha, noindex: true, dataMode: 'synthetic-fixtures' },
    admin: { status: adminResponse.status, cssStatus: cssResponse.status, healthStatus: healthResponse.status, noindex: true },
    unauthorizedAdmin: { status: protectedResponse.status, destination: protectedLocation.pathname },
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

  const origin = `https://${target.workerName}.${SUBDOMAIN}.workers.dev`
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
