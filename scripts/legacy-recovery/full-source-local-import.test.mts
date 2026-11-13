import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { importFullSource, readValidatedCapturePage } from './full-source-local-import.mjs'

const REFERENCE_ORDER = [
  'categories', 'subcategories', 'brands', 'colors', 'origins', 'materials', 'product_features',
  'product_types', 'product_sub_types', 'catalog_taxons', 'spec_definitions', 'spec_options',
  'filter_definitions', 'product_variant_groups', 'product_families', 'product_family_configuration_groups',
  'product_family_memberships',
]
const RELATION_TABLES = [
  'product_descriptions', 'product_images', 'product_documents', 'product_spec_values',
  'product_feature_values', 'product_attribute_values', 'product_taxon_assignments',
  'product_secondary_subcategories', 'product_package_items', 'product_relationships', 'product_source_mappings',
]
const TABLES = [...REFERENCE_ORDER, 'products', ...RELATION_TABLES, 'blog_categories', 'blog_posts']
const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

function fakePrisma(options: {
  ledger?: Array<Record<string, unknown>>
  counts?: Record<string, number>
  targetRows?: Record<string, Array<Record<string, unknown>>>
} = {}) {
  const state = { counts: { ...(options.counts ?? {}) }, createManyCalls: 0 }
  const tx: Record<string, unknown> = {}
  for (const table of [...TABLES, 'orders', 'customers', 'admin_users']) {
    tx[table] = {
      count: async () => state.counts[table] ?? 0,
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        state.createManyCalls++
        state.counts[table] = (state.counts[table] ?? 0) + data.length
        return { count: data.length }
      },
      findMany: async ({ where, select }: { where?: { id?: { in?: number[] } }; select?: Record<string, true> }) => {
        const requested = where?.id?.in
        return (options.targetRows?.[table] ?? [])
          .filter((row) => !requested || requested.includes(Number(row.id)))
          .map((row) => Object.fromEntries(Object.keys(select ?? row).map((key) => [key, row[key]])))
      },
    }
  }
  const prisma = {
    $executeRawUnsafe: async () => 0,
    $transaction: async (callback: (transaction: unknown) => Promise<unknown>) => {
      const snapshot = { counts: { ...state.counts }, createManyCalls: state.createManyCalls }
      try {
        return await callback(tx)
      } catch (error) {
        state.counts = snapshot.counts
        state.createManyCalls = snapshot.createManyCalls
        throw error
      }
    },
  }
  tx.$executeRawUnsafe = async () => 0
  tx.$queryRaw = async () => options.ledger ?? []
  tx.$queryRawUnsafe = async () => []
  return { prisma: prisma as unknown as PrismaClient, state }
}

function replayData(row: Record<string, unknown>, targetRow = row) {
  const sourceIdentity = 'fixture/schema/capture-digest'
  const ledger = [{
    source_table: 'categories', source_id: 1, source_identity: sourceIdentity,
    row_digest: 'a'.repeat(64), idempotency_key: 'b'.repeat(64),
  }]
  const capture = {
    root: '', manifest: {} as never, ids: [], pages: [], pageDigests: {},
    references: { categories: [row] },
  }
  return {
    sourceIdentity,
    ledger,
    counts: { categories: 1 },
    capture,
    existingLedger: ledger,
    targetRows: { categories: [targetRow] },
  }
}

describe('full source local importer integrity', () => {
  it('rolls back earlier inserts when a capture page changes after validation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dpg-full-import-mutation-'))
    temporaryRoots.push(root)
    await mkdir(join(root, 'pages'))
    const original = Buffer.from(JSON.stringify({ products: [] }))
    await writeFile(join(root, 'pages', '0000.json'), original)
    const pageDigests = { '0000.json': createHash('sha256').update(original).digest('hex') }
    const capture = { root, pageDigests }
    await expect(readValidatedCapturePage(capture, '0000.json')).resolves.toEqual({ products: [] })
    await writeFile(join(root, 'pages', '0000.json'), JSON.stringify({ products: [{ id: 1 }] }))

    const { prisma, state } = fakePrisma()
    const data = {
      capture: {
        root, manifest: {} as never, ids: [], pages: ['0000.json'], pageDigests,
        references: { categories: [{ id: 1, name: 'Reference inserted before page read' }] },
      },
      sourceIdentity: 'fixture/schema/capture-digest', ledger: [], counts: { categories: 1 },
    } as Parameters<typeof importFullSource>[1]

    await expect(importFullSource(prisma, data, [], [])).rejects.toThrow('FULL_SOURCE_PAGE_DIGEST_MISMATCH:0000.json')
    expect(state.counts.categories ?? 0).toBe(0)
    expect(state.createManyCalls).toBe(0)
  })

  it('returns identical-noop only when source-owned target row content matches', async () => {
    const row = {
      id: 1, name: 'Source category', slug: 'source-category',
      created_at: '2026-01-01T00:00:00.123456+00:00', updated_at: '2026-01-01T00:00:00.000Z',
    }
    const replay = replayData(row, { ...row, created_at: new Date('2026-01-01T00:00:00.123Z') })
    const { prisma } = fakePrisma({
      ledger: replay.existingLedger,
      counts: { categories: 1 },
      targetRows: replay.targetRows,
    })
    const result = await importFullSource(prisma, replay as unknown as Parameters<typeof importFullSource>[1], [], [])
    expect(result).toMatchObject({ mode: 'identical-noop', exactIdentityDigests: true })
  })

  it('detects a changed target row and leaves the local edit untouched', async () => {
    const sourceRow = { id: 1, name: 'Source category', slug: 'source-category' }
    const locallyEditedRow = { id: 1, name: 'Local intentional edit', slug: 'source-category' }
    const replay = replayData(sourceRow, locallyEditedRow)
    const { prisma, state } = fakePrisma({
      ledger: replay.existingLedger,
      counts: { categories: 1 },
      targetRows: replay.targetRows,
    })

    await expect(importFullSource(prisma, replay as unknown as Parameters<typeof importFullSource>[1], [], []))
      .rejects.toThrow('FULL_SOURCE_REPLAY_ROW_CONFLICT:categories:1:name')
    expect(state.createManyCalls).toBe(0)
    expect(replay.targetRows.categories[0].name).toBe('Local intentional edit')
  })

  it('ignores mutable update timestamps when checking content-equivalent replays', async () => {
    const sourceRow = { id: 1, name: 'Source category', slug: 'source-category', updated_at: '2026-01-01T00:00:00.000Z' }
    const targetRow = { ...sourceRow, updated_at: new Date('2026-09-01T00:00:00.000Z') }
    const replay = replayData(sourceRow, targetRow)
    const { prisma } = fakePrisma({
      ledger: replay.existingLedger,
      counts: { categories: 1 },
      targetRows: replay.targetRows,
    })
    const result = await importFullSource(prisma, replay as unknown as Parameters<typeof importFullSource>[1], [], [])
    expect(result.mode).toBe('identical-noop')
  })
})
