import { readFileSync, writeFileSync } from 'node:fs'

const MAX_LOG_CHARS = 16_000
const MAX_BODY_CHARS = 2_000
const MAX_CURL_ERROR_CHARS = 2_000
const MAX_SMOKE_CHARS = 2_000
const MAX_HISTORY_LINES = 80

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
  const wranglerLog = sanitize(input.wranglerLog ?? '', MAX_LOG_CHARS, secretValues)
  const curlError = sanitize(input.curlError ?? '', MAX_CURL_ERROR_CHARS, secretValues)
  const smokeOutput = sanitize(input.smokeOutput ?? '', MAX_SMOKE_CHARS, secretValues)
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
    '- Sanitized Wrangler log tail, response excerpt, curl error, and bounded HTTP history are attached as a short-retention artifact.',
    '- Raw Wrangler logs and raw response data are not uploaded.',
  ].join('\n') + '\n'
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' })
}
