const INTAKE_ROLE = 'dpg_order_intake_login'
const PROJECT_REF = '[a-z0-9]{20}'
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', 'db'])

type DatabaseUrlOptions = Readonly<{ allowLocal?: boolean }>

/** Accept only the dedicated intake login over verified TLS (or explicit local test DB). */
export function isOrderIntakeDatabaseUrl(raw: string, options: DatabaseUrlOptions = {}): boolean {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return false
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)
      || (parsed.username !== INTAKE_ROLE && !parsed.username.startsWith(`${INTAKE_ROLE}.`))
      || !parsed.password
      || parsed.pathname !== '/postgres'
      || parsed.hash
      || [...parsed.searchParams.keys()].some((key) => key !== 'sslmode')) return false

  const local = LOCAL_HOSTS.has(parsed.hostname)
  if (local) {
    return options.allowLocal === true
      && parsed.username === INTAKE_ROLE
      && parsed.searchParams.get('sslmode') === 'disable'
      && (!parsed.port || parsed.port === '5432' || parsed.port === '54322')
  }

  if (parsed.searchParams.get('sslmode') !== 'require') return false
  const direct = parsed.hostname.match(new RegExp(`^db\\.(${PROJECT_REF})\\.supabase\\.co$`))
  if (direct) return parsed.username === INTAKE_ROLE && (parsed.port === '' || parsed.port === '5432')

  const sharedPooler = /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(parsed.hostname)
  const sharedPoolerRole = parsed.username.match(new RegExp(`^${INTAKE_ROLE}\\.(${PROJECT_REF})$`))
  return sharedPooler
    && sharedPoolerRole !== null
    && (parsed.port === '5432' || parsed.port === '6543')
}
