import { describe, expect, it, vi } from 'vitest'

import { validateAdminPreviewUrl, verifyRealAdminPreview } from './real-admin-preview-proof.mjs'

const baseUrl = 'https://dongphugia-phase2-admin-preview-290.tranhuunguyenhuy.workers.dev'
const sourceSha = 'a'.repeat(40)

function response(status, headers = {}, body = '') {
  return new Response(body, { status, headers })
}

describe('live Admin Preview acceptance proof', () => {
  it('accepts only the separate workers.dev Admin origin', () => {
    expect(validateAdminPreviewUrl(baseUrl)).toBe(baseUrl)
    for (const value of [
      'https://admin.dongphugia.vn',
      'https://other.workers.dev',
      `${baseUrl}/login`,
      `${baseUrl}?next=/orders`,
      'http://dongphugia-phase2-admin-preview-290.tranhuunguyenhuy.workers.dev',
    ]) expect(() => validateAdminPreviewUrl(value)).toThrow()
  })

  it('checks live source identity, noindex/no-store and unauthenticated route denial', async () => {
    const responses = [
      response(200, {
        'cache-control': 'private, no-store',
        'x-robots-tag': 'noindex, nofollow',
        'x-dpg-source-sha': sourceSha,
        'content-type': 'application/json',
      }, JSON.stringify({ application: 'admin', status: 'ok', source_sha: sourceSha })),
      response(200, { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' }, '<h1>Login</h1>'),
      response(200, { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' }, 'User-agent: *\nDisallow: /'),
      response(307, { location: '/login', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' }),
    ]
    const fetchImpl = vi.fn(async () => responses.shift())
    await expect(verifyRealAdminPreview({ baseUrl, sourceSha, fetchImpl })).resolves.toMatchObject({
      status: 'ADMIN_PREVIEW_LIVE_PASS',
      sourceSha,
      observations: {
        health: 'PASS',
        loginNoindexNoStore: 'PASS',
        robotsNoindex: 'PASS',
        unauthenticatedOrdersDenied: 'PASS',
      },
    })
  })

  it('rejects health responses from another build or an exposed private route', async () => {
    const health = response(200, {
      'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow',
      'content-type': 'application/json', 'x-dpg-source-sha': 'b'.repeat(40),
    }, JSON.stringify({ application: 'admin', status: 'ok', source_sha: 'b'.repeat(40) }))
    await expect(verifyRealAdminPreview({ baseUrl, sourceSha, fetchImpl: async () => health }))
      .rejects.toThrow('DPG_ADMIN_PREVIEW_SOURCE_IDENTITY_FAILED')
  })
})
