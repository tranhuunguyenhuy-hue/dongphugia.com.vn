import { describe, expect, it, vi } from 'vitest'

import { verifyHeadRuntime } from './verify-environment-worker-deployment.mjs'

const origin = 'https://dpg-staging.tranhuunguyenhuy.workers.dev'
const sourceSha = 'a'.repeat(40)

function headResponse({ status = 200, app = 'public', sha = sourceSha, robots = 'noindex, nofollow' } = {}) {
  return new Response(null, {
    status,
    headers: {
      'x-dpg-source-sha': sha,
      'x-dpg-app': app,
      'x-robots-tag': robots,
    },
  })
}

describe('hosted Staging GET/HEAD smoke contract', () => {
  it.each([
    ['Public root', '/', 'public'],
    ['Admin login shell', '/admin/login', 'admin'],
  ])('checks the noindex HEAD response for %s', async (_label, pathname, app) => {
    const fetchImpl = vi.fn().mockResolvedValue(headResponse({ app }))
    await expect(verifyHeadRuntime({ fetchImpl, origin, pathname, sourceSha, app }))
      .resolves.toEqual({ status: 200, sourceSha, app, noindex: true })
    expect(fetchImpl).toHaveBeenCalledWith(`${origin}${pathname}`, expect.objectContaining({
      method: 'HEAD',
      cache: 'no-store',
      redirect: 'manual',
    }))
  })

  it.each([
    ['wrong status', { status: 503 }, 'ENVIRONMENT_WORKER_RUNTIME_STATUS_200_REQUIRED'],
    ['wrong source identity', { sha: 'b'.repeat(40) }, 'ENVIRONMENT_WORKER_RUNTIME_SHA_MISMATCH'],
    ['wrong app mount', { app: 'admin' }, 'ENVIRONMENT_WORKER_RUNTIME_APP_MISMATCH'],
    ['missing noindex', { robots: 'index, follow' }, 'ENVIRONMENT_WORKER_RUNTIME_NOINDEX_MISSING'],
  ] as const)('rejects %s', async (_label, response, code) => {
    await expect(verifyHeadRuntime({
      fetchImpl: vi.fn().mockResolvedValue(headResponse(response)),
      origin,
      pathname: '/',
      sourceSha,
      app: 'public',
    })).rejects.toThrow(code)
  })
})
