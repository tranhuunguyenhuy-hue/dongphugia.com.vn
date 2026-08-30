import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const API_ROOT = 'https://api.cloudflare.com/client/v4'
const RECOMMENDED_WORKER = 'dongphugia-v1-public-preview'
const PRODUCTION_HOSTNAMES = new Set([
  'dongphugia.vn',
  'www.dongphugia.vn',
  'admin.dongphugia.vn',
])
const NON_PRODUCTION_NAME = /(^|[-_.])(preview|staging|stage|test|dev|shadow|candidate)([-_.]|$)/i
const SAFE_BINDING_TYPES = new Set(['assets'])

function credentialState(value) {
  return value ? 'AVAILABLE' : 'UNAVAILABLE'
}

function apiStatus(response) {
  if (response.ok) return 'READ_OK'
  if (response.status === 401 || response.status === 403) return 'READ_DENIED'
  return 'READ_FAILED'
}

function errorCodes(body) {
  if (!body || !Array.isArray(body.errors)) return []
  return body.errors
    .map((error) => Number(error?.code))
    .filter((code) => Number.isInteger(code))
}

function hostnameFromPattern(pattern) {
  if (typeof pattern !== 'string') return ''
  const withoutScheme = pattern.replace(/^https?:\/\//i, '')
  return withoutScheme.split('/')[0].replace(/^\*\./, '').toLowerCase()
}

function isProductionAssociation(value) {
  const hostname = hostnameFromPattern(value)
  return PRODUCTION_HOSTNAMES.has(hostname) || hostname.endsWith('.dongphugia.vn')
}

function sanitizeBindings(settings) {
  const bindings = Array.isArray(settings?.bindings) ? settings.bindings : []
  return bindings.map((binding) => ({
    name: typeof binding?.name === 'string' ? binding.name : 'UNKNOWN',
    type: typeof binding?.type === 'string' ? binding.type : 'UNKNOWN',
  }))
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function planLabels(subscriptions) {
  return asArray(subscriptions).flatMap((subscription) => {
    const labels = [
      subscription?.rate_plan?.public_name,
      subscription?.rate_plan?.name,
      subscription?.component?.name,
    ]
    return labels.filter((label) => typeof label === 'string')
  })
}

export async function runDiscovery({ accountId, apiToken, sourceCommit = null, fetchImpl = fetch }) {
  const calls = []
  const credentials = {
    accountId: credentialState(accountId),
    apiToken: credentialState(apiToken),
  }

  const report = {
    contract: 'dongphugia:cloudflare-readonly-discovery:v1',
    mode: 'read-only',
    sourceCommit,
    credentials,
    recommendedWorker: RECOMMENDED_WORKER,
    calls,
    workers: [],
    pagesProjects: [],
    workersPlan: { status: 'UNKNOWN', labels: [], freeConfirmed: false },
    suitableIsolatedPublicWorker: null,
    createNewResourceRequired: null,
    productionAssociation: 'UNKNOWN',
  }

  if (!accountId || !apiToken) return report

  const headers = { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' }
  async function get(label, pathname) {
    let response
    try {
      response = await fetchImpl(`${API_ROOT}${pathname}`, { method: 'GET', headers })
    } catch {
      calls.push({ label, status: 'READ_FAILED', httpStatus: null, errorCodes: [] })
      return null
    }
    let body = null
    try {
      body = await response.json()
    } catch {
      // A malformed provider response is recorded without echoing response bytes.
    }
    const status = apiStatus(response)
    calls.push({ label, status, httpStatus: response.status, errorCodes: errorCodes(body) })
    return status === 'READ_OK' && body?.success !== false ? body?.result ?? null : null
  }

  const [scripts, workerDomains, subscriptions, accountSettings, zones] = await Promise.all([
    get('workers.scripts.list', `/accounts/${accountId}/workers/scripts`),
    get('workers.domains.list', `/accounts/${accountId}/workers/domains`),
    get('account.subscriptions.list', `/accounts/${accountId}/subscriptions`),
    get('workers.account-settings.get', `/accounts/${accountId}/workers/account-settings`),
    get('zones.list.dongphugia.vn', '/zones?name=dongphugia.vn'),
  ])

  const zone = asArray(zones)[0]
  const routes = zone?.id
    ? await get('workers.routes.list.dongphugia.vn', `/zones/${zone.id}/workers/routes`)
    : null

  const domainsByWorker = new Map()
  for (const domain of asArray(workerDomains)) {
    const workerName = domain?.service
    if (typeof workerName !== 'string') continue
    const existing = domainsByWorker.get(workerName) ?? []
    if (typeof domain?.hostname === 'string') existing.push(domain.hostname)
    domainsByWorker.set(workerName, existing)
  }
  const routesByWorker = new Map()
  for (const route of asArray(routes)) {
    const workerName = route?.script
    if (typeof workerName !== 'string') continue
    const existing = routesByWorker.get(workerName) ?? []
    if (typeof route?.pattern === 'string') existing.push(route.pattern)
    routesByWorker.set(workerName, existing)
  }

  for (const script of asArray(scripts)) {
    if (typeof script?.id !== 'string') continue
    const workerName = script.id
    const [subdomain, settings] = await Promise.all([
      get(`workers.subdomain.get:${workerName}`, `/accounts/${accountId}/workers/scripts/${encodeURIComponent(workerName)}/subdomain`),
      get(`workers.settings.get:${workerName}`, `/accounts/${accountId}/workers/scripts/${encodeURIComponent(workerName)}/settings`),
    ])
    const customDomains = (domainsByWorker.get(workerName) ?? []).sort()
    const workerRoutes = (routesByWorker.get(workerName) ?? []).sort()
    const bindings = sanitizeBindings(settings)
    const association = [...customDomains, ...workerRoutes].some(isProductionAssociation)
    report.workers.push({
      name: workerName,
      clearlyNonProduction: NON_PRODUCTION_NAME.test(workerName),
      workersDevEnabled: typeof subdomain?.enabled === 'boolean' ? subdomain.enabled : null,
      previewUrlsEnabled: typeof subdomain?.previews_enabled === 'boolean' ? subdomain.previews_enabled : null,
      customDomains,
      routes: workerRoutes,
      bindings,
      productionAssociation: association,
    })
  }
  report.workers.sort((left, right) => left.name.localeCompare(right.name))

  const pages = await get('pages.projects.list', `/accounts/${accountId}/pages/projects`)
  for (const project of asArray(pages)) {
    if (typeof project?.name !== 'string') continue
    const domains = await get(`pages.domains.list:${project.name}`, `/accounts/${accountId}/pages/projects/${encodeURIComponent(project.name)}/domains`)
    const hostnames = asArray(domains)
      .map((domain) => domain?.name)
      .filter((name) => typeof name === 'string')
      .sort()
    report.pagesProjects.push({
      name: project.name,
      clearlyNonProduction: NON_PRODUCTION_NAME.test(project.name),
      subdomain: typeof project?.subdomain === 'string' ? project.subdomain : null,
      customDomains: hostnames,
      productionAssociation: hostnames.some(isProductionAssociation),
    })
  }
  report.pagesProjects.sort((left, right) => left.name.localeCompare(right.name))

  const labels = planLabels(subscriptions)
  const freeConfirmed = labels.some((label) => /workers\s+free|free.*workers/i.test(label))
  const subscriptionCall = calls.find((call) => call.label === 'account.subscriptions.list')
  report.workersPlan = {
    status: subscriptionCall?.status === 'READ_OK' ? 'READ_OK' : 'UNKNOWN',
    labels,
    freeConfirmed,
    accountDefaultUsageModel: typeof accountSettings?.default_usage_model === 'string'
      ? accountSettings.default_usage_model
      : null,
  }

  const discoveryComplete = [
    'workers.scripts.list',
    'workers.domains.list',
    'workers.routes.list.dongphugia.vn',
    'pages.projects.list',
  ].every((label) => calls.some((call) => call.label === label && call.status === 'READ_OK'))

  const suitable = discoveryComplete
    ? report.workers.find((worker) => (
      worker.clearlyNonProduction &&
      worker.workersDevEnabled === false &&
      worker.previewUrlsEnabled === true &&
      worker.customDomains.length === 0 &&
      worker.routes.length === 0 &&
      worker.bindings.every((binding) => SAFE_BINDING_TYPES.has(binding.type)) &&
      !worker.productionAssociation
    ))
    : null

  report.suitableIsolatedPublicWorker = suitable?.name ?? null
  report.createNewResourceRequired = discoveryComplete ? !suitable : null
  report.productionAssociation = discoveryComplete
    ? (report.workers.some((worker) => worker.productionAssociation) || report.pagesProjects.some((project) => project.productionAssociation)
      ? 'PRESENT_ON_ACCOUNT_RESOURCES'
      : 'NONE_DISCOVERED')
    : 'UNKNOWN'
  return report
}

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument?.startsWith('--') || !argv[index + 1]) throw new Error('CLOUDFLARE_DISCOVERY_ARGUMENT_INVALID')
    args[argument.slice(2)] = argv[index + 1]
    index += 1
  }
  if (!args.output) throw new Error('CLOUDFLARE_DISCOVERY_OUTPUT_REQUIRED')
  if (!/^[0-9a-f]{40}$/.test(args['source-sha'] ?? '')) throw new Error('CLOUDFLARE_DISCOVERY_SOURCE_INVALID')
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const report = await runDiscovery({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    sourceCommit: args['source-sha'],
  })
  await writeFile(args.output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 })
  process.stdout.write(`${JSON.stringify(report)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`LEO563_CLOUDFLARE_READONLY_DISCOVERY_FAILED:${error.message}`)
    process.exitCode = 1
  })
}

export { RECOMMENDED_WORKER }
