export const DEFAULT_CANONICAL_SITE_URL = 'https://www.dongphugia.vn'

export type DeployTarget = 'local' | 'staging' | 'production'

export type SiteRuntimeConfig = {
  target: DeployTarget
  siteUrl: string
  allowIndexing: boolean
}

/**
 * Shared-data Staging may run the production-configured image for parity. The
 * explicit safety mode keeps that image non-indexable without changing the
 * Production default when the flag is absent.
 */
export const STAGING_SAFETY_MODE_ENV = 'STAGING_SAFETY_MODE'
export const STAGING_SITE_URL_ENV = 'STAGING_SITE_URL'

export function isStagingSafetyModeEnabled() {
  return process.env[STAGING_SAFETY_MODE_ENV] === 'true'
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
  const safetyMode = isStagingSafetyModeEnabled()
  const siteUrlTarget = safetyMode ? 'staging' : target
  const configuredSiteUrl = safetyMode
    ? process.env[STAGING_SITE_URL_ENV]?.trim()
    : process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (safetyMode && !configuredSiteUrl) {
    throw new Error('STAGING_SAFETY_MODE requires STAGING_SITE_URL')
  }
  const fallback = siteUrlTarget === 'production' ? DEFAULT_CANONICAL_SITE_URL : 'http://localhost:3000'
  const siteUrl = validateSiteUrl(siteUrlTarget, configuredSiteUrl || fallback)

  return {
    target,
    siteUrl,
    allowIndexing: target === 'production' && !safetyMode,
  }
}

export function getCanonicalSiteUrl() {
  return getSiteRuntimeConfig().siteUrl
}

export function canonicalUrl(pathname = '') {
  if (!pathname) return getCanonicalSiteUrl()
  return new URL(pathname, `${getCanonicalSiteUrl()}/`).toString()
}
