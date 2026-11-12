import { describe, expect, it } from 'vitest'

import {
  attestCloudflareCredential,
  attestPreviewTokenScope,
  buildOrderIntakeDiagnosticConfig,
  buildOrderIntakeDiagnosticEvidence,
  cleanupOrderIntakeDiagnosticWorker,
  preflightOrderIntakeDiagnosticTarget,
} from './order-intake-diagnostic.mjs'

const accountId = 'd54f3402b9d112ab64d6135e0e3f1fb1'
const tokenId = 'abcdef0123456789abcdef0123456789'
const orderIntakeUrl = 'https://uybumsnyqpwcidjxmfsv.supabase.co/functions/v1/order-intake'
const publishableKey = 'sb_publishable_synthetic_public_preview_key'
const sourceSha = '434cb72ea453d384148255f9f1cbbf3e530f6098'
const requestId = 'f63e7dc2-44c9-4a9d-86de-a7f073a92703'
const workerName = 'pr-291-dongphugia-v1-public-preview'

function baseConfig() {
  return {
    name: 'dongphugia-v1-public-preview',
    workers_dev: false,
    preview_urls: true,
    main: 'worker/index.js',
    assets: { directory: 'assets', binding: 'ASSETS' },
    vars: {
      APP_ENV: 'preview',
      APP_BUILD_TARGET: 'public',
      APP_ORIGIN: 'https://public-preview.invalid',
      PREVIEW_NOINDEX: 'true',
    },
    ratelimits: [{ name: 'ORDER_REQUEST_LIMITER', namespace_id: '2910290', simple: { limit: 10, period: 60 } }],
  }
}

function permittedTokenDetails() {
  return {
    id: tokenId,
    status: 'active',
    provisioner_type: 'com.cloudflare.api.apitoken',
    policies: [
      {
        effect: 'allow',
        resources: { [`com.cloudflare.api.account.${accountId}`]: '*' },
        permission_groups: [
          { name: 'Workers Scripts Write' },
          { name: 'Account Settings Read' },
        ],
      },
      {
        effect: 'allow',
        resources: { 'com.cloudflare.api.user.0123456789abcdef0123456789abcdef': '*' },
        permission_groups: [{ name: 'API Tokens Read' }],
      },
    ],
  }
}

function permittedAccountOwnedTokenDetails() {
  return {
    id: tokenId,
    status: 'active',
    policies: [
      {
        effect: 'allow',
        resources: { [`com.cloudflare.api.account.${accountId}`]: '*' },
        permission_groups: [
          { name: 'Workers Scripts Write' },
          { name: 'Account Settings Read' },
        ],
      },
      {
        effect: 'allow',
        resources: { [`com.cloudflare.api.account.${accountId}`]: '*' },
        permission_groups: [{ name: 'Account API Tokens Read' }],
      },
    ],
  }
}

describe('order intake diagnostic Worker preparation', () => {
  it('creates a separate noindex workers.dev Worker with nonpersistent logs only', () => {
    const original = baseConfig()
    const result = buildOrderIntakeDiagnosticConfig(original, {
      pullRequestNumber: '291', sourceSha, orderIntakeUrl, publishableKey,
    })

    expect(result.workerName).toBe(workerName)
    expect(result.previewUrl).toBe('https://pr-291-dongphugia-v1-public-preview.tranhuunguyenhuy.workers.dev')
    expect(result.sourceSha).toBe(sourceSha)
    expect(result.config.name).not.toBe(original.name)
    expect(result.config.workers_dev).toBe(true)
    expect(result.config.preview_urls).toBe(false)
    expect(result.config.routes).toBeUndefined()
    expect(result.config.route).toBeUndefined()
    expect(result.config.custom_domains).toBeUndefined()
    expect(result.config.vars.APP_ORIGIN).toBe(result.previewUrl)
    expect(result.config.vars.PREVIEW_NOINDEX).toBe('true')
    expect(result.config.vars.PUBLIC_ORDER_INTAKE_URL).toBe(orderIntakeUrl)
    expect(result.config.vars.PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe(publishableKey)
    expect(result.config.account_id).toBe(accountId)
    expect(result.config.ratelimits).toEqual(original.ratelimits)
    expect(result.config.observability).toEqual({
      enabled: true,
      head_sampling_rate: 1,
      logs: { enabled: true, head_sampling_rate: 1, invocation_logs: false, persist: false },
      traces: { enabled: false, persist: false },
    })
    expect(original).toEqual(baseConfig())
    expect(JSON.stringify(result.config)).not.toMatch(/secret|api[_-]?token|service_role|database_url/i)
  })

  it('rejects invalid identities and any base config that could route elsewhere', () => {
    const options = { pullRequestNumber: '291', sourceSha, orderIntakeUrl, publishableKey }
    expect(() => buildOrderIntakeDiagnosticConfig(baseConfig(), { ...options, pullRequestNumber: '0' })).toThrow('ORDER_DIAGNOSTIC_PR_INVALID')
    expect(() => buildOrderIntakeDiagnosticConfig(baseConfig(), { ...options, sourceSha: 'bad' })).toThrow('ORDER_DIAGNOSTIC_SHA_INVALID')
    expect(() => buildOrderIntakeDiagnosticConfig(baseConfig(), { ...options, orderIntakeUrl: 'https://other.supabase.co/functions/v1/order-intake' })).toThrow('ORDER_DIAGNOSTIC_INTAKE_TARGET_INVALID')
    expect(() => buildOrderIntakeDiagnosticConfig(baseConfig(), { ...options, publishableKey: 'service_role_secret' })).toThrow('ORDER_DIAGNOSTIC_PUBLISHABLE_KEY_INVALID')
    expect(() => buildOrderIntakeDiagnosticConfig({ ...baseConfig(), workers_dev: true }, options)).toThrow('ORDER_DIAGNOSTIC_BASE_CONFIG_NOT_PREVIEW')
    expect(() => buildOrderIntakeDiagnosticConfig({ ...baseConfig(), routes: ['*'] }, options)).toThrow('ORDER_DIAGNOSTIC_BASE_CONFIG_HAS_ROUTE')
    expect(() => buildOrderIntakeDiagnosticConfig({ ...baseConfig(), ratelimits: [] }, options)).toThrow('ORDER_DIAGNOSTIC_RATE_LIMITER_MISSING')
  })
})

describe('order intake diagnostic credential scope', () => {
  it('rejects account-wide Worker writer roles even on the approved account', () => {
    for (const permission of ['Workers Scripts Write', 'Workers Editor']) {
      const details = permittedTokenDetails()
      details.policies[0].permission_groups = [{ name: permission }]
      expect(attestPreviewTokenScope(accountId, details)).toEqual({
        ok: false,
        reason: 'TOKEN_ACCOUNT_WIDE_WORKER_WRITE_FORBIDDEN',
      })
    }
  })

  it('fails closed when no documented selected-Worker policy has been verified', () => {
    const details = permittedTokenDetails()
    details.policies[0].permission_groups = [{ name: 'Account Settings Read' }]
    expect(attestPreviewTokenScope(accountId, details, { detailsSource: 'ACCOUNT_OWNED_TOKEN_DETAILS' })).toEqual({
      ok: false,
      reason: 'TOKEN_WORKER_EDITOR_POLICY_MISSING',
    })
  })

  it('distinguishes documented Individual Workers Editor from unknown resource-map encoding', () => {
    const details = permittedAccountOwnedTokenDetails()
    details.policies = [
      { effect: 'allow', permission_groups: [{ name: 'Individual Workers Editor' }], resources: { 'worker-selection': ['preview-public'] } },
    ]
    expect(attestPreviewTokenScope(accountId, details, { detailsSource: 'ACCOUNT_OWNED_TOKEN_DETAILS' })).toEqual({
      ok: false,
      reason: 'TOKEN_SELECTED_WORKER_RESOURCE_ENCODING_UNVERIFIED',
    })
  })

  it('rejects OAuth tokens, API Token Write, and account wildcards without printing policies', () => {
    expect(attestPreviewTokenScope(accountId, { ...permittedTokenDetails(), provisioner_type: 'com.cloudflare.api.oauthtoken' }).reason).toBe('OAUTH_TOKEN_NOT_ALLOWED')
    expect(attestPreviewTokenScope('b'.repeat(32), permittedTokenDetails()).reason).toBe('ACCOUNT_ID_NOT_APPROVED')
    const tokenWrite = permittedTokenDetails()
    tokenWrite.policies[0].permission_groups.push({ name: 'Account API Tokens Write' })
    expect(attestPreviewTokenScope(accountId, tokenWrite).reason).toBe('TOKEN_API_TOKEN_WRITE_PRESENT')
    const wildcard = permittedTokenDetails()
    wildcard.policies[0].resources = { 'com.cloudflare.api.account.*': '*' }
    expect(attestPreviewTokenScope(accountId, wildcard).reason).toBe('TOKEN_RESOURCE_SCOPE_NOT_EXACT')
  })

  it('does not treat an active token or missing provenance alone as scope proof', () => {
    const details = permittedTokenDetails()
    delete (details as { provisioner_type?: string }).provisioner_type
    expect(attestPreviewTokenScope(accountId, details)).toEqual({
      ok: false,
      reason: 'TOKEN_PROVISIONER_TYPE_UNKNOWN',
    })
    expect(attestPreviewTokenScope(accountId, {
      id: tokenId,
      status: 'active',
      provisioner_type: 'com.cloudflare.api.apitoken',
    }, { expectedTokenId: tokenId })).toEqual({
      ok: false,
      reason: 'TOKEN_POLICIES_MISSING',
    })
    const malformedProvenance = permittedTokenDetails() as { provisioner_type?: string; provisioner_id?: unknown }
    delete malformedProvenance.provisioner_type
    malformedProvenance.provisioner_id = 42
    expect(attestPreviewTokenScope(accountId, malformedProvenance, {
      expectedTokenId: tokenId,
      detailsSource: 'USER_TOKEN_DETAILS',
    })).toEqual({ ok: false, reason: 'TOKEN_PROVISIONER_TYPE_UNKNOWN' })
  })

  it('inspects token policy metadata without returning credential values', async () => {
    const requests: Array<{ url: string; authorization: string | null }> = []
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), authorization: new Headers(init?.headers).get('authorization') })
      if (String(input).endsWith(`/accounts/${accountId}/tokens/verify`)) {
        return new Response('{}', { status: 403 })
      }
      if (String(input).endsWith('/user/tokens/verify')) {
        return Response.json({ success: true, result: { id: tokenId, status: 'active' } })
      }
      if (String(input).endsWith(`/accounts/${accountId}/tokens/${tokenId}`)) {
        return new Response('{}', { status: 404 })
      }
      return Response.json({ success: true, result: permittedTokenDetails() })
    }

    const result = await attestCloudflareCredential(accountId, 'secret-test-only', fetcher)

    expect(result).toEqual({
      ok: false,
      reason: 'TOKEN_ACCOUNT_WIDE_WORKER_WRITE_FORBIDDEN',
      detailsSource: 'USER_TOKEN_DETAILS',
      detailsAttemptResults: [
        { source: 'ACCOUNT_OWNED_TOKEN_DETAILS', outcome: 'HTTP_ERROR', status: 404 },
        { source: 'USER_TOKEN_DETAILS', outcome: 'HTTP_OK', status: 200 },
      ],
    })
    expect(requests.map(({ url }) => url)).toEqual([
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`,
      'https://api.cloudflare.com/client/v4/user/tokens/verify',
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/${tokenId}`,
      `https://api.cloudflare.com/client/v4/user/tokens/${tokenId}`,
    ])
    expect(requests.every(({ authorization }) => authorization === 'Bearer secret-test-only')).toBe(true)
    expect(JSON.stringify(result)).not.toContain('secret-test-only')
  })

  it('uses the account-owned token details endpoint and accepts its optional provenance field only with exact policies', async () => {
    const requests: Array<{ url: string; method: string; authorization: string | null }> = []
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({
        url,
        method: init?.method ?? 'GET',
        authorization: new Headers(init?.headers).get('authorization'),
      })
      if (url.endsWith(`/accounts/${accountId}/tokens/verify`)) {
        return Response.json({ success: true, result: { id: tokenId, status: 'active' } })
      }
      if (url.endsWith(`/accounts/${accountId}/tokens/${tokenId}`)) {
        return Response.json({ success: true, result: permittedAccountOwnedTokenDetails() })
      }
      throw new Error('UNEXPECTED_TOKEN_SCOPE_REQUEST')
    }

    await expect(attestCloudflareCredential(accountId, 'secret-test-only', fetcher)).resolves.toEqual({
      ok: false,
      reason: 'TOKEN_ACCOUNT_WIDE_WORKER_WRITE_FORBIDDEN',
      detailsSource: 'ACCOUNT_OWNED_TOKEN_DETAILS',
      detailsAttemptResults: [
        { source: 'ACCOUNT_OWNED_TOKEN_DETAILS', outcome: 'HTTP_OK', status: 200 },
      ],
    })
    expect(requests.map(({ url }) => url)).toEqual([
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`,
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/${tokenId}`,
    ])
    expect(requests.every(({ method }) => method === 'GET')).toBe(true)
    expect(requests.every(({ authorization }) => authorization === 'Bearer secret-test-only')).toBe(true)
    expect(JSON.stringify(requests.map(({ url, method }) => ({ url, method })))).not.toContain('secret-test-only')
  })

  it('falls back to the user-owned token details endpoint when account details are not available', async () => {
    const requests: string[] = []
    const fetcher = async (input: RequestInfo | URL) => {
      const url = String(input)
      requests.push(url)
      if (url.endsWith(`/accounts/${accountId}/tokens/verify`)) return new Response('{}', { status: 403 })
      if (url.endsWith('/user/tokens/verify')) {
        return Response.json({ success: true, result: { id: tokenId, status: 'active' } })
      }
      if (url.endsWith(`/accounts/${accountId}/tokens/${tokenId}`)) return new Response('{}', { status: 403 })
      if (url.endsWith(`/user/tokens/${tokenId}`)) {
        return Response.json({ success: true, result: permittedTokenDetails() })
      }
      throw new Error('UNEXPECTED_TOKEN_SCOPE_REQUEST')
    }

    await expect(attestCloudflareCredential(accountId, 'secret-test-only', fetcher)).resolves.toMatchObject({
      ok: false,
      reason: 'TOKEN_ACCOUNT_WIDE_WORKER_WRITE_FORBIDDEN',
      detailsSource: 'USER_TOKEN_DETAILS',
    })
    expect(requests).toEqual([
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`,
      'https://api.cloudflare.com/client/v4/user/tokens/verify',
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/${tokenId}`,
      `https://api.cloudflare.com/client/v4/user/tokens/${tokenId}`,
    ])
  })

  it('still rejects an OAuth-provisioned token returned by the account-owned endpoint', async () => {
    const oauthDetails = {
      ...permittedAccountOwnedTokenDetails(),
      provisioner_type: 'com.cloudflare.api.oauthtoken',
    }
    const fetcher = async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith(`/accounts/${accountId}/tokens/verify`)) {
        return Response.json({ success: true, result: { id: tokenId, status: 'active' } })
      }
      if (url.endsWith(`/accounts/${accountId}/tokens/${tokenId}`)) {
        return Response.json({ success: true, result: oauthDetails })
      }
      throw new Error('UNEXPECTED_TOKEN_SCOPE_REQUEST')
    }

    await expect(attestCloudflareCredential(accountId, 'secret-test-only', fetcher)).resolves.toEqual({
      ok: false,
      reason: 'OAUTH_TOKEN_NOT_ALLOWED',
      detailsSource: 'ACCOUNT_OWNED_TOKEN_DETAILS',
      detailsAttemptResults: [
        { source: 'ACCOUNT_OWNED_TOKEN_DETAILS', outcome: 'HTTP_OK', status: 200 },
      ],
    })
  })

  it('rejects scope details for a token ID different from the verified bearer', async () => {
    const mismatchedDetails = { ...permittedAccountOwnedTokenDetails(), id: 'fedcba9876543210fedcba9876543210' }
    const fetcher = async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith(`/accounts/${accountId}/tokens/verify`)) {
        return Response.json({ success: true, result: { id: tokenId, status: 'active' } })
      }
      if (url.endsWith(`/accounts/${accountId}/tokens/${tokenId}`)) {
        return Response.json({ success: true, result: mismatchedDetails })
      }
      throw new Error('UNEXPECTED_TOKEN_SCOPE_REQUEST')
    }

    await expect(attestCloudflareCredential(accountId, 'secret-test-only', fetcher)).resolves.toEqual({
      ok: false,
      reason: 'TOKEN_DETAILS_ID_MISMATCH',
      detailsSource: 'ACCOUNT_OWNED_TOKEN_DETAILS',
      detailsAttemptResults: [
        { source: 'ACCOUNT_OWNED_TOKEN_DETAILS', outcome: 'HTTP_OK', status: 200 },
      ],
    })
  })

  it('fails closed when neither owner-specific details endpoint can disclose scope', async () => {
    const requests: string[] = []
    const fetcher = async (input: RequestInfo | URL) => {
      const url = String(input)
      requests.push(url)
      if (url.endsWith(`/accounts/${accountId}/tokens/verify`)) {
        return Response.json({ success: true, result: { id: tokenId, status: 'active' } })
      }
      return new Response('{}', { status: 403 })
    }

    await expect(attestCloudflareCredential(accountId, 'secret-test-only', fetcher)).resolves.toEqual({
      ok: false,
      reason: 'TOKEN_SCOPE_DETAILS_DENIED',
      detailsSourcesAttempted: ['ACCOUNT_OWNED_TOKEN_DETAILS', 'USER_TOKEN_DETAILS'],
      detailsAttemptResults: [
        { source: 'ACCOUNT_OWNED_TOKEN_DETAILS', outcome: 'HTTP_ERROR', status: 403 },
        { source: 'USER_TOKEN_DETAILS', outcome: 'HTTP_ERROR', status: 403 },
      ],
    })
    expect(requests).toEqual([
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`,
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/${tokenId}`,
      `https://api.cloudflare.com/client/v4/user/tokens/${tokenId}`,
    ])
  })

  it('records a fixed result when an owner-specific details request cannot be fetched', async () => {
    const fetcher = async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith(`/accounts/${accountId}/tokens/verify`)) {
        return Response.json({ success: true, result: { id: tokenId, status: 'active' } })
      }
      if (url.endsWith(`/accounts/${accountId}/tokens/${tokenId}`)) throw new Error('private transport detail')
      return new Response('{}', { status: 403 })
    }

    await expect(attestCloudflareCredential(accountId, 'secret-test-only', fetcher)).resolves.toEqual({
      ok: false,
      reason: 'TOKEN_SCOPE_DETAILS_DENIED',
      detailsSourcesAttempted: ['ACCOUNT_OWNED_TOKEN_DETAILS', 'USER_TOKEN_DETAILS'],
      detailsAttemptResults: [
        { source: 'ACCOUNT_OWNED_TOKEN_DETAILS', outcome: 'FETCH_FAILED' },
        { source: 'USER_TOKEN_DETAILS', outcome: 'HTTP_ERROR', status: 403 },
      ],
    })
  })

  it('fails closed when token verification is denied before any scope fetch', async () => {
    const fetcher = async () => new Response('{}', { status: 403 })
    await expect(attestCloudflareCredential(accountId, 'secret-test-only', fetcher)).resolves.toEqual({
      ok: false,
      reason: 'TOKEN_VERIFY_DENIED',
    })
  })
})

describe('order intake diagnostic target and cleanup', () => {
  it('allows only the recorded Cloudflare account, the expected workers.dev subdomain, and an absent per-PR Worker', async () => {
    const requests: Array<{ url: string; method: string }> = []
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      requests.push({ url, method })
      if (url.endsWith('/workers/subdomain')) return Response.json({ success: true, result: { subdomain: 'tranhuunguyenhuy' } })
      if (url.endsWith('/scripts/dongphugia-v1-public-preview/tails')) return Response.json({ success: true, result: [] })
      return new Response('{}', { status: 404 })
    }

    await expect(preflightOrderIntakeDiagnosticTarget({ accountId, token: 'secret-test-only', workerName }, fetcher)).resolves.toEqual({
      ok: true,
      workerName,
      previewUrl: 'https://pr-291-dongphugia-v1-public-preview.tranhuunguyenhuy.workers.dev',
    })
    expect(requests.every(({ method }) => method === 'GET')).toBe(true)
    expect(requests.some(({ url }) => url.endsWith(`/scripts/${workerName}/settings`))).toBe(true)
    await expect(preflightOrderIntakeDiagnosticTarget({ accountId: 'b'.repeat(32), token: 'secret-test-only', workerName }, fetcher)).resolves.toMatchObject({
      ok: false,
      reason: 'CLOUDFLARE_TARGET_ARGUMENT_INVALID',
    })
    expect(JSON.stringify(requests)).not.toContain('secret-test-only')
  })

  it('deletes only the exact per-PR diagnostic tail and Worker, then verifies the Worker is absent', async () => {
    const calls: Array<{ url: string; method: string }> = []
    const root = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`
    const tailId = 'abcdef0123456789abcdef0123456789'
    let workerDeleted = false
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push({ url, method })
      if (url === `${root}/tails` && method === 'GET') {
        return Response.json({ success: true, result: { id: tailId } })
      }
      if (url === `${root}/tails/${tailId}` && method === 'DELETE') return Response.json({ success: true })
      if (url === root && method === 'DELETE') {
        workerDeleted = true
        return Response.json({ success: true })
      }
      if (url === `${root}/settings` && method === 'GET' && workerDeleted) return new Response('{}', { status: 404 })
      throw new Error('UNEXPECTED_CLEANUP_REQUEST')
    }

    await expect(cleanupOrderIntakeDiagnosticWorker({ accountId, token: 'secret-test-only', workerName }, fetcher)).resolves.toEqual({
      ok: true,
      workerName,
      state: 'ABSENT',
      result: 'ORDER_DIAGNOSTIC_CLEANUP_PASS',
    })
    expect(calls.map(({ method }) => method)).toEqual(['GET', 'DELETE', 'DELETE', 'GET'])
    expect(calls[1]?.url).toBe(`${root}/tails/${tailId}`)
    expect(calls[2]?.url).toBe(root)
    expect(calls[3]?.url).toBe(`${root}/settings`)

    calls.length = 0
    await expect(cleanupOrderIntakeDiagnosticWorker({ accountId, token: 'secret-test-only', workerName: 'dongphugia-v1-public-preview' }, fetcher)).resolves.toMatchObject({
      ok: false,
      reason: 'CLOUDFLARE_CLEANUP_WORKER_INVALID',
    })
    expect(calls).toHaveLength(0)
    expect(JSON.stringify(calls)).not.toContain('secret-test-only')
  })
})

describe('order intake diagnostic evidence', () => {
  const headers = `HTTP/2 503\r\nX-DPG-Source-SHA: ${sourceSha}\r\nX-Request-Id: ${requestId}\r\nX-Robots-Tag: noindex\r\nCache-Control: private, no-store\r\n`

  it('correlates only the redacted event fields with the GET receipt response', () => {
    const tail = `${JSON.stringify({
      outcome: 'ok',
      logs: [{
        message: [
          'PUBLIC_ORDER_INTAKE_DIAGNOSTIC',
          JSON.stringify({ requestId, operation: 'receipt', stage: 'edge_status', upstreamStatus: 401 }),
        ],
      }],
    })}\n`
    expect(buildOrderIntakeDiagnosticEvidence({
      sourceSha,
      httpStatus: '503',
      headers,
      body: '{"error":{"code":"ORDER_INTAKE_UNAVAILABLE"}}',
      tail,
    })).toEqual({
      result: 'DIAGNOSTIC_CAPTURED',
      sourceSha,
      requestId,
      httpStatus: 503,
      event: { operation: 'receipt', stage: 'edge_status', upstreamStatus: 401 },
    })
  })

  it('accepts a successful read-only empty receipt without retaining any body details', () => {
    expect(buildOrderIntakeDiagnosticEvidence({
      sourceSha,
      httpStatus: '200',
      headers: headers.replace('503', '200'),
      body: '{"data":null}',
      tail: '',
    })).toEqual({ result: 'RECEIPT_PREFLIGHT_PASS', sourceSha, requestId, httpStatus: 200 })
  })

  it('rejects mismatched identity, public cache, missing correlated events, and unsafe stages', () => {
    expect(() => buildOrderIntakeDiagnosticEvidence({
      sourceSha,
      httpStatus: '503',
      headers: headers.replace(sourceSha, 'a'.repeat(40)),
      body: '{"error":{"code":"ORDER_INTAKE_UNAVAILABLE"}}',
      tail: '',
    })).toThrow('ORDER_DIAGNOSTIC_SOURCE_SHA_MISMATCH')

    const tail = `${JSON.stringify({ logs: [{ message: ['PUBLIC_ORDER_INTAKE_DIAGNOSTIC', JSON.stringify({ requestId, operation: 'receipt', stage: 'secret_mismatch' })] }] })}\n`
    expect(() => buildOrderIntakeDiagnosticEvidence({
      sourceSha,
      httpStatus: '503',
      headers,
      body: '{"error":{"code":"ORDER_INTAKE_UNAVAILABLE"}}',
      tail,
    })).toThrow('ORDER_DIAGNOSTIC_EVENT_NOT_CORRELATED')

    expect(() => buildOrderIntakeDiagnosticEvidence({
      sourceSha,
      httpStatus: '503',
      headers: headers.replace('private, no-store', 'public, max-age=60'),
      body: '{"error":{"code":"ORDER_INTAKE_UNAVAILABLE"}}',
      tail: '',
    })).toThrow('ORDER_DIAGNOSTIC_CACHE_POLICY_INVALID')
  })
})
