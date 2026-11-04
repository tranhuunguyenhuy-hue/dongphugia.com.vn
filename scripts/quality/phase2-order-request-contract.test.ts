import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const guestIntakePath = path.join(root, 'supabase/migrations/20261104154854_phase2_guest_order_intake.sql')
const adminInboxPath = path.join(root, 'supabase/migrations/20261104190000_phase2_admin_order_inbox.sql')
const adminRollbackPath = path.join(root, 'docs/deploy/phase2-admin-order-inbox-rollback.sql')
const guestRollbackPath = path.join(root, 'docs/deploy/phase2-guest-order-intake-rollback.sql')
const supabaseConfigPath = path.join(root, 'supabase/config.toml')

describe('Phase 2 order-request database contract', () => {
  it('keeps guest shipping fees pending only at intake so staff can confirm them later', async () => {
    const [guestMigration, rollback] = await Promise.all([
      readFile(guestIntakePath, 'utf8'),
      readFile(guestRollbackPath, 'utf8'),
    ])

    expect(guestMigration).toContain("and shipping_fee_status = 'pending_confirmation'")
    expect(guestMigration).not.toContain('phase2_public_shipping_fee_pending_check')
    expect(rollback).not.toContain('phase2_public_shipping_fee_pending_check')
  })

  it('keeps the Admin transition invoker-scoped behind the private dpg_app schema', async () => {
    const [adminMigration, rollback, config] = await Promise.all([
      readFile(adminInboxPath, 'utf8'),
      readFile(adminRollbackPath, 'utf8'),
      readFile(supabaseConfigPath, 'utf8'),
    ])
    const statusFunction = adminMigration.match(/create function public\.phase2_admin_order_update_status\([\s\S]*?as \$\$/i)?.[0]
    const statusGuard = adminMigration.match(/create function dpg_app\.phase2_guard_order_status_update\(\)[\s\S]*?as \$\$/i)?.[0]

    expect(statusFunction).toBeDefined()
    expect(statusFunction).toMatch(/security invoker/i)
    expect(statusFunction).not.toMatch(/security definer/i)
    expect(statusGuard).toBeDefined()
    expect(statusGuard).toMatch(/security invoker/i)
    expect(statusGuard).not.toMatch(/security definer/i)
    expect(adminMigration).toContain("and c.relrowsecurity and c.relforcerowsecurity")
    expect(adminMigration).toContain("grant update (status, updated_at, payment_status, assigned_to, internal_note) on table dpg_app.orders to authenticated")
    expect(adminMigration).toContain("grant select, insert, update, delete\n  on table dpg_app.phase2_admin_order_status_idempotency to authenticated")
    expect(adminMigration).toContain('where auth_user_id = auth.uid()')
    expect(adminMigration).toContain('create trigger phase2_order_status_guard')
    expect(adminMigration).toContain('before update of status, payment_status on dpg_app.orders')
    expect(adminMigration).toContain("if old.order_origin is distinct from 'public_web' and new.order_origin is distinct from 'public_web' then")
    expect(adminMigration).toContain("raise exception 'PHASE2_PAYMENT_CONFIRMATION_OUT_OF_SCOPE'")
    expect(adminMigration).toContain("raise exception 'PHASE2_STATUS_RPC_REQUIRED'")
    expect(adminMigration).toContain("insert into dpg_app.audit_logs (")
    expect(adminMigration).toContain("perform set_config('dpg.phase2.order_status_key_hash', v_key_hash, true)")
    expect(config).toMatch(/schemas\s*=\s*\["public",\s*"graphql_public",\s*"dpg_v1_api"\]/)
    expect(config).not.toMatch(/schemas\s*=\s*\[[^\]]*"dpg_app"/)
    expect(rollback).not.toContain('phase2_admin_order_requests_update')
    expect(rollback).toContain('drop trigger phase2_order_status_guard on dpg_app.orders')
    expect(rollback).toContain('drop function dpg_app.phase2_guard_order_status_update()')
    expect(rollback).toContain('revoke update (status, updated_at, payment_status, assigned_to, internal_note) on table dpg_app.orders from authenticated')
  })
})
