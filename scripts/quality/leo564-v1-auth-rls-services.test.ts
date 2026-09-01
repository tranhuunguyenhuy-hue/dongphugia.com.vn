import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Client, Pool } from 'pg'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migrationPath = path.join(root, 'supabase/migrations/20260831173342_leo564_v1_auth_rls_services.sql')
const canonicalMigrationPath = path.join(root, 'supabase/migrations/20260830004338_leo561_canonical_v1_schema.sql')
const acceptancePath = path.join(root, 'supabase/tests/leo564_v1_auth_rls_services.sql')
const configPath = path.join(root, 'supabase/config.toml')
const integrationUrl = process.env.LEO564_SCHEMA_TEST_URL
const disposableIntegration = Boolean(
  integrationUrl &&
  process.env.LEO564_SCHEMA_TEST_CONFIRM === 'disposable' &&
  isLoopbackConnection(integrationUrl),
)

function isLoopbackConnection(value: string) {
  try {
    const hostname = new URL(value).hostname.replace(/^\[|\]$/g, '')
    return ['localhost', '127.0.0.1', '::1'].includes(hostname)
  } catch {
    return false
  }
}

async function bootstrapDisposableDatabase(client: Client) {
  await client.query('set search_path = public, extensions')
  await client.query('create schema if not exists extensions')
  const pgcrypto = await client.query<{ schema_name: string | null }>(`
    select n.nspname as schema_name
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto'
  `)
  if (!pgcrypto.rows[0]) {
    await client.query('create extension pgcrypto with schema extensions')
  } else if (pgcrypto.rows[0].schema_name !== 'extensions') {
    await client.query('alter extension pgcrypto set schema extensions')
  }
  await client.query('create schema if not exists auth')

  const roles = ['anon', 'authenticated', 'service_role']
  for (const role of roles) {
    const result = await client.query<{ present: boolean }>(
      'select exists (select 1 from pg_roles where rolname = $1) as present',
      [role],
    )
    if (!result.rows[0]?.present) await client.query(`create role "${role}" nologin`)
  }

  const authUid = await client.query<{ present: boolean }>(
    "select to_regprocedure('auth.uid()') is not null as present",
  )
  if (!authUid.rows[0]?.present) {
    await client.query(`
      create function auth.uid()
      returns uuid
      language sql
      stable
      as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$
    `)
  }
  await client.query('grant usage on schema auth, extensions to anon, authenticated')
}

async function installLocalSchema(client: Client) {
  const existing = await client.query<{ present: boolean }>(
    "select to_regclass('dpg_v1.products') is not null as present",
  )
  if (existing.rows[0]?.present) throw new Error('LEO564_TEST_DATABASE_NOT_BLANK')
  await bootstrapDisposableDatabase(client)
  await client.query(await readFile(canonicalMigrationPath, 'utf8'))
  await client.query(await readFile(migrationPath, 'utf8'))
}

async function setupConcurrencyFixtures(client: Client) {
  await client.query(`
    insert into dpg_v1.brands (id, name, slug)
    values ('57000000-0000-4000-8000-000000000001', 'LEO-564 Concurrent Brand', 'leo-564-concurrent-brand');
    insert into dpg_v1.categories (id, parent_id, sector, name, slug, is_leaf, sort_order)
    values ('57100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004',
      'kitchen', 'LEO-564 Concurrent Category', 'leo-564-concurrent-category', true, 0);
    insert into dpg_v1.products (
      id, sku, model, name, slug, brand_id, primary_category_id, retail_price, availability, status
    ) values (
      '57200000-0000-4000-8000-000000000001', 'LEO564-C1', 'LEO564-CM1',
      'LEO-564 Concurrent Product', 'leo-564-concurrent-product',
      '57000000-0000-4000-8000-000000000001',
      '57100000-0000-4000-8000-000000000001', 99000, 'IN_STOCK', 'DRAFT'
    );
    insert into dpg_v1.product_source_provenance (
      id, product_id, source_kind, source_reference, quality, captured_at
    ) values (
      '57300000-0000-4000-8000-000000000001', '57200000-0000-4000-8000-000000000001',
      'catalogue', 'synthetic:leo564:concurrency', 'verified', clock_timestamp()
    );
    insert into dpg_v1.media_assets (
      id, kind, original_object_key, delivery_object_key, profile_version, sha256,
      mime_type, byte_size, width_px, height_px, provenance, state
    ) values (
      '57400000-0000-4000-8000-000000000001', 'IMAGE',
      'private/leo564/concurrent.webp', 'public/leo564/concurrent.webp', 'product-v1',
      repeat('e', 64), 'image/webp', 1024, 1000, 1000, 'synthetic', 'READY'
    );
    insert into dpg_v1.product_media (product_id, media_asset_id, role, sort_order, alt_text)
    values ('57200000-0000-4000-8000-000000000001',
      '57400000-0000-4000-8000-000000000001', 'PRIMARY', 0, 'Synthetic concurrent primary');
    update dpg_v1.products
      set status = 'PUBLISHED', published_at = clock_timestamp(), version = version + 1
    where id = '57200000-0000-4000-8000-000000000001';

    insert into dpg_v1.staff_users (auth_user_id, email, display_name, status)
    values ('57500000-0000-4000-8000-000000000001', 'concurrent-admin@example.invalid', 'Concurrent Admin', 'active');
    insert into dpg_v1.staff_user_roles (auth_user_id, role)
    values ('57500000-0000-4000-8000-000000000001', 'Admin');
    insert into dpg_v1.quote_requests (id, request_number, customer_name, customer_phone)
    values ('57600000-0000-4000-8000-000000000001', 'QR-LEO564-CONCURRENT', 'Concurrent Customer', '0900000009');
    insert into dpg_v1.quote_request_lines (
      id, quote_request_id, product_id, sort_order, product_sku_snapshot,
      product_model_snapshot, product_name_snapshot, brand_name_snapshot,
      primary_category_name_snapshot, retail_price_snapshot, availability_snapshot,
      requested_quantity, snapshot_at
    ) values (
      '57700000-0000-4000-8000-000000000001', '57600000-0000-4000-8000-000000000001',
      '57200000-0000-4000-8000-000000000001', 0, 'LEO564-C1', 'LEO564-CM1',
      'LEO-564 Concurrent Product', 'LEO-564 Concurrent Brand',
      'LEO-564 Concurrent Category', 99000, 'IN_STOCK', 1, clock_timestamp()
    );
    insert into dpg_v1.quotes (
      id, quote_number, quote_request_id, status, version,
      customer_name_snapshot, customer_phone_snapshot,
      subtotal, total, issued_at, expires_at
    ) values (
      '57800000-0000-4000-8000-000000000001', 'Q-LEO564-CONCURRENT',
      '57600000-0000-4000-8000-000000000001', 'ISSUED', 1,
      'Concurrent Customer', '0900000009', 99000, 99000,
      clock_timestamp(), clock_timestamp() + interval '1 day'
    );
    insert into dpg_v1.quote_lines (
      id, quote_id, product_id, sort_order, product_sku_snapshot,
      product_model_snapshot, product_name_snapshot, brand_name_snapshot,
      primary_category_name_snapshot, availability_snapshot, quantity,
      unit_price, snapshot_at
    ) values (
      '57900000-0000-4000-8000-000000000001', '57800000-0000-4000-8000-000000000001',
      '57200000-0000-4000-8000-000000000001', 0, 'LEO564-C1', 'LEO564-CM1',
      'LEO-564 Concurrent Product', 'LEO-564 Concurrent Brand',
      'LEO-564 Concurrent Category', 'IN_STOCK', 1, 99000, clock_timestamp()
    );
  `)
}

async function runConcurrentRpc(
  pool: Pool,
  role: 'anon' | 'authenticated',
  userId: string,
  query: string,
  values: unknown[],
) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(`set local role ${role}`)
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
    const result = await client.query(query, values)
    await client.query('commit')
    return result.rows[0]?.result
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

describe('LEO-564 V1 Auth, RLS, and service-boundary contract', () => {
  it('keeps V1 private, fixed-role, invoker-only, and legacy-independent', async () => {
    const [migration, config, browser, server, proxy, adapter, routes, routeTest, page] = await Promise.all([
      readFile(migrationPath, 'utf8'),
      readFile(configPath, 'utf8'),
      readFile(path.join(root, 'apps/admin/src/supabase/browser.ts'), 'utf8'),
      readFile(path.join(root, 'apps/admin/src/supabase/server.ts'), 'utf8'),
      readFile(path.join(root, 'apps/admin/src/supabase/proxy.ts'), 'utf8'),
      readFile(path.join(root, 'apps/admin/src/auth-admin/adapter.ts'), 'utf8'),
      readFile(path.join(root, 'apps/admin/src/routes.ts'), 'utf8'),
      readFile(path.join(root, 'apps/admin/src/routes.test.ts'), 'utf8'),
      readFile(path.join(root, 'apps/admin/app/page.tsx'), 'utf8'),
    ])

    expect(migration).toContain('create schema if not exists dpg_v1_api')
    expect(migration).toContain("('Product', 'catalogue.publish')")
    expect(migration).not.toContain("('Sales', 'sales.quote.convert')")
    expect(migration).toContain("('Admin', 'admin.staff.assign_roles')")
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain('IDEMPOTENCY_KEY_REUSED')
    expect(migration).not.toMatch(/(?:from|join|update|insert into|delete from)\s+dpg_app\./i)
    expect(migration).not.toMatch(/admin_users|bcrypt|user_metadata|raw_user_meta_data|password_hash|primary_role/i)
    expect(migration).toContain('revoke all on all functions in schema dpg_v1_api')

    const apiSection = migration.slice(migration.indexOf('create function dpg_v1_api.staff_context()'))
    expect(apiSection).not.toMatch(/^security definer$/m)
    expect(migration).toContain('security definer')
    expect(migration).toContain('set search_path = pg_catalog, dpg_v1')
    expect(migration).toContain('dpg_v1_api.order_intake_create(jsonb, text)')
    expect(migration).toContain('dpg_v1_api.sales_quote_convert(uuid, integer, text)')
    expect(migration).toContain('share_token')
    expect(migration).toContain("status in ('ISSUED', 'CONVERTED')")
    expect(migration).not.toContain('grant execute on all functions in schema dpg_v1_api')

    expect(config).toContain('dpg_v1_api')
    expect(config).toContain('enable_signup = false')
    expect(config).toContain('enable_anonymous_sign_ins = false')
    expect(config).toContain('minimum_password_length = 12')
    expect(browser).toContain("auth: { flowType: 'pkce' }")
    expect(browser).not.toMatch(/SUPABASE_SECRET_KEY|sb_secret_|service_role/i)
    expect(server).toContain("import 'server-only'")
    expect(server).toContain('createServerClient')
    expect(proxy).toContain('getClaims')
    expect(proxy).toContain('private, no-store')
    expect(adapter).toContain("import 'server-only'")
    expect(adapter).toContain('getAdminSupabaseSecretKey')
    expect(adapter).toContain("secretKey.startsWith('sb_secret_')")
    expect(adapter).not.toContain('user_metadata')
    expect(routes).toContain('ADMIN_ROUTE_OWNERSHIP')
    expect(routeTest).toContain("'/auth/callback'")
    expect(routeTest).toContain("'/reset-password'")
    expect(page).toContain('requireActiveStaff')
    expect(page).not.toMatch(/dashboard|product-list|quote-board/i)
  })

  it('records the complete sanitized local acceptance matrix', async () => {
    const acceptance = await readFile(acceptancePath, 'utf8')
    for (const marker of [
      'multi-role union assertion failed',
      'invited identity did not fail closed',
      'invited identity retained direct RLS visibility',
      'disabled identity did not fail closed',
      'disabled identity retained direct RLS visibility',
      'guest isolation exposed another intake',
      'guest staff query unexpectedly succeeded',
      'Product publication rollback assertion failed',
      'stale Product publication unexpectedly succeeded',
      'forged commercial total was accepted',
      'guest Order replay assertion failed',
      'invalid guest Order left a reservation',
      'Quote Request snapshot assertion failed',
      'Content publication rollback assertion failed',
      'Shareable Quote projection leaked private data',
      'payment projection assertion failed',
      'immutable payment transaction unexpectedly deleted',
      'Quote conversion replay assertion failed',
      'last active Admin disable unexpectedly succeeded',
      'leo564_v1_auth_rls_services',
    ]) expect(acceptance).toContain(marker)
    expect(acceptance).not.toMatch(/postgres(?:ql)?:\/\/|SERVICE_ROLE|password\s*=/i)
  })

  it.runIf(disposableIntegration)('applies a blank disposable database, passes the matrix, and serializes replays', async () => {
    const client = new Client({ connectionString: integrationUrl! })
    await client.connect()
    try {
      await installLocalSchema(client)
      await client.query(await readFile(acceptancePath, 'utf8'))
      await setupConcurrencyFixtures(client)
    } finally {
      await client.end()
    }

    const pool = new Pool({ connectionString: integrationUrl!, max: 4 })
    try {
      const guestInput = JSON.stringify({
        customer: { name: 'Concurrent Guest', phone: '0900000010' },
        shipping: { address: 'Synthetic concurrent address' },
        items: [{ product_id: '57200000-0000-4000-8000-000000000001', quantity: 1 }],
      })
      const [firstOrder, secondOrder] = await Promise.all([
        runConcurrentRpc(pool, 'anon', '',
          'select dpg_v1_api.order_intake_create($1::jsonb, $2::text) as result', [guestInput, 'leo564-concurrent-order']),
        runConcurrentRpc(pool, 'anon', '',
          'select dpg_v1_api.order_intake_create($1::jsonb, $2::text) as result', [guestInput, 'leo564-concurrent-order']),
      ])
      expect(firstOrder).toEqual(secondOrder)

      const orderCount = await pool.query<{ count: number }>(
        "select count(*)::int as count from dpg_v1.orders where order_number = $1",
        [firstOrder.order_number],
      )
      expect(orderCount.rows[0]?.count).toBe(1)

      const convertQuery = 'select dpg_v1_api.sales_quote_convert($1::uuid, $2::integer, $3::text) as result'
      const [firstConvert, secondConvert] = await Promise.all([
        runConcurrentRpc(pool, 'authenticated', '57500000-0000-4000-8000-000000000001', convertQuery,
          ['57800000-0000-4000-8000-000000000001', 1, 'leo564-concurrent-convert']),
        runConcurrentRpc(pool, 'authenticated', '57500000-0000-4000-8000-000000000001', convertQuery,
          ['57800000-0000-4000-8000-000000000001', 1, 'leo564-concurrent-convert']),
      ])
      expect(firstConvert).toEqual(secondConvert)

      const convertedCount = await pool.query<{ count: number }>(
        "select count(*)::int as count from dpg_v1.orders where source_quote_id = '57800000-0000-4000-8000-000000000001'",
      )
      expect(convertedCount.rows[0]?.count).toBe(1)
    } finally {
      await pool.end()
    }
  })

  it('does not silently claim the optional remote/local integration gate', () => {
    if (integrationUrl && !disposableIntegration) {
      expect(isLoopbackConnection(integrationUrl)).toBe(false)
    }
  })
})

export { isLoopbackConnection }
