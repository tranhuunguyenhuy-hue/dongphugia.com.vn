import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const guestIntakePath = path.join(root, 'supabase/migrations/20261104154854_phase2_guest_order_intake.sql')
const adminInboxPath = path.join(root, 'supabase/migrations/20261104190000_phase2_admin_order_inbox.sql')
const adminConfirmationPath = path.join(root, 'supabase/migrations/20261106144139_phase2_admin_order_confirmation.sql')
const adminRollbackPath = path.join(root, 'docs/deploy/phase2-admin-order-inbox-rollback.sql')
const guestRollbackPath = path.join(root, 'docs/deploy/phase2-guest-order-intake-rollback.sql')
const supabaseConfigPath = path.join(root, 'supabase/config.toml')
const legacyAdminCommercePath = path.join(root, 'supabase/functions/admin-commerce/index.ts')
const separateAdminOrderActionsPath = path.join(root, 'apps/admin/app/orders/actions.ts')

describe('Phase 2 order-request database contract', () => {
  it('binds every requested line to the selected exact SKU', async () => {
    const guestMigration = await readFile(guestIntakePath, 'utf8')
    const createFunction = guestMigration.match(/create function public\.guest_order_request_create\([\s\S]*?\n\$\$;/i)?.[0]

    expect(createFunction).toBeDefined()
    expect(createFunction).toContain("jsonb_typeof(v_item -> 'sku') is distinct from 'string'")
    expect(createFunction).toContain("and sku = btrim(v_item ->> 'sku')")
    expect(createFunction).toContain("v_request_hash := dpg_app.runtime_hash(p_input)")
  })

  it('restricts guest intake RPCs to the dedicated backend role', async () => {
    const [guestMigration, rollback] = await Promise.all([
      readFile(guestIntakePath, 'utf8'),
      readFile(guestRollbackPath, 'utf8'),
    ])
    const guestFunctions = guestMigration.match(/create function public\.guest_order_request_(?:create|receipt)\([\s\S]*?\n\$\$;/gi) ?? []

    expect(guestMigration).toContain("rolname = 'dpg_order_intake_function_owner'")
    expect(guestMigration).toContain('grant dpg_order_intake_function_owner to dpg_migration\n  with set true, inherit false, admin false;')
    expect(guestMigration).toContain('revoke dpg_order_intake_function_owner from dpg_migration;')
    expect(guestMigration).toContain('grant execute on function public.guest_order_request_create(jsonb, text, uuid) to dpg_order_intake')
    expect(guestMigration).toContain('grant execute on function public.guest_order_request_receipt(text) to dpg_order_intake')
    expect(guestMigration).not.toMatch(/grant execute on function public\.guest_order_request_(?:create|receipt)[^;]*\bto anon/i)
    expect(guestMigration).not.toMatch(/create policy phase2_guest_[^;]*\bto anon/i)
    expect(guestFunctions).toHaveLength(2)
    for (const guestFunction of guestFunctions) {
      expect(guestFunction).toMatch(/security definer/i)
      expect(guestFunction).toMatch(/set search_path = pg_catalog, dpg_app/i)
      expect(guestFunction).toMatch(/set row_security = on/i)
    }
    expect(guestMigration).toContain("has_function_privilege('anon', 'public.guest_order_request_create(jsonb,text,uuid)', 'EXECUTE')")
    expect(guestMigration).toContain("has_function_privilege('authenticated', 'public.guest_order_request_create(jsonb,text,uuid)', 'EXECUTE')")
    expect(guestMigration).toContain("has_function_privilege('dpg_order_intake', 'public.guest_order_request_create(jsonb,text,uuid)', 'EXECUTE')")
    expect(guestMigration).toContain("has_function_privilege('dpg_order_intake_function_owner', 'public.guest_order_request_create(jsonb,text,uuid)', 'EXECUTE')")
    expect(rollback).toContain('revoke all on function public.guest_order_request_create(jsonb, text, uuid),')
    expect(rollback).toContain('from public, anon, authenticated, service_role, dpg_order_intake, dpg_order_intake_login')
  })

  it('keeps guest shipping fees pending only at intake so staff can confirm them later', async () => {
    const [guestMigration, rollback] = await Promise.all([
      readFile(guestIntakePath, 'utf8'),
      readFile(guestRollbackPath, 'utf8'),
    ])

    expect(guestMigration).toContain("and shipping_fee_status = 'pending_confirmation'")
    expect(guestMigration).not.toContain('phase2_public_shipping_fee_pending_check')
    expect(rollback).not.toContain('phase2_public_shipping_fee_pending_check')
  })

  it('keeps guest order idempotency valid for delayed retries without delete access', async () => {
    const [guestMigration, rollback] = await Promise.all([
      readFile(guestIntakePath, 'utf8'),
      readFile(guestRollbackPath, 'utf8'),
    ])
    const idempotencyTable = guestMigration.match(/create table dpg_app\.guest_order_idempotency_records\s*\(([\s\S]*?)\);/i)?.[1]
    const createFunction = guestMigration.match(/create function public\.guest_order_request_create\([\s\S]*?\n\$\$;/i)?.[0]
    const receiptFunction = guestMigration.match(/create function public\.guest_order_request_receipt\([\s\S]*?\n\$\$;/i)?.[0]

    expect(idempotencyTable).toBeDefined()
    expect(idempotencyTable).not.toMatch(/expires_at/i)
    expect(guestMigration).not.toContain('idx_guest_order_idempotency_expiry')
    expect(createFunction).toBeDefined()
    expect(createFunction).not.toMatch(/delete\s+from\s+dpg_app\.guest_order_idempotency_records/i)
    expect(receiptFunction).toBeDefined()
    expect(receiptFunction).not.toMatch(/expires_at/i)
    expect(guestMigration).toContain('create policy phase2_guest_idempotency_select')
    expect(guestMigration).toContain('create policy phase2_guest_idempotency_insert')
    expect(guestMigration).toContain("or has_table_privilege('dpg_order_intake', 'dpg_app.guest_order_idempotency_records', 'DELETE')")
    expect(rollback).toContain('drop policy phase2_guest_idempotency_select')
    expect(rollback).toContain('drop policy phase2_guest_idempotency_insert')
  })

  it('keeps the legacy Admin order patch and guest-request transition RPC separate', async () => {
    const [legacyAdminCommerce, separateAdminOrderActions] = await Promise.all([
      readFile(legacyAdminCommercePath, 'utf8'),
      readFile(separateAdminOrderActionsPath, 'utf8'),
    ])

    expect(legacyAdminCommerce).toContain("callRpc(client,'leo542_admin_commerce_patch'")
    expect(legacyAdminCommerce).not.toContain('phase2_admin_order_update_status')
    expect(separateAdminOrderActions).toContain("['received', 'inventory_check', 'completed', 'cancelled']")
    expect(separateAdminOrderActions).not.toContain("'confirmed', 'cancelled'")
    expect(separateAdminOrderActions).toContain("'phase2_admin_order_update_status'")
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

  it('keeps commercial confirmation atomic, immutable, idempotent, and staff-only', async () => {
    const migration = await readFile(adminConfirmationPath, 'utf8')
    const confirmFunction = migration.match(/create function public\.phase2_admin_order_confirm\([\s\S]*?\n\$\$;/i)?.[0]
    expect(confirmFunction).toBeDefined()
    expect(confirmFunction).toMatch(/security definer/i)
    expect(confirmFunction).toMatch(/set search_path = ''/i)
    expect(confirmFunction).toContain("dpg_app.leo542_admin_can('orders:update_status')")
    expect(confirmFunction).toContain("dpg_app.leo542_admin_can('orders:read_assigned')")
    expect(confirmFunction).toContain("raise exception 'ORDER_ALREADY_CONFIRMED'")
    expect(confirmFunction).toContain('dpg_app.phase2_order_confirmations')
    expect(migration).toContain('alter table dpg_app.phase2_order_confirmations force row level security')
    expect(migration).toContain('order_id, base_total, shipping_fee, installation_fees, confirmed_total, confirmed_at')
    expect(migration).toContain('on table dpg_app.phase2_order_confirmations to authenticated')
    expect(migration).toContain("from public, anon, authenticated, service_role")
    expect(migration).toContain('to authenticated;')
    expect(migration).toContain("raise exception 'ORDER_COMMERCIAL_CONFIRMATION_REQUIRED'")
    expect(migration).toContain("'phase2.order.commercial.confirmed'")
    expect(migration).not.toMatch(/set\s+payment_status\s*=/i)
    expect(migration).not.toMatch(/set\s+(?:unit_price|total_price|discount)\s*=/i)
  })
})
