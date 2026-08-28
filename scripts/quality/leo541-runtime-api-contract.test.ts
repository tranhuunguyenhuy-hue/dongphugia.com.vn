import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migration = readFileSync(resolve(root, 'supabase/migrations/20260828155459_leo541_runtime_api.sql'), 'utf8')
const edgeShared = readFileSync(resolve(root, 'supabase/functions/_shared/runtime.ts'), 'utf8')
const edgeOrders = readFileSync(resolve(root, 'supabase/functions/commerce-orders/index.ts'), 'utf8')
const edgeQuotes = readFileSync(resolve(root, 'supabase/functions/commerce-quotes/index.ts'), 'utf8')
const sqlAcceptance = readFileSync(resolve(root, 'supabase/tests/leo541_runtime_api.sql'), 'utf8')
const concurrencyAcceptance = readFileSync(resolve(root, 'supabase/tests/leo541_concurrency.sql'), 'utf8')
const staticBuilder = readFileSync(resolve(root, 'scripts/static-build/public-static-build.mts'), 'utf8')
const supabaseConfig = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8')

describe('LEO-541 authenticated Supabase runtime contract', () => {
  it('keeps the migration fail-closed and invoker-only', () => {
    expect(migration).toContain('set role dpg_migration')
    expect(migration).toContain('alter table dpg_app.orders add column if not exists owner_id uuid')
    expect(migration).toContain('alter table dpg_app.quote_requests add column if not exists owner_id uuid')
    expect(migration).toContain('enable row level security')
    expect(migration).toContain('force row level security')
    expect(migration).toContain('(select auth.uid())')
    expect(migration).toContain('with check')
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain("extensions.digest(convert_to")
    expect(migration).toContain('security invoker')
    expect(migration).not.toMatch(/^\s*security definer\s*$/m)
    expect(migration).not.toMatch(/^\s*(create|alter) role\b/im)
    expect(migration).not.toMatch(/postgres(?:ql)?:\/\//i)
    expect(migration).not.toMatch(/service[_-]?role[_-]?key/i)
  })

  it('exposes only authenticated Edge entry points and sanitized errors', () => {
    expect(edgeShared).toContain('Authorization')
    expect(edgeShared).toContain('Cache-Control')
    expect(edgeShared).toContain('requireAuthenticatedClient')
    for (const source of [edgeOrders, edgeQuotes]) {
      expect(source).toContain('Deno.serve')
      expect(source).toContain('requireAuthenticatedClient')
      expect(source).not.toMatch(/service[_-]?role/i)
      expect(source).not.toMatch(/DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY/i)
    }
    expect(edgeOrders).toContain("'runtime_order_create'")
    expect(edgeOrders).toContain("'runtime_order_update'")
    expect(edgeOrders).toContain("'runtime_order_delete'")
    expect(edgeQuotes).toContain("'runtime_quote_create'")
    expect(edgeQuotes).toContain("'runtime_quote_update'")
    expect(edgeQuotes).toContain("'runtime_quote_delete'")
    expect(edgeShared).toContain("return jsonResponse({ error: { code: safe.code, request_id: requestId } }")
    expect(supabaseConfig).toMatch(/\[functions\.commerce-orders\][\s\S]*?verify_jwt = true/)
    expect(supabaseConfig).toMatch(/\[functions\.commerce-quotes\][\s\S]*?verify_jwt = true/)
  })

  it('records the required acceptance paths without row or secret output', () => {
    for (const marker of [
      'anonymous RPC unexpectedly succeeded', 'cross-owner read unexpectedly succeeded',
      'duplicate replay assertion failed', 'transaction rollback assertion failed',
      'runtime_audit_events', 'runtime_idempotency_records', 'leo541-rollback-1',
    ]) expect(sqlAcceptance).toContain(marker)
    expect(concurrencyAcceptance).toContain('pg_advisory')
    expect(concurrencyAcceptance).toContain('byte-for-byte equal')
    expect(sqlAcceptance).not.toMatch(/postgres(?:ql)?:\/\/|SERVICE_ROLE|password\s*=/i)
  })

  it('does not add a runtime database import to public static rendering', () => {
    expect(staticBuilder).not.toMatch(/supabase-runtime-contract|SUPABASE_URL|createClient|\.rpc\(/)
  })
})
