import { describe, expect, it } from 'vitest'
import { buildPreflightDiagnostics, redactDiagnosticText } from './v1-worker-preflight-diagnostics.mjs'

describe('V1 packaged Worker preflight diagnostics', () => {
  it('redacts credentials, bearer tokens, database URLs, JWTs, and labeled secrets', () => {
    const jwt = 'eyJabcdefgh.eyJpayload.eyJsignature'
    const text = 'Authorization: Bearer cf-token-123456 password="private-value" url=postgresql://reader:private@db.invalid/postgres jwt=' + jwt
    const result = redactDiagnosticText(text, ['cf-token-123456'])

    expect(result).not.toContain('cf-token-123456')
    expect(result).not.toContain('private-value')
    expect(result).not.toContain('reader:private')
    expect(result).not.toContain(jwt)
    expect(result).toContain('[REDACTED]')
    expect(result).toContain('[REDACTED_DATABASE_URL]')
  })

  it('classifies a Cloudflare Worker runtime exception separately from an application response', () => {
    const runtime = buildPreflightDiagnostics({
      state: { stage: 'readiness', lastHttpStatus: '500', workerAlive: true, workerExitCode: null },
      body: 'Error 1101: Worker threw exception',
    })
    const application = buildPreflightDiagnostics({
      state: { stage: 'readiness', lastHttpStatus: '503', workerAlive: true, workerExitCode: null },
      headers: 'HTTP/1.1 503 Service Unavailable\r\nx-dpg-source-sha: ' + 'a'.repeat(40) + '\r\ncontent-type: application/json\r\n',
      body: '{"status":"error","code":"PUBLIC_DATABASE_UNAVAILABLE"}',
    })
    const applicationConfig = buildPreflightDiagnostics({
      state: { stage: 'readiness', lastHttpStatus: '503', workerAlive: true, workerExitCode: null },
      body: 'Public configuration rejected.',
    })

    expect(runtime.classification).toBe('worker_runtime_http_error')
    expect(application.classification).toBe('public_application_http_error')
    expect(applicationConfig.classification).toBe('public_application_http_error')
    expect(application.evidence.workerExitCode).toBeNull()
  })

  it('classifies an explicit remote session failure and an unresolved no-listener timeout separately', () => {
    const remote = buildPreflightDiagnostics({
      state: { stage: 'readiness', lastHttpStatus: '000', workerAlive: false, workerExitCode: 1 },
      wranglerLog: 'Error: Failed to create remote preview session: HTTP 403',
    })
    const timeout = buildPreflightDiagnostics({
      state: { stage: 'readiness', lastHttpStatus: '000', workerAlive: true, workerExitCode: null },
      curlError: 'curl: (7) Failed to connect to 127.0.0.1 port 8793',
    })

    expect(remote.classification).toBe('wrangler_remote_dev_session_error')
    expect(timeout.classification).toBe('wrangler_remote_dev_startup_timeout')
    expect(timeout.evidence.lastHttpStatus).toBe('000')
  })

  it('bounds collected log and response evidence', () => {
    const result = buildPreflightDiagnostics({
      state: { stage: 'readiness', lastHttpStatus: '500' },
      body: 'x'.repeat(10_000),
      wranglerLog: 'y'.repeat(100_000),
    })

    expect(result.evidence.responseExcerpt.length).toBeLessThanOrEqual(2_020)
    expect(result.evidence.wranglerLogTail.length).toBeLessThanOrEqual(16_020)
    expect(result.evidence.responseExcerpt).toContain('[truncated]')
  })
})
