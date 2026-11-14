import { describe, expect, it } from 'vitest'
import { buildPreflightDiagnostics, parseSafeRuntimeEvents, redactDiagnosticText } from './v1-worker-preflight-diagnostics.mjs'

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
      state: { stage: 'readiness', lastHttpStatus: '503', lastAttemptStatus: '000', workerAlive: true, workerExitCode: null },
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
    expect(application.evidence.lastAttemptStatus).toBe('000')
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

  it('preserves bounded route-level smoke evidence while dropping unrecognized data', () => {
    const safeRecord = {
      route: 'plp', slug: 'bon-cau', status: 500, contentType: 'text/html',
      sourceShaMatches: true, hasSetCookie: false, redirectLocation: 'missing',
      elapsedMs: 5333, failedChecks: ['status'], bodyClass: 'html_error_page',
      safeBodyExcerpt: 'internal_server_error', privateBody: 'customer data',
    }
    const result = buildPreflightDiagnostics({
      state: { stage: 'smoke', lastHttpStatus: '200', workerAlive: true },
      smokeOutput: `PUBLIC_POSTGRES_SMOKE_HTTP ${JSON.stringify(safeRecord)}`,
    })

    expect(result.evidence.publicHttpRequests).toEqual([{
      route: 'plp', slug: 'bon-cau', status: 500, contentType: 'text/html',
      sourceShaMatches: true, hasSetCookie: false, redirectLocation: 'missing',
      elapsedMs: 5333, failedChecks: ['status'], bodyClass: 'html_error_page',
      safeBodyExcerpt: 'internal_server_error',
    }])
    expect(JSON.stringify(result.evidence.publicHttpRequests)).not.toContain('customer data')
  })

  it('retains only allowlisted Blog content signals in the preflight artifact', () => {
    const blogRecord = {
      mainFound: true, publishedHeadingFound: true, rawExactCountSubstringMatched: false,
      visibleCount: 10, uniqueArticleCount: 10,
      renderedHtml: 'private Blog contents', title: 'untrusted extra field',
    }
    const result = buildPreflightDiagnostics({
      state: { stage: 'smoke', lastHttpStatus: '200', workerAlive: true },
      smokeOutput: `PUBLIC_POSTGRES_SMOKE_BLOG_CONTENT ${JSON.stringify(blogRecord)}\nPUBLIC_POSTGRES_SMOKE_BLOG_INDEX private body`,
    })

    expect(result.evidence.publicBlogContent).toEqual({
      mainFound: true, publishedHeadingFound: true, rawExactCountSubstringMatched: false,
      visibleCount: 10, uniqueArticleCount: 10,
    })
    expect(result.evidence.smokeOutput).toContain('PUBLIC_POSTGRES_SMOKE_BLOG_INDEX')
    expect(result.evidence.smokeOutput).not.toContain('PUBLIC_POSTGRES_SMOKE_BLOG_CONTENT')
    expect(JSON.stringify(result)).not.toContain('private Blog contents')
    expect(JSON.stringify(result)).not.toContain('untrusted extra field')

    const invalid = buildPreflightDiagnostics({
      state: { stage: 'smoke' },
      smokeOutput: 'PUBLIC_POSTGRES_SMOKE_BLOG_CONTENT {"mainFound":true,"publishedHeadingFound":true,"rawExactCountSubstringMatched":false,"visibleCount":101,"uniqueArticleCount":10}',
    })
    expect(invalid.evidence.publicBlogContent).toBeNull()
  })

  it('retains only bounded image-origin TLS evidence and drops raw URLs and error text', () => {
    const imageRecord = {
      source: 'product', host: 'hita.com.vn', finalHostClass: 'missing', status: null,
      contentType: 'missing', errorClass: 'tls_error', tlsCode: 'ERR_SSL_DH_KEY_TOO_SMALL',
      url: 'https://hita.com.vn/private/customer-image.jpg', rawError: 'TLS secret details',
    }
    const result = buildPreflightDiagnostics({
      state: { stage: 'smoke' },
      smokeOutput: `PUBLIC_POSTGRES_SMOKE_IMAGE_FAILURE ${JSON.stringify(imageRecord)}\nPUBLIC_POSTGRES_SMOKE_IMAGE other failure`,
    })

    expect(result.evidence.publicImageFailures).toEqual([{
      source: 'product', host: 'hita.com.vn', finalHostClass: 'missing', status: null,
      contentType: 'missing', errorClass: 'tls_error', tlsCode: 'ERR_SSL_DH_KEY_TOO_SMALL',
    }])
    expect(result.evidence.smokeOutput).toContain('PUBLIC_POSTGRES_SMOKE_IMAGE other failure')
    expect(result.evidence.smokeOutput).not.toContain('PUBLIC_POSTGRES_SMOKE_IMAGE_FAILURE')
    expect(JSON.stringify(result)).not.toContain('/private/customer-image.jpg')
    expect(JSON.stringify(result)).not.toContain('TLS secret details')
  })

  it('retains only allowlisted Worker database and PLP events in the artifact', () => {
    const rawEvents = [
      JSON.stringify({
        event: 'PUBLIC_DATABASE_READ_FAILURE', queryTables: ['brands', 'products'],
        elapsedMs: 5001, activePgClients: 6, peakPgClients: 6, sqlState: '53300',
        sql: 'SELECT customer email', connectionString: 'postgresql://reader:private@db.invalid/postgres',
      }),
      JSON.stringify({
        event: 'PUBLIC_LISTING_ROUTE_FAILURE', stage: 'render', categorySlug: 'thiet-bi-ve-sinh',
        subcategorySlug: 'bon-cau', errorClass: 'Error', publicErrorCode: 'PUBLIC_CATALOGUE_UNAVAILABLE',
        sqlState: '53300', message: 'customer@example.test',
      }),
      JSON.stringify({
        event: 'PUBLIC_RENDER_HTTP_FAILURE', route: 'plp', categorySlug: 'thiet-bi-ve-sinh',
        subcategorySlug: 'bon-cau', status: 500, contentTypeClass: 'text/html',
        hasRenderFailureMarker: false, rawBody: 'private customer data',
      }),
    ].map(line => `[wrangler:log] ${line}`).join('\n')
    const events = parseSafeRuntimeEvents(rawEvents)
    const result = buildPreflightDiagnostics({
      state: { stage: 'smoke', lastHttpStatus: '200', workerAlive: true },
      wranglerLog: `ready on http://127.0.0.1:8793\n${rawEvents}`,
    })

    expect(events).toEqual([
      { event: 'PUBLIC_DATABASE_READ_FAILURE', queryTables: ['brands', 'products'], elapsedMs: 5001,
        activePgClients: 6, peakPgClients: 6, sqlState: '53300' },
      { event: 'PUBLIC_LISTING_ROUTE_FAILURE', stage: 'render', categorySlug: 'thiet-bi-ve-sinh',
        subcategorySlug: 'bon-cau', errorClass: 'Error', publicErrorCode: 'PUBLIC_CATALOGUE_UNAVAILABLE', sqlState: '53300' },
      { event: 'PUBLIC_RENDER_HTTP_FAILURE', route: 'plp', status: 500, categorySlug: 'thiet-bi-ve-sinh',
        subcategorySlug: 'bon-cau', contentTypeClass: 'text/html', hasRenderFailureMarker: false },
    ])
    expect(result.evidence.runtimeEvents).toEqual(events)
    expect(result.evidence.wranglerLogTail).toContain('ready on')
    expect(JSON.stringify(result)).not.toContain('customer@example.test')
    expect(JSON.stringify(result)).not.toContain('private customer data')
    expect(JSON.stringify(result)).not.toContain('postgresql://reader')
    expect(JSON.stringify(result)).not.toContain('SELECT customer')
  })
})
