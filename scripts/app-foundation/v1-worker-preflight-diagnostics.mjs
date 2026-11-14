import { readFileSync, writeFileSync } from 'node:fs'

const MAX_LOG_CHARS = 16_000
const MAX_BODY_CHARS = 2_000
const MAX_CURL_ERROR_CHARS = 2_000
const MAX_SMOKE_CHARS = 16_000
const MAX_HISTORY_LINES = 80
const MAX_RUNTIME_LOG_CHARS = 200_000
const MAX_RUNTIME_EVENTS = 128
const SAFE_SMOKE_ROUTES = new Set([
  'health', 'homepage', 'category', 'listing-shard', 'plp', 'search-api',
  'search-page', 'pdp', 'blog-index', 'blog-article', 'image',
])
const SAFE_SMOKE_CHECKS = new Set(['status', 'source_sha', 'set_cookie', 'content_type', 'network_request'])
const SAFE_SMOKE_BODY_CLASSES = new Set([
  'empty', 'html_error_page', 'known_application_error', 'json_error', 'other_error_body',
])
const SAFE_SMOKE_EXCERPTS = new Set([
  'public_configuration_rejected', 'database_temporarily_unavailable',
  'catalogue_temporarily_unavailable', 'internal_server_error', 'not_found',
  'public_database_unavailable', 'public_catalogue_unavailable',
  'public_product_db_row_invalid', 'public_database_binding_required',
])
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SAFE_SQL_STATES = /^[0-9A-Z]{5}$/
const SAFE_ERROR_CLASSES = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'OtherError'])
const SAFE_PUBLIC_ERROR_CODES = new Set([
  'PUBLIC_DATABASE_BINDING_REQUIRED', 'PUBLIC_DATABASE_MODE_DISABLED',
  'PUBLIC_DATABASE_READ_ONLY_REQUIRED', 'PUBLIC_PRODUCT_DB_ROW_INVALID',
  'PUBLIC_DATABASE_LISTING_TOO_LARGE', 'PUBLIC_DATABASE_SOURCE_ID_REQUIRED',
  'PUBLIC_DATABASE_LISTING_INVALID', 'PUBLIC_CATALOGUE_UNAVAILABLE',
  'PUBLIC_CATALOGUE_CHECKPOINT_MISMATCH',
])
const SAFE_RUNTIME_ROUTES = new Set([
  'health', 'homepage', 'category', 'listing-shard', 'plp', 'pdp', 'search', 'blog', 'other',
])
const SAFE_RENDER_FAILURES = new Set([
  'CROSS_REQUEST_IO', 'GLOBAL_SCOPE_IO', 'SUBREQUEST_LIMIT', 'CPU_LIMIT', 'MEMORY_LIMIT',
  'NO_RESPONSE', 'STREAM_CLOSED', 'BODY_USED', 'NETWORK_LOST', 'ASSET_UNAVAILABLE',
  'UNCLASSIFIED_EXCEPTION',
])
const SAFE_QUERY_TABLES = new Set([
  'products', 'categories', 'subcategories', 'brands', 'product_images', 'product_descriptions',
  'product_spec_values', 'spec_definitions', 'spec_options', 'product_documents',
  'product_feature_values', 'product_features', 'blog_posts', 'blog_categories',
  'blog_post_categories', 'blog_post_tags', 'tags',
])
const SAFE_RUNTIME_EVENT_NAMES = new Set([
  'PUBLIC_DATABASE_READ_OK', 'PUBLIC_DATABASE_READ_FAILURE', 'PUBLIC_LISTING_ROUTE_FAILURE',
  'PUBLIC_RENDER_HTTP_FAILURE', 'PUBLIC_RENDER_FAILURE',
])

function readOptional(path) {
  if (!path) return ''
  try { return readFileSync(path, 'utf8') } catch { return '' }
}

export function redactDiagnosticText(value, secretValues = []) {
  let text = String(value ?? '')
  for (const secret of secretValues.filter(Boolean).sort((a, b) => b.length - a.length)) {
    text = text.replaceAll(secret, '[REDACTED]')
  }
  return text
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/_-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\bpostgres(?:ql)?:\/\/[^\s"'<>\])}]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_JWT]')
    .replace(/(["']?(?:password|passwd|secret|token|api[_-]?key|authorization|client_secret|access_token|refresh_token)["']?\s*[:=]\s*["']?)[^\s"'&,}]+/gi, '$1[REDACTED]')
    .replace(/(https?:\/\/[^\s"'<>?]+\?[^\s"'<>]*)(?:\s|$)/gi, (match) => {
      const url = match.trimEnd()
      try {
        const parsed = new URL(url)
        for (const key of [...parsed.searchParams.keys()]) {
          if (/(?:token|secret|password|key|credential|auth)/i.test(key)) parsed.searchParams.set(key, '[REDACTED]')
        }
        return parsed.toString() + match.slice(url.length)
      } catch { return match }
    })
}

function sanitize(value, maxChars, secretValues) {
  const redacted = redactDiagnosticText(value, secretValues)
  return redacted.length > maxChars ? `${redacted.slice(-maxChars)}\n[truncated]` : redacted
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function parseSmokeHttpEvidence(raw) {
  const allowedContentTypes = new Set(['application/json', 'text/html', 'text/plain', 'image/*', 'other', 'missing'])
  const allowedLocations = new Set(['missing', 'same_origin', 'canonical_origin', 'approved_asset_origin', 'other_origin', 'invalid'])
  const result = []
  for (const line of String(raw ?? '').split(/\r?\n/)) {
    const prefix = 'PUBLIC_POSTGRES_SMOKE_HTTP '
    if (!line.startsWith(prefix) || result.length >= 48) continue
    try {
      const value = JSON.parse(line.slice(prefix.length))
      if (!value || !SAFE_SMOKE_ROUTES.has(value.route)
        || !(value.status === null || (Number.isInteger(value.status) && value.status >= 100 && value.status <= 599))
        || !allowedContentTypes.has(value.contentType)
        || typeof value.sourceShaMatches !== 'boolean' || typeof value.hasSetCookie !== 'boolean'
        || !allowedLocations.has(value.redirectLocation)
        || !Number.isInteger(value.elapsedMs) || value.elapsedMs < 0 || value.elapsedMs > 120_000
        || !Array.isArray(value.failedChecks) || !value.failedChecks.every(check => SAFE_SMOKE_CHECKS.has(check))) continue
      const record = {
        route: value.route,
        ...(typeof value.slug === 'string' && SAFE_SLUG.test(value.slug) ? { slug: value.slug } : {}),
        status: value.status,
        contentType: value.contentType,
        sourceShaMatches: value.sourceShaMatches,
        hasSetCookie: value.hasSetCookie,
        redirectLocation: value.redirectLocation,
        elapsedMs: value.elapsedMs,
        failedChecks: value.failedChecks,
      }
      if (SAFE_SMOKE_BODY_CLASSES.has(value.bodyClass)) record.bodyClass = value.bodyClass
      if (SAFE_SMOKE_EXCERPTS.has(value.safeBodyExcerpt)) record.safeBodyExcerpt = value.safeBodyExcerpt
      if (value.errorClass === 'request_timeout' || value.errorClass === 'network_error') record.errorClass = value.errorClass
      result.push(record)
    } catch { /* Only fully validated, safe smoke records are copied into diagnostics. */ }
  }
  return result
}

function parseSmokeBlogContent(raw) {
  const prefix = 'PUBLIC_POSTGRES_SMOKE_BLOG_CONTENT '
  for (const line of String(raw ?? '').split(/\r?\n/)) {
    if (!line.startsWith(prefix)) continue
    try {
      const value = JSON.parse(line.slice(prefix.length))
      if (!value || typeof value.mainFound !== 'boolean'
        || typeof value.publishedHeadingFound !== 'boolean'
        || typeof value.rawExactCountSubstringMatched !== 'boolean'
        || !(value.visibleCount === null || (Number.isInteger(value.visibleCount) && value.visibleCount >= 0 && value.visibleCount <= 100))
        || !(value.uniqueArticleCount === null || (Number.isInteger(value.uniqueArticleCount) && value.uniqueArticleCount >= 0 && value.uniqueArticleCount <= 100))) continue
      return {
        mainFound: value.mainFound,
        publishedHeadingFound: value.publishedHeadingFound,
        rawExactCountSubstringMatched: value.rawExactCountSubstringMatched,
        visibleCount: value.visibleCount,
        uniqueArticleCount: value.uniqueArticleCount,
      }
    } catch { /* Retain only a valid, fully allowlisted Blog acceptance record. */ }
  }
  return null
}

function removeSmokeEvidenceLines(raw) {
  return String(raw ?? '').split(/\r?\n/)
    .filter(line => !line.startsWith('PUBLIC_POSTGRES_SMOKE_HTTP ')
      && !line.startsWith('PUBLIC_POSTGRES_SMOKE_BLOG_CONTENT '))
    .join('\n')
}

function safeCount(value) {
  return Number.isInteger(value) && value >= 0 && value <= 128 ? value : undefined
}

function safeElapsed(value) {
  return Number.isInteger(value) && value >= 0 && value <= 120_000 ? value : undefined
}

function parseSafeRuntimeEvent(value) {
  if (!value || typeof value !== 'object' || !SAFE_RUNTIME_EVENT_NAMES.has(value.event)) return null
  const event = { event: value.event }
  if (value.event === 'PUBLIC_DATABASE_READ_OK' || value.event === 'PUBLIC_DATABASE_READ_FAILURE') {
    if (!Array.isArray(value.queryTables) || value.queryTables.length > SAFE_QUERY_TABLES.size
      || !value.queryTables.every(table => typeof table === 'string' && SAFE_QUERY_TABLES.has(table))
      || new Set(value.queryTables).size !== value.queryTables.length) return null
    event.queryTables = value.queryTables
    const elapsedMs = safeElapsed(value.elapsedMs)
    const activePgClients = safeCount(value.activePgClients)
    const peakPgClients = safeCount(value.peakPgClients)
    if (elapsedMs === undefined || activePgClients === undefined || peakPgClients === undefined) return null
    event.elapsedMs = elapsedMs
    event.activePgClients = activePgClients
    event.peakPgClients = peakPgClients
    if (value.event === 'PUBLIC_DATABASE_READ_FAILURE' && typeof value.sqlState === 'string' && SAFE_SQL_STATES.test(value.sqlState)) {
      event.sqlState = value.sqlState
    }
    return event
  }

  if (value.event === 'PUBLIC_LISTING_ROUTE_FAILURE') {
    if (!['metadata', 'render'].includes(value.stage)) return null
    event.stage = value.stage
    if (typeof value.categorySlug === 'string' && SAFE_SLUG.test(value.categorySlug)) event.categorySlug = value.categorySlug
    if (typeof value.subcategorySlug === 'string' && SAFE_SLUG.test(value.subcategorySlug)) event.subcategorySlug = value.subcategorySlug
    if (typeof value.errorClass === 'string' && SAFE_ERROR_CLASSES.has(value.errorClass)) event.errorClass = value.errorClass
    if (typeof value.publicErrorCode === 'string' && SAFE_PUBLIC_ERROR_CODES.has(value.publicErrorCode)) event.publicErrorCode = value.publicErrorCode
    if (typeof value.sqlState === 'string' && SAFE_SQL_STATES.test(value.sqlState)) event.sqlState = value.sqlState
    return event
  }

  if (value.event === 'PUBLIC_RENDER_HTTP_FAILURE') {
    if (!SAFE_RUNTIME_ROUTES.has(value.route) || !Number.isInteger(value.status) || value.status < 500 || value.status > 599) return null
    event.route = value.route
    event.status = value.status
    if (typeof value.categorySlug === 'string' && SAFE_SLUG.test(value.categorySlug)) event.categorySlug = value.categorySlug
    if (typeof value.subcategorySlug === 'string' && SAFE_SLUG.test(value.subcategorySlug)) event.subcategorySlug = value.subcategorySlug
    if (typeof value.productSlug === 'string' && SAFE_SLUG.test(value.productSlug)) event.productSlug = value.productSlug
    if (['text/html', 'application/json', 'text/plain', 'image/*', 'other', 'missing'].includes(value.contentTypeClass)) {
      event.contentTypeClass = value.contentTypeClass
    }
    if (typeof value.hasRenderFailureMarker === 'boolean') event.hasRenderFailureMarker = value.hasRenderFailureMarker
    if (typeof value.renderFailure === 'string' && SAFE_RENDER_FAILURES.has(value.renderFailure)) event.renderFailure = value.renderFailure
    return event
  }

  if (typeof value.category === 'string' && SAFE_RENDER_FAILURES.has(value.category)) event.category = value.category
  else return null
  return event
}

export function parseSafeRuntimeEvents(raw) {
  const lines = String(raw ?? '').slice(-MAX_RUNTIME_LOG_CHARS).split(/\r?\n/)
  const result = []
  for (const line of lines) {
    if (result.length >= MAX_RUNTIME_EVENTS || ![...SAFE_RUNTIME_EVENT_NAMES].some(name => line.includes(name))) continue
    const start = line.indexOf('{')
    if (start < 0) continue
    try {
      const event = parseSafeRuntimeEvent(JSON.parse(line.slice(start)))
      if (event) result.push(event)
    } catch { /* Only parseable, allowlisted Worker diagnostics are retained. */ }
  }
  return result
}

function removeRuntimeEventLines(raw) {
  const names = [...SAFE_RUNTIME_EVENT_NAMES]
  return String(raw ?? '').split(/\r?\n/)
    .filter(line => !names.some(name => line.includes(name)))
    .join('\n')
}

function parseHeaders(raw, secretValues) {
  const safe = {}
  const allow = new Set(['content-type', 'server', 'cf-ray', 'x-dpg-source-sha', 'x-dpg-render-failure', 'retry-after'])
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([^:]+):\s*(.*)$/)
    if (!match) continue
    const name = match[1].toLowerCase()
    if (allow.has(name)) safe[name] = sanitize(match[2], 300, secretValues)
  }
  return safe
}

function classify({ state, headers, body, wranglerLog, curlError }) {
  const status = String(state.lastHttpStatus ?? '000')
  const code = Number(status)
  const logAndBody = `${wranglerLog}\n${body}\n${curlError}`

  if (/\b(?:1101|1102)\b|worker threw exception|exception while handling request|uncaught exception/i.test(body)) {
    return 'worker_runtime_http_error'
  }
  if (code >= 400 && (headers['x-dpg-source-sha'] || headers['x-dpg-render-failure']
    || /Public configuration rejected|Database temporarily unavailable|Catalogue temporarily unavailable/i.test(body))) {
    return 'public_application_http_error'
  }
  if (/(?:failed|error|unable|denied|timed out|forbidden)[^\n]{0,180}(?:remote|preview|session|workers? script)|(?:remote|preview|session|workers? script)[^\n]{0,180}(?:failed|error|unauthorized|forbidden|timed out)/i.test(logAndBody)) {
    return 'wrangler_remote_dev_session_error'
  }
  if (state.stage === 'smoke') return 'public_postgres_smoke_failure'
  if (!state.workerAlive && state.workerExitCode !== null && state.workerExitCode !== undefined) {
    return 'wrangler_dev_process_exit'
  }
  if (code === 0 || status === '000') {
    if (/ready on|listening on/i.test(wranglerLog)) return 'local_readiness_transport_error'
    return 'wrangler_remote_dev_startup_timeout'
  }
  if (code >= 500) return 'worker_or_application_http_5xx'
  if (code >= 400) return 'remote_http_error_without_application_marker'
  if (code >= 200 && code < 300 && state.stage === 'readiness') return 'application_health_contract_or_smoke_failure'
  return 'preflight_failure_unclassified'
}

export function buildPreflightDiagnostics(input, secretValues = []) {
  const state = input.state ?? {}
  const headers = parseHeaders(input.headers ?? '', secretValues)
  const body = sanitize(input.body ?? '', MAX_BODY_CHARS, secretValues)
  const wranglerLog = sanitize(removeRuntimeEventLines(input.wranglerLog ?? ''), MAX_LOG_CHARS, secretValues)
  const runtimeEvents = parseSafeRuntimeEvents(input.wranglerLog ?? '')
  const curlError = sanitize(input.curlError ?? '', MAX_CURL_ERROR_CHARS, secretValues)
  const smokeOutput = sanitize(removeSmokeEvidenceLines(input.smokeOutput ?? ''), MAX_SMOKE_CHARS, secretValues)
  const publicHttpRequests = parseSmokeHttpEvidence(input.smokeOutput ?? '')
  const publicBlogContent = parseSmokeBlogContent(input.smokeOutput ?? '')
  const history = sanitize((input.history ?? '').split(/\r?\n/).filter(Boolean).slice(-MAX_HISTORY_LINES).join('\n'), 4_000, secretValues)
  const summary = {
    classification: classify({ state, headers, body, wranglerLog, curlError }),
    evidence: {
      stage: state.stage ?? 'unknown',
      attempts: optionalNumber(state.attempts),
      elapsedMs: optionalNumber(state.elapsedMs),
      lastHttpStatus: String(state.lastHttpStatus ?? 'unknown'),
      lastAttemptStatus: String(state.lastAttemptStatus ?? 'unknown'),
      curlExitCode: optionalNumber(state.curlExitCode),
      workerAlive: typeof state.workerAlive === 'boolean' ? state.workerAlive : null,
      workerExitCode: optionalNumber(state.workerExitCode),
      smokeExitCode: optionalNumber(state.smokeExitCode),
      responseHeaders: headers,
      responseExcerpt: body,
      curlError,
      smokeOutput,
      publicHttpRequests,
      publicBlogContent,
      runtimeEvents,
      httpHistory: history,
      wranglerLogTail: wranglerLog,
    },
  }
  return summary
}

function usage() {
  throw new Error('Usage: node v1-worker-preflight-diagnostics.mjs <directory> <output.json>')
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const [directory, outputPath] = process.argv.slice(2)
  if (!directory || !outputPath) usage()
  let state = {}
  try { state = JSON.parse(readOptional(`${directory}/state.json`)) } catch { /* Preserve a useful partial report. */ }
  const secretValues = [
    process.env.CLOUDFLARE_API_TOKEN,
    process.env.CLOUDFLARE_API_KEY,
    process.env.PREFLIGHT_TOKEN,
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.HYPERDRIVE_CONNECTION_STRING,
  ]
  const result = buildPreflightDiagnostics({
    state,
    headers: readOptional(`${directory}/response.headers`),
    body: readOptional(`${directory}/response.body`),
    curlError: readOptional(`${directory}/curl.stderr`),
    history: readOptional(`${directory}/http-history.tsv`),
    smokeOutput: readOptional(`${directory}/smoke.log`),
    wranglerLog: readOptional(`${directory}/wrangler.log`),
  }, secretValues)
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 })
  const summary = [
    '### Packaged Public Worker preflight diagnostics',
    '',
    `- Classification: \`${result.classification}\``,
    `- Stage: \`${result.evidence.stage}\`; last HTTP response: \`${result.evidence.lastHttpStatus}\`; final probe: \`${result.evidence.lastAttemptStatus}\`; attempts: \`${result.evidence.attempts ?? 'unknown'}\``,
    `- Wrangler process alive at failure: \`${result.evidence.workerAlive ?? 'unknown'}\`; exit code: \`${result.evidence.workerExitCode ?? 'unknown'}\``,
    `- Safe Worker runtime events: \`${result.evidence.runtimeEvents.length}\`; PostgreSQL read failures: \`${result.evidence.runtimeEvents.filter(event => event.event === 'PUBLIC_DATABASE_READ_FAILURE').length}\`; SQLSTATE: \`${[...new Set(result.evidence.runtimeEvents.map(event => event.sqlState).filter(Boolean))].join(', ') || 'none recorded'}\`; peak reported DB clients: \`${Math.max(0, ...result.evidence.runtimeEvents.map(event => event.peakPgClients ?? event.activePgClients ?? 0))}\`.`,
    `- Blog content evidence: \`${JSON.stringify(result.evidence.publicBlogContent ?? 'not recorded')}\`.`,
    '- Allowlisted Worker events, sanitized Wrangler log tail, response excerpt, curl error, and bounded HTTP history are attached as a short-retention artifact.',
    '- Raw Wrangler logs and raw response data are not uploaded.',
  ].join('\n') + '\n'
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' })
}
