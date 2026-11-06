import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261106210000_phase2_admin_sales_search.sql'), 'utf8')

describe('Phase 2 Admin order search migration', () => {
  it('uses an invoker RPC with the existing staff capability boundary', () => {
    expect(migration).toContain('security invoker')
    expect(migration).toContain("dpg_app.leo542_admin_can('orders:read')")
    expect(migration).toContain("dpg_app.leo542_admin_can('orders:read_assigned')")
    expect(migration).toContain('grant execute on function public.phase2_admin_order_search')
    expect(migration).toContain('to authenticated')
    expect(migration).toContain('from public, anon, service_role')
    expect(migration).toContain('grant create on schema public to dpg_migration')
    expect(migration).toContain('revoke create on schema public from dpg_migration')
    expect(migration).toContain("has_schema_privilege('dpg_migration', 'public', 'CREATE')")
  })

  it('limits search to public guest orders and bounds user input', () => {
    expect(migration).toContain("o.order_origin = 'public_web'")
    expect(migration).toContain("length(v_search) > 100")
    expect(migration).toContain('strpos(lower(coalesce(o.customer_phone,')
    expect(migration).toContain('p_limit > 50')
  })
})
