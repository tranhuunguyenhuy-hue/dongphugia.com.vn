import 'server-only'

function valueOf(environment: Record<string, string | undefined>, name: string) {
  return environment[name]?.trim() || undefined
}

/** The Auth Admin secret is resolved only from a server-only module. */
export function getAdminSupabaseSecretKey(
  source: Record<string, string | undefined> = process.env,
) {
  const value = valueOf(source, 'SUPABASE_SECRET_KEY')
  if (!value) throw new Error('ADMIN_SUPABASE_SECRET_KEY_REQUIRED')
  return value
}
