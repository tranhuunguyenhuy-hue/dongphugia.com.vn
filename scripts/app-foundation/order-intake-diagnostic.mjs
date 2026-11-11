import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const ACCOUNT_PREFIX = 'com.cloudflare.api.account.'
const WORKER_NAME_PREFIX = 'dongphugia-v1-public-preview'
const APPROVED_ACCOUNT_ID = 'd54f3402b9d112ab64d6135e0e3f1fb1'
const APPROVED_SUPABASE_INTAKE_URL = 'https://uybumsnyqpwcidjxmfsv.supabase.co/functions/v1/order-intake'
const ALLOWED_DIAGNOSTIC_STAGES = new Set([
  'configuration', 'signing', 'fetch', 'edge_status', 'decode', 'limiter', 'runtime',
])

const ALLOWED_TOKEN_PERMISSIONS = new Set([
  'Workers Scripts Write',
  'Workers Tail Read',
  'Account Settings Read',
  'Account API Tokens Read',
  'API Tokens Read',
])

function fail(code) {
  throw new Error(code)
}

export function buildOrderIntakeDiagnosticConfig(baseConfig, {
  pullRequestNumber,
  sourceSha,
  orderIntakeUrl,
  publishableKey,
}) {
  const prNumber = String(pullRequestNumber)
  if (!/^[1-9][0-9]*$/.test(prNumber)) fail('ORDER_DIAGNOSTIC_PR_INVALID')
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) fail('ORDER_DIAGNOSTIC_SHA_INVALID')
  if (orderIntakeUrl !== APPROVED_SUPABASE_INTAKE_URL) fail('ORDER_DIAGNOSTIC_INTAKE_TARGET_INVALID')
  if (typeof publishableKey !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
    fail('ORDER_DIAGNOSTIC_PUBLISHABLE_KEY_INVALID')
  }
  if (!baseConfig || typeof baseConfig !== 'object' || Array.isArray(baseConfig)) fail('ORDER_DIAGNOSTIC_BASE_CONFIG_INVALID')
  if (baseConfig.name !== WORKER_NAME_PREFIX || baseConfig.workers_dev !== false || baseConfig.preview_urls !== true) {
    fail('ORDER_DIAGNOSTIC_BASE_CONFIG_NOT_PREVIEW')
  }
  if (baseConfig.routes !== undefined || baseConfig.route !== undefined || baseConfig.custom_domains !== undefined) {
    fail('ORDER_DIAGNOSTIC_BASE_CONFIG_HAS_ROUTE')
  }
  if (!Array.isArray(baseConfig.ratelimits)
      || baseConfig.ratelimits.length !== 1
      || baseConfig.ratelimits[0]?.name !== 'ORDER_REQUEST_LIMITER') {
    fail('ORDER_DIAGNOSTIC_RATE_LIMITER_MISSING')
  }

  const workerName = `pr-${prNumber}-${WORKER_NAME_PREFIX}`
  const previewUrl = `https://${workerName}.tranhuunguyenhuy.workers.dev`
  const config = structuredClone(baseConfig)
  config.account_id = APPROVED_ACCOUNT_ID
  config.name = workerName
  config.workers_dev = true
  config.preview_urls = false
  config.vars = {
    ...config.vars,
    APP_ENV: 'preview',
    APP_BUILD_TARGET: 'public',
    APP_ORIGIN: previewUrl,
    PREVIEW_NOINDEX: 'true',
    PUBLIC_ORDER_INTAKE_URL: orderIntakeUrl,
    PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  }
  config.observability = {
    enabled: true,
    head_sampling_rate: 1,
    logs: {
      enabled: true,
      head_sampling_rate: 1,
      invocation_logs: false,
      persist: false,
    },
    traces: {
      enabled: false,
      persist: false,
    },
  }

  return { config, workerName, previewUrl, sourceSha }
}

function accountResourceIsExact(resources, accountId) {
  if (!resources || typeof resources !== 'object' || Array.isArray(resources)) return false
  const entries = Object.entries(resources)
  return entries.length > 0 && entries.every(([resource, value]) => (
    resource === `${ACCOUNT_PREFIX}${accountId}` && value === '*'
  ))
}

function selfUserResourceIsExact(resources) {
  if (!resources || typeof resources !== 'object' || Array.isArray(resources)) return false
  const entries = Object.entries(resources)
  return entries.length === 1
    && /^com\.cloudflare\.api\.user\.[a-f0-9]{32}$/i.test(entries[0][0])
    && entries[0][1] === '*'
}

export function attestPreviewTokenScope(accountId, details) {
  if (accountId !== APPROVED_ACCOUNT_ID) return { ok: false, reason: 'ACCOUNT_ID_NOT_APPROVED' }
  if (!details || details.status !== 'active') return { ok: false, reason: 'TOKEN_INACTIVE' }
  if (typeof details.provisioner_type !== 'string') return { ok: false, reason: 'TOKEN_PROVISIONER_TYPE_UNKNOWN' }
  if (/oauth/i.test(details.provisioner_type)) {
    return { ok: false, reason: 'OAUTH_TOKEN_NOT_ALLOWED' }
  }
  if (!/api.?token/i.test(details.provisioner_type)) return { ok: false, reason: 'TOKEN_PROVISIONER_TYPE_UNKNOWN' }

  const policies = details.policies
  if (!Array.isArray(policies) || policies.length === 0) return { ok: false, reason: 'TOKEN_POLICIES_MISSING' }

  let hasScriptsWrite = false
  let hasAccountSettingsRead = false
  for (const policy of policies) {
    if (!policy || !['allow', 'deny'].includes(policy.effect)) {
      return { ok: false, reason: 'TOKEN_POLICY_EFFECT_UNKNOWN' }
    }
    if (policy.effect === 'deny') continue
    const groupNames = (Array.isArray(policy.permission_groups) ? policy.permission_groups : [])
      .map((group) => group?.name)
      .filter((name) => typeof name === 'string')
    if (groupNames.some((name) => /(?:account )?api tokens write/i.test(name))) {
      return { ok: false, reason: 'TOKEN_API_TOKEN_WRITE_PRESENT' }
    }
    if (!groupNames.length || groupNames.some((name) => !ALLOWED_TOKEN_PERMISSIONS.has(name))) {
      return { ok: false, reason: 'TOKEN_HAS_UNRELATED_PERMISSION' }
    }

    const resources = policy.resources
    const userTokenRead = groupNames.every((name) => name === 'API Tokens Read')
      && selfUserResourceIsExact(resources)
    const accountTokenRead = groupNames.every((name) => name === 'Account API Tokens Read')
      && accountResourceIsExact(resources, accountId)
    const accountWorkerAccess = accountResourceIsExact(resources, accountId)
    if (!userTokenRead && !accountTokenRead && !accountWorkerAccess) {
      return { ok: false, reason: 'TOKEN_RESOURCE_SCOPE_NOT_EXACT' }
    }

    if (groupNames.includes('Workers Scripts Write')) {
      hasScriptsWrite = true
    }
    if (groupNames.includes('Account Settings Read')) hasAccountSettingsRead = true
  }

  if (!hasScriptsWrite) return { ok: false, reason: 'TOKEN_WORKER_WRITE_MISSING' }
  if (!hasAccountSettingsRead) return { ok: false, reason: 'TOKEN_ACCOUNT_SETTINGS_READ_MISSING' }
  return { ok: true, scope: 'PREVIEW_ACCOUNT_WORKER_WRITE_AND_TAIL_ONLY' }
}

export async function attestCloudflareCredential(accountId, token, fetcher = fetch) {
  if (accountId !== APPROVED_ACCOUNT_ID) return { ok: false, reason: 'ACCOUNT_ID_NOT_APPROVED' }
  if (!token || typeof token !== 'string') return { ok: false, reason: 'TOKEN_VALUE_MISSING' }
  const headers = { Authorization: `Bearer ${token}` }
  let verifyResponse
  try {
    verifyResponse = await fetcher('https://api.cloudflare.com/client/v4/user/tokens/verify', { headers })
  } catch {
    return { ok: false, reason: 'TOKEN_VERIFY_UNAVAILABLE' }
  }
  if (!verifyResponse.ok) return { ok: false, reason: 'TOKEN_VERIFY_DENIED' }

  let verification
  try {
    verification = await verifyResponse.json()
  } catch {
    return { ok: false, reason: 'TOKEN_VERIFY_RESPONSE_INVALID' }
  }
  const tokenId = verification?.result?.id
  if (verification?.success !== true || verification?.result?.status !== 'active'
      || typeof tokenId !== 'string' || !/^[a-f0-9]{32}$/i.test(tokenId)) {
    return { ok: false, reason: 'TOKEN_VERIFY_INACTIVE' }
  }

  let detailsResponse
  try {
    detailsResponse = await fetcher(`https://api.cloudflare.com/client/v4/user/tokens/${tokenId}`, { headers })
  } catch {
    return { ok: false, reason: 'TOKEN_SCOPE_DETAILS_UNAVAILABLE' }
  }
  if (!detailsResponse.ok) return { ok: false, reason: 'TOKEN_SCOPE_DETAILS_DENIED' }

  let details
  try {
    details = await detailsResponse.json()
  } catch {
    return { ok: false, reason: 'TOKEN_SCOPE_DETAILS_INVALID' }
  }
  if (details?.success !== true) return { ok: false, reason: 'TOKEN_SCOPE_DETAILS_INVALID' }
  return attestPreviewTokenScope(accountId, details.result)
}

export async function preflightOrderIntakeDiagnosticTarget({ accountId, token, workerName }, fetcher = fetch) {
  if (accountId !== APPROVED_ACCOUNT_ID || !token || typeof token !== 'string') {
    return { ok: false, reason: 'CLOUDFLARE_TARGET_ARGUMENT_INVALID' }
  }
  if (!/^pr-[1-9][0-9]*-dongphugia-v1-public-preview$/.test(workerName)) {
    return { ok: false, reason: 'CLOUDFLARE_TARGET_WORKER_INVALID' }
  }

  const headers = { Authorization: `Bearer ${token}` }
  const root = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers`
  let subdomainResponse
  let tailListResponse
  let targetResponse
  try {
    [subdomainResponse, tailListResponse, targetResponse] = await Promise.all([
      fetcher(`${root}/subdomain`, { headers }),
      fetcher(`${root}/scripts/${WORKER_NAME_PREFIX}/tails`, { headers }),
      fetcher(`${root}/scripts/${workerName}/settings`, { headers }),
    ])
  } catch {
    return { ok: false, reason: 'CLOUDFLARE_TARGET_PREFLIGHT_UNAVAILABLE' }
  }

  if (!subdomainResponse.ok || !tailListResponse.ok) {
    return { ok: false, reason: 'CLOUDFLARE_TARGET_READ_PERMISSION_MISSING' }
  }
  if (targetResponse.status !== 404) {
    return { ok: false, reason: targetResponse.ok ? 'CLOUDFLARE_TARGET_ALREADY_EXISTS' : 'CLOUDFLARE_TARGET_STATE_UNKNOWN' }
  }

  let subdomain
  let tailList
  try {
    [subdomain, tailList] = await Promise.all([subdomainResponse.json(), tailListResponse.json()])
  } catch {
    return { ok: false, reason: 'CLOUDFLARE_TARGET_RESPONSE_INVALID' }
  }
  if (subdomain?.success !== true || subdomain?.result?.subdomain !== 'tranhuunguyenhuy') {
    return { ok: false, reason: 'CLOUDFLARE_SUBDOMAIN_MISMATCH' }
  }
  if (tailList?.success !== true) return { ok: false, reason: 'CLOUDFLARE_TAIL_READ_NOT_CONFIRMED' }
  return { ok: true, workerName, previewUrl: `https://${workerName}.tranhuunguyenhuy.workers.dev` }
}

export async function cleanupOrderIntakeDiagnosticWorker({ accountId, token, workerName }, fetcher = fetch) {
  if (accountId !== APPROVED_ACCOUNT_ID || !token || typeof token !== 'string') {
    return { ok: false, reason: 'CLOUDFLARE_CLEANUP_ARGUMENT_INVALID' }
  }
  if (!/^pr-[1-9][0-9]*-dongphugia-v1-public-preview$/.test(workerName)) {
    return { ok: false, reason: 'CLOUDFLARE_CLEANUP_WORKER_INVALID' }
  }

  const headers = { Authorization: `Bearer ${token}` }
  const root = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`
  let tailsResponse
  try {
    tailsResponse = await fetcher(`${root}/tails`, { headers })
  } catch {
    return { ok: false, reason: 'CLOUDFLARE_CLEANUP_TAIL_LIST_UNAVAILABLE' }
  }

  if (tailsResponse.ok) {
    let tails
    try {
      tails = await tailsResponse.json()
    } catch {
      return { ok: false, reason: 'CLOUDFLARE_CLEANUP_TAIL_LIST_INVALID' }
    }
    if (tails?.success !== true || !(Array.isArray(tails.result) || (tails.result && typeof tails.result === 'object'))) {
      return { ok: false, reason: 'CLOUDFLARE_CLEANUP_TAIL_LIST_INVALID' }
    }
    const currentTails = Array.isArray(tails.result)
      ? tails.result
      : tails.result && typeof tails.result === 'object' ? [tails.result] : []
    for (const tail of currentTails) {
      if (typeof tail?.id !== 'string' || !/^[a-f0-9]{32}$/i.test(tail.id)) {
        return { ok: false, reason: 'CLOUDFLARE_CLEANUP_TAIL_ID_INVALID' }
      }
      let deleteTailResponse
      try {
        deleteTailResponse = await fetcher(`${root}/tails/${encodeURIComponent(tail.id)}`, {
          method: 'DELETE',
          headers,
        })
      } catch {
        return { ok: false, reason: 'CLOUDFLARE_CLEANUP_TAIL_DELETE_UNAVAILABLE' }
      }
      if (!deleteTailResponse.ok && deleteTailResponse.status !== 404) {
        return { ok: false, reason: 'CLOUDFLARE_CLEANUP_TAIL_DELETE_FAILED' }
      }
    }
  } else if (tailsResponse.status !== 404) {
    return { ok: false, reason: 'CLOUDFLARE_CLEANUP_TAIL_LIST_DENIED' }
  }

  let deleteWorkerResponse
  try {
    deleteWorkerResponse = await fetcher(root, { method: 'DELETE', headers })
  } catch {
    return { ok: false, reason: 'CLOUDFLARE_CLEANUP_WORKER_DELETE_UNAVAILABLE' }
  }
  if (!deleteWorkerResponse.ok && deleteWorkerResponse.status !== 404) {
    return { ok: false, reason: 'CLOUDFLARE_CLEANUP_WORKER_DELETE_FAILED' }
  }

  let stateResponse
  try {
    stateResponse = await fetcher(`${root}/settings`, { headers })
  } catch {
    return { ok: false, reason: 'CLOUDFLARE_CLEANUP_VERIFY_UNAVAILABLE' }
  }
  if (stateResponse.status !== 404) return { ok: false, reason: 'CLOUDFLARE_CLEANUP_VERIFY_FAILED' }
  return { ok: true, workerName, state: 'ABSENT', result: 'ORDER_DIAGNOSTIC_CLEANUP_PASS' }
}

function asHeaderMap(headerText) {
  const headers = new Map()
  for (const line of headerText.split(/\r?\n/)) {
    const separator = line.indexOf(':')
    if (separator <= 0) continue
    headers.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim())
  }
  return headers
}

function nestedValues(value, output = []) {
  if (typeof value === 'string') output.push(value)
  else if (Array.isArray(value)) value.forEach((item) => nestedValues(item, output))
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => nestedValues(item, output))
  return output
}

function balancedObjectAt(text, start) {
  let depth = 0
  let quoted = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') quoted = false
      continue
    }
    if (character === '"') quoted = true
    else if (character === '{') depth += 1
    else if (character === '}' && --depth === 0) return text.slice(start, index + 1)
  }
  return null
}

function diagnosticEventFromTail(rawTail, requestId) {
  const candidates = [rawTail]
  for (const line of rawTail.split(/\r?\n/)) {
    try {
      candidates.push(...nestedValues(JSON.parse(line)))
    } catch {
      candidates.push(line)
    }
  }

  for (const candidate of candidates) {
    if (!candidate.includes('PUBLIC_ORDER_INTAKE_DIAGNOSTIC')) continue
    const markerIndex = candidate.indexOf('PUBLIC_ORDER_INTAKE_DIAGNOSTIC')
    const suffix = candidate.slice(markerIndex).replace(/\\"/g, '"')
    const objectStart = suffix.indexOf('{')
    if (objectStart < 0) continue
    const objectText = balancedObjectAt(suffix, objectStart)
    if (!objectText) continue
    try {
      const event = JSON.parse(objectText)
      if (event.requestId === requestId) return event
    } catch {
      // Some Wrangler JSON lines embed the application JSON as an escaped string.
    }
  }
  return null
}

export function buildOrderIntakeDiagnosticEvidence({ sourceSha, httpStatus, headers, body, tail }) {
  const headerMap = asHeaderMap(headers)
  const requestId = headerMap.get('x-request-id')
  if (headerMap.get('x-dpg-source-sha') !== sourceSha) fail('ORDER_DIAGNOSTIC_SOURCE_SHA_MISMATCH')
  if (!/noindex/i.test(headerMap.get('x-robots-tag') ?? '')) fail('ORDER_DIAGNOSTIC_NOINDEX_MISSING')
  if (headerMap.get('cache-control') !== 'private, no-store') fail('ORDER_DIAGNOSTIC_CACHE_POLICY_INVALID')
  if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) fail('ORDER_DIAGNOSTIC_REQUEST_ID_MISSING')

  let payload
  try {
    payload = JSON.parse(body)
  } catch {
    fail('ORDER_DIAGNOSTIC_RESPONSE_INVALID_JSON')
  }

  const status = Number(httpStatus)
  if (status === 200 && payload?.data === null) {
    return { result: 'RECEIPT_PREFLIGHT_PASS', sourceSha, requestId, httpStatus: status }
  }

  if (status === 503 && payload?.error?.code === 'ORDER_INTAKE_UNAVAILABLE') {
    const event = diagnosticEventFromTail(tail, requestId)
    if (!event || event.operation !== 'receipt' || !ALLOWED_DIAGNOSTIC_STAGES.has(event.stage)) {
      fail('ORDER_DIAGNOSTIC_EVENT_NOT_CORRELATED')
    }
    if (event.upstreamStatus !== undefined
        && (!Number.isInteger(event.upstreamStatus) || event.upstreamStatus < 100 || event.upstreamStatus > 599)) {
      fail('ORDER_DIAGNOSTIC_UPSTREAM_STATUS_INVALID')
    }
    return {
      result: 'DIAGNOSTIC_CAPTURED',
      sourceSha,
      requestId,
      httpStatus: status,
      event: {
        operation: event.operation,
        stage: event.stage,
        ...(event.upstreamStatus === undefined ? {} : { upstreamStatus: event.upstreamStatus }),
      },
    }
  }

  fail('ORDER_DIAGNOSTIC_UNEXPECTED_RESPONSE')
}

async function run() {
  const [mode, ...arguments_] = process.argv.slice(2)
  const args = new Map()
  for (let index = 0; index < arguments_.length; index += 1) {
    if (!arguments_[index].startsWith('--')) fail('ORDER_DIAGNOSTIC_ARGUMENT_INVALID')
    args.set(arguments_[index].slice(2), arguments_[index + 1])
    index += 1
  }

  if (mode === 'prepare') {
    const baseConfig = JSON.parse(await readFile(args.get('base'), 'utf8'))
    const target = buildOrderIntakeDiagnosticConfig(baseConfig, {
      pullRequestNumber: args.get('pr-number'),
      sourceSha: args.get('source-sha'),
      orderIntakeUrl: process.env.PUBLIC_ORDER_INTAKE_URL,
      publishableKey: process.env.PREVIEW_SUPABASE_PUBLISHABLE_KEY,
    })
    await writeFile(args.get('output'), `${JSON.stringify(target.config, null, 2)}\n`, { mode: 0o600 })
    await writeFile(args.get('evidence'), `${JSON.stringify({ ...target, config: undefined })}\n`, 'utf8')
    process.stdout.write(`${JSON.stringify({ workerName: target.workerName, previewUrl: target.previewUrl, sourceSha: target.sourceSha })}\n`)
    return
  }

  if (mode === 'proof') {
    const evidence = buildOrderIntakeDiagnosticEvidence({
      sourceSha: args.get('source-sha'),
      httpStatus: await readFile(args.get('status'), 'utf8'),
      headers: await readFile(args.get('headers'), 'utf8'),
      body: await readFile(args.get('body'), 'utf8'),
      tail: await readFile(args.get('tail'), 'utf8'),
    })
    await writeFile(args.get('output'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
    process.stdout.write(`${JSON.stringify(evidence)}\n`)
    return
  }

  if (mode === 'attest-scope') {
    const result = await attestCloudflareCredential(args.get('account-id'), process.env.CLOUDFLARE_API_TOKEN)
    process.stdout.write(`${JSON.stringify({
      result: result.ok ? 'ORDER_DIAGNOSTIC_CREDENTIAL_SCOPE_PASS' : 'BLOCKED_BY_CREDENTIAL_SCOPE',
      reason: result.ok ? undefined : result.reason,
    })}\n`)
    if (process.env.GITHUB_OUTPUT) {
      await writeFile(process.env.GITHUB_OUTPUT, `result=${result.ok ? 'ORDER_DIAGNOSTIC_CREDENTIAL_SCOPE_PASS' : 'BLOCKED_BY_CREDENTIAL_SCOPE'}\nreason=${result.ok ? 'NONE' : result.reason}\n`, { flag: 'a' })
    }
    return
  }

  if (mode === 'preflight') {
    const result = await preflightOrderIntakeDiagnosticTarget({
      accountId: args.get('account-id'),
      token: process.env.CLOUDFLARE_API_TOKEN,
      workerName: args.get('worker-name'),
    })
    process.stdout.write(`${JSON.stringify({
      result: result.ok ? 'ORDER_DIAGNOSTIC_TARGET_PREFLIGHT_PASS' : 'BLOCKED_BY_TARGET_PREFLIGHT',
      reason: result.ok ? undefined : result.reason,
      ...(result.ok ? { workerName: result.workerName, previewUrl: result.previewUrl } : {}),
    })}\n`)
    if (process.env.GITHUB_OUTPUT) {
      await writeFile(process.env.GITHUB_OUTPUT, `result=${result.ok ? 'ORDER_DIAGNOSTIC_TARGET_PREFLIGHT_PASS' : 'BLOCKED_BY_TARGET_PREFLIGHT'}\nreason=${result.ok ? 'NONE' : result.reason}\n`, { flag: 'a' })
    }
    return
  }

  if (mode === 'cleanup') {
    const result = await cleanupOrderIntakeDiagnosticWorker({
      accountId: args.get('account-id'),
      token: process.env.CLOUDFLARE_API_TOKEN,
      workerName: args.get('worker-name'),
    })
    process.stdout.write(`${JSON.stringify(result)}\n`)
    if (!result.ok) fail(`ORDER_DIAGNOSTIC_${result.reason}`)
    return
  }

  fail('ORDER_DIAGNOSTIC_MODE_INVALID')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : 'ORDER_DIAGNOSTIC_FAILED')
    process.exitCode = 1
  })
}
