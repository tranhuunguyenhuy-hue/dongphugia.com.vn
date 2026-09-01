import 'server-only'

import { createClient, type AuthError } from '@supabase/supabase-js'

import {
  getAdminAppEnvironment,
  getAdminSupabasePublicConfig,
} from '../config/env'
import { getAdminSupabaseSecretKey } from './config'
import { createAdminServerClient } from '../supabase/server'

export type V1StaffRole = 'Product' | 'Sales' | 'Marketing' | 'Admin'

type StaffIdentityInput = Readonly<{
  email: string
  displayName: string
  roles: V1StaffRole[]
  idempotencyKey: string
}>

function createAuthAdminClient() {
  const { url } = getAdminSupabasePublicConfig()
  const secretKey = getAdminSupabaseSecretKey()
  if (!secretKey.startsWith('sb_secret_')) {
    throw new Error('ADMIN_AUTH_ADMIN_SECRET_FORMAT_INVALID')
  }
  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

function isAdminContext(value: unknown): value is { capabilities: string[] } {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as { capabilities?: unknown }).capabilities) &&
    (value as { capabilities: unknown[] }).capabilities.includes('admin.staff.read')
  )
}

async function requireAdminCapability(capability: string) {
  const client = await createAdminServerClient()
  const { data, error } = await client.schema('dpg_v1_api').rpc('staff_context')
  if (error || !isAdminContext(data)) throw new Error(`ADMIN_AUTH_FORBIDDEN:${capability}`)
  if (!data.capabilities.includes(capability)) throw new Error(`ADMIN_AUTH_FORBIDDEN:${capability}`)
  return client
}

function safeAuthError(error: AuthError | null, code: string) {
  if (error) throw new Error(code)
}

function normalizeIdentity(input: StaffIdentityInput) {
  const email = input.email.trim().toLowerCase()
  const displayName = input.displayName.trim()
  if (!email || !displayName || input.roles.length < 1) throw new Error('ADMIN_AUTH_INPUT_INVALID')
  return { ...input, email, displayName }
}

/**
 * Trusted backend-only invite adapter. Authorization is checked through the
 * current V1 staff context; the Auth Admin secret is never accepted from a
 * request and is never imported by a browser module.
 */
export async function inviteStaffUser(input: StaffIdentityInput) {
  const normalized = normalizeIdentity(input)
  const db = await requireAdminCapability('admin.staff.create')
  const authAdmin = createAuthAdminClient()
  const origin = getAdminAppEnvironment().origin
  const { data, error } = await authAdmin.auth.admin.inviteUserByEmail(normalized.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })
  safeAuthError(error, 'ADMIN_AUTH_INVITE_FAILED')
  if (!data.user) throw new Error('ADMIN_AUTH_INVITE_FAILED')

  const provision = await db.schema('dpg_v1_api').rpc('staff_user_provision', {
    p_auth_user_id: data.user.id,
    p_email: normalized.email,
    p_display_name: normalized.displayName,
    p_roles: normalized.roles,
    p_idempotency_key: normalized.idempotencyKey,
  })
  if (provision.error) throw new Error('ADMIN_STAFF_PROVISION_FAILED')
  return provision.data
}

/** Reconciles a known Auth user without broad Auth user enumeration. */
export async function reconcileStaffUser(
  authUserId: string,
  input: Omit<StaffIdentityInput, 'idempotencyKey'> & { idempotencyKey: string },
) {
  const normalized = normalizeIdentity(input)
  const db = await requireAdminCapability('admin.staff.create')
  const { data, error } = await db.schema('dpg_v1_api').rpc('staff_user_provision', {
    p_auth_user_id: authUserId,
    p_email: normalized.email,
    p_display_name: normalized.displayName,
    p_roles: normalized.roles,
    p_idempotency_key: normalized.idempotencyKey,
  })
  if (error) throw new Error('ADMIN_STAFF_PROVISION_FAILED')
  return data
}

export async function assignStaffRoles(
  authUserId: string,
  roles: V1StaffRole[],
  idempotencyKey: string,
) {
  const db = await requireAdminCapability('admin.staff.assign_roles')
  const { data, error } = await db.schema('dpg_v1_api').rpc('staff_user_assign_roles', {
    p_auth_user_id: authUserId,
    p_roles: roles,
    p_idempotency_key: idempotencyKey,
  })
  if (error) throw new Error('ADMIN_STAFF_ROLE_UPDATE_FAILED')
  return data
}

/**
 * Disable V1 staff access before touching Auth. This ordering is fail-closed:
 * an Auth Admin outage cannot leave a user with V1 service access. A target
 * access token may be supplied only by a trusted backend caller when global
 * refresh-token revocation is required; the database status check protects
 * every request immediately even before an access JWT expires.
 */
export async function disableStaffUser(
  authUserId: string,
  idempotencyKey: string,
  targetAccessToken?: string,
) {
  const db = await requireAdminCapability('admin.staff.disable')
  const { data, error } = await db.schema('dpg_v1_api').rpc('staff_user_disable', {
    p_auth_user_id: authUserId,
    p_idempotency_key: idempotencyKey,
  })
  if (error) throw new Error('ADMIN_STAFF_DISABLE_FAILED')

  const authAdmin = createAuthAdminClient()
  const { error: banError } = await authAdmin.auth.admin.updateUserById(authUserId, {
    ban_duration: '876000h',
  })
  safeAuthError(banError, 'ADMIN_AUTH_DISABLE_FAILED')
  if (targetAccessToken) {
    const { error: revokeError } = await authAdmin.auth.admin.signOut(targetAccessToken, 'global')
    safeAuthError(revokeError, 'ADMIN_AUTH_SESSION_REVOKE_FAILED')
  }
  return data
}
