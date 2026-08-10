export const DEFAULT_CANONICAL_SITE_URL = 'https://www.dongphugia.vn'

export type DeployTarget = 'local' | 'staging' | 'production'

export type SiteRuntimeConfig = {
  target: DeployTarget
  siteUrl: string
  allowIndexing: boolean
}

function normalizeAbsoluteUrl(value: string) {
  const url = new URL(value)
  url.hash = ''
  url.pathname = url.pathname.replace(/\/$/, '')
  url.search = ''
  return url.toString().replace(/\/$/, '')
}

function getDeployTarget(value = process.env.DEPLOY_TARGET): DeployTarget {
  if (!value) return 'local'
  if (value === 'local' || value === 'staging' || value === 'production') return value
  throw new Error('DEPLOY_TARGET must be local, staging, or production')
}

function validateSiteUrl(target: DeployTarget, rawUrl: string) {
  const normalized = normalizeAbsoluteUrl(rawUrl)
  const url = new URL(normalized)

  if (target === 'production') {
    if (normalized !== DEFAULT_CANONICAL_SITE_URL) {
      throw new Error('Production requires NEXT_PUBLIC_SITE_URL=https://www.dongphugia.vn')
    }
    return normalized
  }

  if (target === 'staging') {
    if (url.protocol !== 'https:' || ['dongphugia.vn', 'www.dongphugia.vn', 'dongphugia.com.vn', 'www.dongphugia.com.vn'].includes(url.hostname)) {
      throw new Error('Staging requires a non-production HTTPS NEXT_PUBLIC_SITE_URL')
    }
    return normalized
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Local requires an HTTP(S) NEXT_PUBLIC_SITE_URL')
  }
  return normalized
}

export function getSiteRuntimeConfig(): SiteRuntimeConfig {
  const target = getDeployTarget()
  const fallback = target === 'production' ? DEFAULT_CANONICAL_SITE_URL : 'http://localhost:3000'
  const siteUrl = validateSiteUrl(target, process.env.NEXT_PUBLIC_SITE_URL?.trim() || fallback)

  return {
    target,
    siteUrl,
    allowIndexing: target === 'production',
  }
}

export function getCanonicalSiteUrl() {
  return getSiteRuntimeConfig().siteUrl
}

export function canonicalUrl(pathname = '') {
  if (!pathname) return getCanonicalSiteUrl()
  return new URL(pathname, `${getCanonicalSiteUrl()}/`).toString()
}
