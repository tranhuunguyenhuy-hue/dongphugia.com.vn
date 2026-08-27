import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Client } from 'pg'
import { describe, expect, it } from 'vitest'
import { attestTarget, parseTargetConnection } from '../db/postgres-target'

const migrationPath = path.join(
  process.cwd(),
  'db/postgres-migrations/0001_ms885_normalized_family/migration.sql',
)

const canonicalMembers = [
  'MS885DE2#XW', 'MS885DE4#XW',
  'MS885DT2#XW', 'MS885DT3#XW', 'MS885DT8#XW',
  'MS885DW4#XW', 'MS885DW6#XW', 'MS885DW7#XW',
  'MS885DW11#XW', 'MS885DW14#XW', 'MS885DW16#XW',
  'MS885DW18#XW', 'MS885CDW12#XW', 'MS885CDW15#XW',
  'MS885CDW17#XW', 'MS885CDW23#XW', 'MS885CDW24#XW',
  'MS885CDW25#XW', 'MS885DW24#XW', 'MS885DW25#XW',
]
const integrationUrl = process.env.MS885_MIGRATION_TEST_URL

describe('MS885 normalized PostgreSQL migration contract', () => {
  it('declares generic Family, configuration-group, and membership relations', async () => {
    const sql = await readFile(migrationPath, 'utf8')

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS product_families')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS product_family_configuration_groups')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS product_family_memberships')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS product_family_catalogue_gaps')
    expect(sql).toContain('FOREIGN KEY (configuration_group_id, family_id)')
    expect(sql).toContain('CONSTRAINT uq_product_family_memberships_family_product UNIQUE (family_id, product_id)')
    expect(sql).not.toContain('CONSTRAINT uq_product_family_memberships_product UNIQUE (product_id)')
    expect(sql).toContain("VALUES ('toto:ms885', 'TOTO MS885', 'toto-catalogue', 'high')")
    expect(sql).toContain("('ecowasher', 'nắp rửa cơ', 0)")
    expect(sql).toContain("('electronic-washlet', 'nắp điện tử', 1)")
    expect(sql).toContain("('soft-close', 'nắp đóng êm', 2)")
  })

  it('contains exactly the approved canonical SKU set and preserves the two catalogue gaps', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    const manifestSection = sql
      .split('INSERT INTO ms885_approved_members')[1]
      .split('\n\n-- Persist approved members')[0]
    const rows = [...manifestSection.matchAll(/\('([^']+)', '([^']+)', (\d+), (true|false)\)/g)]
    const members = rows.map(([, memberKey]) => memberKey)
    const groups = new Map(rows.map(([, memberKey, groupKey]) => [memberKey, groupKey]))

    expect(rows).toHaveLength(20)
    expect(new Set(members)).toEqual(new Set(canonicalMembers))
    expect(groups).toEqual(new Map([
      ['MS885DE2#XW', 'ecowasher'],
      ['MS885DE4#XW', 'ecowasher'],
      ['MS885DT2#XW', 'soft-close'],
      ['MS885DT3#XW', 'soft-close'],
      ['MS885DT8#XW', 'soft-close'],
      ['MS885DW4#XW', 'electronic-washlet'],
      ['MS885DW6#XW', 'electronic-washlet'],
      ['MS885DW7#XW', 'electronic-washlet'],
      ['MS885DW11#XW', 'electronic-washlet'],
      ['MS885DW14#XW', 'electronic-washlet'],
      ['MS885DW16#XW', 'electronic-washlet'],
      ['MS885DW18#XW', 'electronic-washlet'],
      ['MS885CDW12#XW', 'electronic-washlet'],
      ['MS885CDW15#XW', 'electronic-washlet'],
      ['MS885CDW17#XW', 'electronic-washlet'],
      ['MS885CDW23#XW', 'electronic-washlet'],
      ['MS885CDW24#XW', 'electronic-washlet'],
      ['MS885CDW25#XW', 'electronic-washlet'],
      ['MS885DW24#XW', 'electronic-washlet'],
      ['MS885DW25#XW', 'electronic-washlet'],
    ]))
    expect([...groups.values()].filter((groupKey) => groupKey === 'ecowasher')).toHaveLength(2)
    expect([...groups.values()].filter((groupKey) => groupKey === 'electronic-washlet')).toHaveLength(15)
    expect([...groups.values()].filter((groupKey) => groupKey === 'soft-close')).toHaveLength(3)
    expect(sql).toContain("('ecowasher', 2),\n        ('electronic-washlet', 13),\n        ('soft-close', 3)")
    expect(rows.filter(([, , , , gap]) => gap === 'true').map(([, memberKey]) => memberKey))
      .toEqual(['MS885DW4#XW', 'MS885DW18#XW'])
    expect(sql).toContain('MS885DW4#XW and MS885DW18#XW')
    expect(sql).toContain('Map canonical members only when an exact Product row exists')
    expect(sql).toContain('MS885 catalogue-gap set is not exact')
    expect(sql).toContain('MS885 normalized membership contract mismatch')
    expect(sql).toContain('product_row_count <> 0 AND missing_required_count <> 0')
    expect(sql).toContain('missing_required_count <> 0')
    expect(sql).toContain('MS885 configuration-group membership cardinality mismatch')
    expect(sql).not.toContain('products.variant_group =')
    expect(sql).not.toContain('products.variant_group_id =')
  })

  it.runIf(Boolean(integrationUrl))('executes the migration contract against an isolated fixture and rolls back', async () => {
    const client = new Client(parseTargetConnection('isolated-staging', integrationUrl))
    await client.connect()
    try {
      await attestTarget(client, 'isolated-staging')
      await client.query('BEGIN')
      await client.query(await readFile(migrationPath, 'utf8'))

      const scalar = async (query: string) => Number((await client.query<{ count: number }>(query)).rows[0]?.count ?? 0)
      expect(await scalar("SELECT count(*)::int AS count FROM product_families WHERE family_key = 'toto:ms885'")).toBe(1)
      expect(await scalar("SELECT count(*)::int AS count FROM product_family_configuration_groups g JOIN product_families f ON f.id = g.family_id WHERE f.family_key = 'toto:ms885'")).toBe(3)
      expect(await scalar("SELECT count(*)::int AS count FROM product_family_memberships m JOIN product_families f ON f.id = m.family_id WHERE f.family_key = 'toto:ms885'")).toBe(18)
      expect(await scalar("SELECT count(*)::int AS count FROM product_family_catalogue_gaps g JOIN product_families f ON f.id = g.family_id WHERE f.family_key = 'toto:ms885' AND g.status = 'open'")).toBe(2)
      expect(await scalar("SELECT count(*)::int AS count FROM products WHERE sku LIKE 'MS885%' AND (variant_group IS NOT NULL OR variant_group_id IS NOT NULL)")).toBe(0)
      const groupCounts = await client.query<{ group_key: string; count: number }>("SELECT g.group_key, count(m.id)::int AS count FROM product_family_configuration_groups g JOIN product_families f ON f.id = g.family_id LEFT JOIN product_family_memberships m ON m.configuration_group_id = g.id WHERE f.family_key = 'toto:ms885' GROUP BY g.id, g.group_key, g.sort_order ORDER BY g.sort_order")
      expect(groupCounts.rows).toEqual([
        { group_key: 'ecowasher', count: 2 },
        { group_key: 'electronic-washlet', count: 13 },
        { group_key: 'soft-close', count: 3 },
      ])
      await client.query('ROLLBACK')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      await client.end()
    }
  })
})
