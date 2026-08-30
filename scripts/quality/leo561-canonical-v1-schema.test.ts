import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Client, Pool } from 'pg'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const supabaseMigrationPath = path.join(root, 'supabase/migrations/20260830004338_leo561_canonical_v1_schema.sql')
const runnerMigrationPath = path.join(root, 'db/postgres-migrations/0002_leo561_canonical_v1_schema/migration.sql')
const acceptancePath = path.join(root, 'supabase/tests/leo561_canonical_v1_schema.sql')
const integrationUrl = process.env.LEO561_SCHEMA_TEST_URL

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

describe('LEO-561 canonical V1 schema contract', () => {
  it('keeps the Supabase and checksum-runner migrations byte-for-byte identical', async () => {
    const [supabaseMigration, runnerMigration, manifestText, checksums] = await Promise.all([
      readFile(supabaseMigrationPath, 'utf8'),
      readFile(runnerMigrationPath, 'utf8'),
      readFile(path.join(root, 'db/postgres-migrations/manifest.json'), 'utf8'),
      readFile(path.join(root, 'db/postgres-migrations/checksums.sha256'), 'utf8'),
    ])

    expect(supabaseMigration).toBe(runnerMigration)
    expect(JSON.parse(manifestText).migrations).toContainEqual({
      name: 'leo561-canonical-v1-schema',
      path: '0002_leo561_canonical_v1_schema/migration.sql',
    })
    expect(checksums).toContain(`${sha256(runnerMigration)}  0002_leo561_canonical_v1_schema/migration.sql`)
  })

  it('declares a private canonical authority without legacy compatibility fields', async () => {
    const sql = await readFile(supabaseMigrationPath, 'utf8')
    expect(sql).toContain('create schema if not exists dpg_v1')
    expect(sql).toContain('create table dpg_v1.products')
    expect(sql).toContain('create table dpg_v1.product_family_memberships')
    expect(sql).toContain('create table dpg_v1.quote_requests')
    expect(sql).toContain('create table dpg_v1.quotes')
    expect(sql).toContain('create function dpg_v1.convert_quote_to_order')
    expect(sql).toContain("create type dpg_v1.staff_role as enum ('Product', 'Sales', 'Marketing', 'Admin')")
    expect(sql).toContain('product_attribute_values_official_verified_provenance_check')
    expect(sql).toContain("quality not in ('official', 'verified') or source_provenance_id is not null")
    expect(sql).toContain('content_entries_landing_route_reserved_check')
    expect(sql).toContain("'/san-pham'")
    expect(sql).toContain("'^/(?:tim-kiem|danh-muc|thuong-hieu|san-pham")
    const productsDefinition = sql.split('create table dpg_v1.products (')[1]?.split('\n);')[0] ?? ''
    expect(productsDefinition).not.toMatch(/\b(specs|variant_group|variant_group_id|is_master|price_display|original_price)\b/)
    const familyDefinition = sql.split('create table dpg_v1.product_families (')[1]?.split('\n);')[0] ?? ''
    expect(familyDefinition).not.toMatch(/\b(retail_price|availability|publication_status|slug)\b/)
  })

  it.runIf(Boolean(integrationUrl))('applies cleanly, passes invariants, and serializes concurrent Quote conversion', async () => {
    const client = new Client({ connectionString: integrationUrl })
    await client.connect()
    try {
      const migration = await readFile(supabaseMigrationPath, 'utf8')
      const acceptance = (await readFile(acceptancePath, 'utf8')).replace(/^\\set[^\n]*\n/, '')
      await client.query(migration)
      await client.query(acceptance)

      await client.query(`
        insert into dpg_v1.quote_requests (
          id, request_number, customer_name, customer_phone
        ) values (
          '30000000-0000-4000-8000-000000000001', 'QR-LEO561-CONCURRENCY',
          'Synthetic Concurrent Customer', '0900000000'
        );
        insert into dpg_v1.quotes (
          id, quote_number, quote_request_id, status, version,
          customer_name_snapshot, customer_phone_snapshot,
          subtotal, total, issued_at, expires_at
        ) values (
          '31000000-0000-4000-8000-000000000001', 'Q-LEO561-CONCURRENCY',
          '30000000-0000-4000-8000-000000000001', 'ISSUED', 7,
          'Synthetic Concurrent Customer', '0900000000',
          100000, 100000, clock_timestamp(), clock_timestamp() + interval '1 day'
        );
        insert into dpg_v1.quote_lines (
          quote_id, sort_order, product_sku_snapshot, product_model_snapshot,
          product_name_snapshot, brand_name_snapshot, primary_category_name_snapshot,
          availability_snapshot, quantity, unit_price, snapshot_at
        ) values (
          '31000000-0000-4000-8000-000000000001', 0, 'SYNTHETIC-SKU', 'SYNTHETIC-MODEL',
          'Synthetic Product', 'Synthetic Brand', 'Synthetic Category',
          'IN_STOCK', 1, 100000, clock_timestamp()
        );
      `)
    } finally {
      await client.end()
    }

    const pool = new Pool({ connectionString: integrationUrl, max: 3 })
    try {
      const convert = () => pool.query<{ order_id: string }>(
        `select dpg_v1.convert_quote_to_order($1, $2, $3) as order_id`,
        ['31000000-0000-4000-8000-000000000001', 7, 'leo561-concurrency-key'],
      )
      const [first, second] = await Promise.all([convert(), convert()])
      expect(first.rows[0]?.order_id).toBe(second.rows[0]?.order_id)

      const count = await pool.query<{ count: number }>(
        `select count(*)::int as count from dpg_v1.orders where source_quote_id = $1`,
        ['31000000-0000-4000-8000-000000000001'],
      )
      expect(count.rows[0]?.count).toBe(1)

      await expect(pool.query(
        `select dpg_v1.convert_quote_to_order($1, $2, $3)`,
        ['31000000-0000-4000-8000-000000000001', 8, 'leo561-concurrency-key'],
      )).rejects.toThrow(/IDEMPOTENCY_KEY_REUSED/)
    } finally {
      await pool.end()
    }
  })
})
