import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { describe, expect, it } from 'vitest'
import { COPY_CONTRACT, EXCLUDED_TABLES, runCatalogueShadowCopy } from './leo560-shadow-copy'

const integrationUrl = process.env.LEO561_SCHEMA_TEST_URL
const ROOT_IDS = [1, 2, 3, 4].map((suffix) => `10000000-0000-4000-8000-00000000000${suffix}`)
const EXPECTED_COUNTS = {
  brands: 1,
  categories: 5,
  products: 1,
  product_source_provenance: 1,
  attribute_definitions: 1,
  attribute_options: 1,
  category_attribute_policies: 1,
  product_attribute_values: 1,
  product_attribute_multi_options: 0,
}

function databaseUrl(name: string) {
  const url = new URL(integrationUrl!)
  url.pathname = `/${name}`
  return url.toString()
}

async function createContractSchema(client: Client) {
  await client.query('create schema dpg_v1')
  for (const contract of COPY_CONTRACT) {
    await client.query(`create table dpg_v1.${contract.table} (${contract.columns.map((column) => `${column} text`).join(',')})`)
  }
  for (const table of EXCLUDED_TABLES) {
    await client.query(`create table dpg_v1.${table} (id text)`)
  }
  for (const id of ROOT_IDS) {
    await client.query('insert into dpg_v1.categories (id, parent_id) values ($1, null)', [id])
  }
}

async function seedSource(client: Client) {
  const leaf = '20000000-0000-4000-8000-000000000001'
  const attribute = '30000000-0000-4000-8000-000000000001'
  await client.query(`
    insert into dpg_v1.brands (id, name) values ('21000000-0000-4000-8000-000000000001', 'Synthetic');
    insert into dpg_v1.categories (id, parent_id) values ('${leaf}', '${ROOT_IDS[0]}');
    insert into dpg_v1.products (id, brand_id, primary_category_id) values ('22000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', '${leaf}');
    insert into dpg_v1.product_source_provenance (id, product_id) values ('23000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001');
    insert into dpg_v1.attribute_definitions (id, attribute_key) values ('${attribute}', 'synthetic');
    insert into dpg_v1.attribute_options (id, attribute_definition_id) values ('31000000-0000-4000-8000-000000000001', '${attribute}');
    insert into dpg_v1.category_attribute_policies (category_id, attribute_definition_id) values ('${leaf}', '${attribute}');
    insert into dpg_v1.product_attribute_values (id, product_id, attribute_definition_id) values ('32000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '${attribute}');
  `)
}

type Pair = {
  source: Client
  target: Client
  cleanup: () => Promise<void>
}

async function createPair(label: string): Promise<Pair> {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
  const sourceName = `leo560_${label}_source_${suffix}`
  const targetName = `leo560_${label}_target_${suffix}`
  const adminUrl = databaseUrl('postgres')
  const admin = new Client({ connectionString: adminUrl })
  await admin.connect()
  await admin.query(`create database ${sourceName}`)
  await admin.query(`create database ${targetName}`)
  const source = new Client({ connectionString: databaseUrl(sourceName) })
  const target = new Client({ connectionString: databaseUrl(targetName) })
  await source.connect()
  await target.connect()
  await createContractSchema(source)
  await createContractSchema(target)
  await seedSource(source)
  await target.query("insert into dpg_v1.orders (id) values ('excluded-sentinel')")
  return {
    source,
    target,
    cleanup: async () => {
      await Promise.allSettled([source.end(), target.end()])
      await admin.query('select pg_terminate_backend(pid) from pg_stat_activity where datname = any($1::text[])', [[sourceName, targetName]])
      await admin.query(`drop database if exists ${sourceName}`)
      await admin.query(`drop database if exists ${targetName}`)
      await admin.end()
    },
  }
}

const baseOptions = (pair: Pair) => ({
  mode: 'apply' as const,
  source: pair.source,
  target: pair.target,
  expectedCounts: EXPECTED_COUNTS,
  hardCeilingBytes: 10_000,
  attestTarget: async () => undefined,
  measureSourceCatalogueBytes: async () => 100,
})

describe('LEO-560 persistent catalogue shadow-copy path', () => {
  it.runIf(Boolean(integrationUrl))('commits an exact copy, preserves excluded rows, and refuses a non-empty target', async () => {
    const pair = await createPair('success')
    try {
      const result = await runCatalogueShadowCopy({
        ...baseOptions(pair),
        measureDatabaseBytes: async () => 1_000,
      })
      expect(result.targetCatalogueDigest).toBe(result.sourceCatalogueDigest)
      expect((await pair.target.query('select count(*)::int count from dpg_v1.brands')).rows[0]?.count).toBe(1)
      expect((await pair.target.query('select id from dpg_v1.orders')).rows).toEqual([{ id: 'excluded-sentinel' }])
      await expect(runCatalogueShadowCopy({
        ...baseOptions(pair),
        measureDatabaseBytes: async () => 1_000,
      })).rejects.toThrow('target_not_empty_brands')
    } finally {
      await pair.cleanup()
    }
  }, 60_000)

  it.runIf(Boolean(integrationUrl))('rolls back every catalogue row when the read-back digest changes', async () => {
    const pair = await createPair('digest')
    try {
      await pair.target.query(`
        create function dpg_v1.mutate_brand() returns trigger language plpgsql as $$
        begin new.name := 'changed-by-trigger'; return new; end $$;
        create trigger mutate_brand before insert on dpg_v1.brands
          for each row execute function dpg_v1.mutate_brand();
      `)
      await expect(runCatalogueShadowCopy({
        ...baseOptions(pair),
        measureDatabaseBytes: async () => 1_000,
      })).rejects.toThrow('target_catalogue_digest_mismatch')
      expect((await pair.target.query('select count(*)::int count from dpg_v1.brands')).rows[0]?.count).toBe(0)
      expect((await pair.target.query('select count(*)::int count from dpg_v1.categories')).rows[0]?.count).toBe(4)
    } finally {
      await pair.cleanup()
    }
  }, 60_000)

  it.runIf(Boolean(integrationUrl))('rolls back when the measured size crosses the hard ceiling before commit', async () => {
    const pair = await createPair('size')
    let measurements = 0
    try {
      await expect(runCatalogueShadowCopy({
        ...baseOptions(pair),
        measureDatabaseBytes: async () => {
          measurements += 1
          return measurements === 1 ? 1_000 : 20_000
        },
      })).rejects.toThrow('database_size_exceeds_350_mib_before_commit')
      expect((await pair.target.query('select count(*)::int count from dpg_v1.products')).rows[0]?.count).toBe(0)
      expect((await pair.target.query('select id from dpg_v1.orders')).rows).toEqual([{ id: 'excluded-sentinel' }])
    } finally {
      await pair.cleanup()
    }
  }, 60_000)
})
