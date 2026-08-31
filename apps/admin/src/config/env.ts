const ADMIN_PRODUCTION_ORIGIN = 'https://admin.dongphugia.vn'
const ADMIN_BROWSER_ENV_KEYS = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
])

const PRIVILEGED_ENV_NAMES = [
  'DATABASE_URL',
  'DIRECT_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_AUTH_ADMIN_KEY',
  'AUTH_ADMIN_KEY',
  'AUTH_SECRET',
  'ADMIN_SESSION_SECRET',
  'PUBLISHING_TOKEN',
  'PUBLISHING_SCHEDULER_TOKEN',
  'CLOUDFLARE_API_TOKEN',
  'BUNNY_API_KEY',
  'BUNNY_STORAGE_API_KEY',
  'MIGRATION_PREVIEW_DATABASE_URL',
] as const

const PRIVILEGED_ENV_PATTERN =
  /(SERVICE_ROLE|SECRET|AUTH_ADMIN|PASSWORD|DATABASE|PRIVATE_KEY|CREDENTIAL)/i

export type AdminAppEnvironment = Readonly<{
  application: 'admin'
  environment: 'local' | 'preview' | 'production'
  origin: string
  noindex: true
  buildTarget: 'admin'
}>

function valueOf(environment: Record<string, string | undefined>, name: string) {
  return environment[name]?.trim() || undefined
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

  for (const name of PRIVILEGED_ENV_NAMES) {
    if (valueOf(environment, name)) {
      throw new Error(`ADMIN_PRIVILEGED_ENV_FORBIDDEN:${name}`)
    }
  }
}

function validateOrigin(
  configuredOrigin: string,
  environment: 'local' | 'preview' | 'production',
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
    environment === 'preview' &&
    (configuredOrigin === ADMIN_PRODUCTION_ORIGIN ||
      parsed.hostname === 'dongphugia.vn' ||
      parsed.hostname.endsWith('.dongphugia.vn'))
  ) {
    throw new Error('ADMIN_PREVIEW_PRODUCTION_DOMAIN_FORBIDDEN')
  }

  return configuredOrigin.replace(/\/$/, '')
}

export function getAdminAppEnvironment(
  source: Record<string, string | undefined> = process.env,
): AdminAppEnvironment {
  assertBrowserEnvironmentIsApproved(source)

  const environment = valueOf(source, 'APP_ENV') || 'local'
  if (!['local', 'preview', 'production'].includes(environment)) {
    throw new Error('ADMIN_APP_ENV_INVALID')
  }

  const typedEnvironment = environment as AdminAppEnvironment['environment']
  const origin = validateOrigin(
    valueOf(source, 'APP_ORIGIN') ||
      (typedEnvironment === 'production' ? ADMIN_PRODUCTION_ORIGIN : 'http://localhost:3001'),
    typedEnvironment,
  )
  if (typedEnvironment === 'preview' && valueOf(source, 'PREVIEW_NOINDEX') !== 'true') {
    throw new Error('ADMIN_PREVIEW_NOINDEX_REQUIRED')
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
