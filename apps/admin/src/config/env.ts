const ADMIN_PRODUCTION_ORIGIN = 'https://admin.dongphugia.vn'
const ADMIN_BROWSER_ENV_KEYS = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_ADMIN_AUTH_ENABLED',
])

const PRIVILEGED_ENV_PATTERN =
  /(SERVICE_ROLE|SECRET|AUTH_ADMIN|PASSWORD|DATABASE|PRIVATE_KEY|CREDENTIAL)/i

export type AdminAppEnvironment = Readonly<{
  application: 'admin'
  environment: 'local' | 'preview' | 'staging' | 'production'
  origin: string
  noindex: true
  buildTarget: 'admin'
}>

function valueOf(environment: Record<string, string | undefined>, name: string) {
  return environment[name]?.trim() || undefined
}

export function isAdminAuthEnabled(source?: Record<string, string | undefined>) {
  // Keep the direct property read so Next/Vite can inline the build-time public
  // flag in browser code. Production keeps its existing enabled default; the
  // local Preview and Staging build contract explicitly sets this to false.
  const publicValue = source
    ? valueOf(source, 'NEXT_PUBLIC_ADMIN_AUTH_ENABLED')
    : process.env.NEXT_PUBLIC_ADMIN_AUTH_ENABLED?.trim()
  const serverValue = source
    ? valueOf(source, 'ADMIN_AUTH_ENABLED')
    : process.env.ADMIN_AUTH_ENABLED?.trim()
  return publicValue !== 'false' && serverValue !== 'false'
}

function assertBrowserEnvironmentIsApproved(
  environment: Record<string, string | undefined>,
) {
  for (const name of Object.keys(environment)) {
    if (!name.startsWith('NEXT_PUBLIC_')) continue

    if (PRIVILEGED_ENV_PATTERN.test(name)) {
      throw new Error(`ADMIN_PRIVILEGED_BROWSER_ENV_FORBIDDEN:${name}`)
    }

    if (!ADMIN_BROWSER_ENV_KEYS.has(name)) {
      throw new Error(`ADMIN_BROWSER_ENV_NOT_ALLOWLISTED:${name}`)
    }
  }
}

function validateOrigin(
  configuredOrigin: string,
  environment: 'local' | 'preview' | 'staging' | 'production',
) {
  let parsed: URL

  try {
    parsed = new URL(configuredOrigin)
  } catch {
    throw new Error('ADMIN_APP_ORIGIN_INVALID')
  }

  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    (parsed.pathname !== '/' && parsed.pathname !== '') ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('ADMIN_APP_ORIGIN_INVALID')
  }

  if (environment === 'production' && configuredOrigin !== ADMIN_PRODUCTION_ORIGIN) {
    throw new Error('ADMIN_PRODUCTION_ORIGIN_MISMATCH')
  }

  if (
    (environment === 'preview' || environment === 'staging') &&
    (configuredOrigin === ADMIN_PRODUCTION_ORIGIN ||
      parsed.hostname === 'dongphugia.vn' ||
      parsed.hostname.endsWith('.dongphugia.vn'))
  ) {
    throw new Error('ADMIN_PREVIEW_PRODUCTION_DOMAIN_FORBIDDEN')
  }
  if (environment === 'preview' && (!['localhost','127.0.0.1'].includes(parsed.hostname) || parsed.protocol !== 'http:')) {
    throw new Error('ADMIN_LOCAL_PREVIEW_ORIGIN_REQUIRED')
  }
  if (environment === 'staging' && (parsed.protocol !== 'https:'
    || parsed.hostname !== 'dpg-staging.tranhuunguyenhuy.workers.dev')) {
    throw new Error('ADMIN_STAGING_ORIGIN_REQUIRED')
  }
  return configuredOrigin.replace(/\/$/, '')
}

export function getAdminAppEnvironment(
  source: Record<string, string | undefined> = process.env,
): AdminAppEnvironment {
  assertBrowserEnvironmentIsApproved(source)

  const environment = valueOf(source, 'APP_ENV') || 'local'
  if (!['local', 'preview', 'staging', 'production'].includes(environment)) {
    throw new Error('ADMIN_APP_ENV_INVALID')
  }

  const typedEnvironment = environment as AdminAppEnvironment['environment']
  const origin = validateOrigin(
    valueOf(source, 'APP_ORIGIN') ||
      (typedEnvironment === 'production' ? ADMIN_PRODUCTION_ORIGIN : 'http://localhost:3001'),
    typedEnvironment,
  )
  if ((typedEnvironment === 'preview' || typedEnvironment === 'staging')
    && valueOf(source, 'PREVIEW_NOINDEX') !== 'true') {
    throw new Error(typedEnvironment === 'preview'
      ? 'ADMIN_PREVIEW_NOINDEX_REQUIRED'
      : 'ADMIN_STAGING_NOINDEX_REQUIRED')
  }

  const buildTarget = valueOf(source, 'APP_BUILD_TARGET') || 'admin'
  if (buildTarget !== 'admin') {
    throw new Error('ADMIN_BUILD_TARGET_MISMATCH')
  }

  return {
    application: 'admin',
    environment: typedEnvironment,
    origin,
    noindex: true,
    buildTarget: 'admin',
  }
}

export type AdminSupabasePublicConfig = Readonly<{
  url: string
  publishableKey: string
}>

export function getAdminBasePath(source: Record<string, string | undefined> = process.env) {
  const basePath = valueOf(source, 'ADMIN_BASE_PATH') || ''
  if (basePath !== '' && basePath !== '/admin') throw new Error('ADMIN_BASE_PATH_INVALID')
  return basePath
}

export function getAdminPath(path: string, source: Record<string, string | undefined> = process.env) {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    throw new Error('ADMIN_PATH_INVALID')
  }
  const basePath = getAdminBasePath(source)
  return basePath && path !== basePath && !path.startsWith(`${basePath}/`) ? `${basePath}${path}` : path
}

export function getAdminSupabasePublicConfig(
  source: Record<string, string | undefined> = process.env,
): AdminSupabasePublicConfig {
  const url = valueOf(source, 'NEXT_PUBLIC_SUPABASE_URL')
  const publishableKey = valueOf(source, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  if (!url) throw new Error('ADMIN_SUPABASE_URL_REQUIRED')
  if (!publishableKey) throw new Error('ADMIN_SUPABASE_PUBLISHABLE_KEY_REQUIRED')

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('ADMIN_SUPABASE_URL_INVALID')
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.pathname !== '/' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('ADMIN_SUPABASE_URL_INVALID')
  }
  if (parsed.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error('ADMIN_SUPABASE_URL_MUST_USE_HTTPS')
  }
  return { url: url.replace(/\/$/, ''), publishableKey }
}
