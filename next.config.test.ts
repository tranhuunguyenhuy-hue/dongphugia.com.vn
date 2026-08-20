// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

const ENV_KEYS = [
  'DEPLOY_TARGET',
  'NEXT_PUBLIC_SITE_URL',
  'PUBLISHING_BUNNY_CDN_HOSTNAME',
] as const

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
)

async function loadNextConfigWithEnv(
  env: Partial<Record<(typeof ENV_KEYS)[number], string>>,
) {
  vi.resetModules()

  for (const key of ENV_KEYS) {
    delete process.env[key]
  }

  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value
  }

  const nextConfigModule = await import('./next.config')
  return nextConfigModule.default
}

afterEach(() => {
  vi.resetModules()

  for (const key of ENV_KEYS) {
    delete process.env[key]
    const value = originalEnv[key]

    if (value !== undefined) {
      process.env[key] = value
    }
  }
})

describe('production Publishing CDN build config', () => {
  it('fails a production build when the Publishing CDN hostname is missing', async () => {
    await expect(
      loadNextConfigWithEnv({
        DEPLOY_TARGET: 'production',
        NEXT_PUBLIC_SITE_URL: 'https://www.dongphugia.vn',
      }),
    ).rejects.toThrow(
      'PUBLISHING_BUNNY_CDN_HOSTNAME is required for production builds',
    )
  })

  it('allows a valid Publishing CDN host in Next image loading and CSP img-src', async () => {
    const config = await loadNextConfigWithEnv({
      DEPLOY_TARGET: 'production',
      NEXT_PUBLIC_SITE_URL: 'https://www.dongphugia.vn',
      PUBLISHING_BUNNY_CDN_HOSTNAME: 'dpg-publishing-production.b-cdn.net',
    })

    expect(config.images?.remotePatterns).toContainEqual({
      protocol: 'https',
      hostname: 'dpg-publishing-production.b-cdn.net',
      pathname: '/publishing/**',
    })

    expect(config.headers).toBeDefined()

    const headers = await config.headers!()
    const csp = headers
      .find(({ source }) => source === '/(.*)')
      ?.headers.find(({ key }) => key === 'Content-Security-Policy')
      ?.value
    const imgSrc = csp?.split('; ').find((directive) => directive.startsWith('img-src '))

    expect(imgSrc?.split(/\s+/)).toContain(
      'https://dpg-publishing-production.b-cdn.net',
    )
  })
})
