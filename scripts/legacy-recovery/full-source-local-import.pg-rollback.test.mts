import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { afterEach, expect, it } from 'vitest'
import { buildRecoveryImportPlan } from './recovery-import-plan.mjs'
import { readVerifiedBundle, verifyBlogArchiveDigest } from './public-source-contract.mjs'
import { assertLocalAdminPreviewServerIdentity } from './local-target-guard.mjs'
import { importFullSource, readFullSourceCapture } from './full-source-local-import.mjs'

const TEST_DATABASE_NAME = 'dpg_legacy_admin_full_rollback_test'
const TEST_DATABASE_PORT = '55439'
const databaseUrl = process.env.DPG_LOCAL_IMPORT_ROLLBACK_DATABASE_URL
const captureDir = process.env.DPG_LOCAL_IMPORT_FULL_CAPTURE
const publicCaptureDir = process.env.DPG_LOCAL_IMPORT_PUBLIC_CAPTURE
const postgresDataDirectory = process.env.DPG_LOCAL_POSTGRES_DATA_DIRECTORY
const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

const pgTest = databaseUrl && captureDir && publicCaptureDir && postgresDataDirectory ? it : it.skip

pgTest('rolls back real PostgreSQL inserts when a validated capture page changes before consume', async () => {
  const connection = new URL(databaseUrl!)
  assert.equal(connection.protocol, 'postgresql:')
  assert.equal(connection.hostname, '127.0.0.1')
  assert.equal(connection.port, TEST_DATABASE_PORT)
  assert.equal(decodeURIComponent(connection.pathname.slice(1)), TEST_DATABASE_NAME)
  assert.equal(decodeURIComponent(connection.username), 'postgres')
  assert.equal(connection.password, '')
  assert.deepEqual([...connection.searchParams.keys()].filter((key) => key !== 'schema'), [])

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
  try {
    await prisma.$connect()
    const identityRows = await prisma.$queryRaw<Array<{
      server_address: string | null; server_port: number; database_name: string; data_directory: string; version_num: number
    }>>`SELECT host(inet_server_addr()) AS server_address, inet_server_port() AS server_port,
      current_database() AS database_name, current_setting('data_directory') AS data_directory,
      current_setting('server_version_num')::integer AS version_num`
    const identity = identityRows[0]
    assert.ok(identity)
    const [dataDirectory, expectedDataDirectory] = await Promise.all([
      realpath(identity.data_directory),
      realpath(postgresDataDirectory!),
    ])
    assertLocalAdminPreviewServerIdentity(
      { hostname: connection.hostname, port: connection.port, database: TEST_DATABASE_NAME },
      {
        serverAddress: identity.server_address,
        serverPort: identity.server_port,
        databaseName: identity.database_name,
        serverVersionNum: identity.version_num,
        dataDirectory,
        expectedDataDirectory,
      },
    )

    const sourceLock = JSON.parse(await readFile(resolve('scripts/legacy-recovery/public-source-candidate-lock.proposed.json'), 'utf8'))
    const bundle = await readVerifiedBundle(resolve(publicCaptureDir!), sourceLock)
    const blogBytes = await readFile(resolve('apps/public/src/runtime/legacy-blog-snapshot.json'))
    verifyBlogArchiveDigest(blogBytes, sourceLock.blogArchive?.sha256)
    const plan = buildRecoveryImportPlan(bundle, JSON.parse(blogBytes.toString('utf8')), blogBytes)
    const full = await readFullSourceCapture(resolve(captureDir!), plan.blogCategories, plan.blogPosts.map((row) => row.data))

    const emptyTables = [
      'categories', 'subcategories', 'brands', 'colors', 'origins', 'materials', 'product_features',
      'product_types', 'product_sub_types', 'catalog_taxons', 'spec_definitions', 'spec_options',
      'filter_definitions', 'product_variant_groups', 'product_families', 'product_family_configuration_groups',
      'product_family_memberships', 'products', 'product_descriptions', 'product_images', 'product_documents',
      'product_spec_values', 'product_feature_values', 'product_attribute_values', 'product_taxon_assignments',
      'product_secondary_subcategories', 'product_package_items', 'product_relationships', 'product_source_mappings',
      'blog_categories', 'blog_posts', 'orders', 'customers', 'admin_users',
    ]
    const models = prisma as unknown as Record<string, { count(): Promise<number> }>
    const initialCounts = await Promise.all(emptyTables.map((table) => models[table].count()))
    assert.ok(initialCounts.every((count) => count === 0), 'rollback test database must start empty')

    const temporaryRoot = await mkdtemp(join(tmpdir(), 'dpg-full-source-pg-rollback-'))
    temporaryRoots.push(temporaryRoot)
    await mkdir(join(temporaryRoot, 'pages'))
    const firstPagePath = join(resolve(captureDir!), 'pages', '0000.json')
    const mutatedPage = JSON.parse(await readFile(firstPagePath, 'utf8')) as { products: Array<Record<string, unknown>> }
    assert.ok(mutatedPage.products.length > 0)
    mutatedPage.products[0].name = 'MUTATED_AFTER_CAPTURE_VALIDATION'
    await writeFile(join(temporaryRoot, 'pages', '0000.json'), JSON.stringify(mutatedPage))

    await expect(importFullSource(prisma, {
      ...full,
      capture: { ...full.capture, root: temporaryRoot },
    }, plan.blogCategories, plan.blogPosts.map((row) => row.data)))
      .rejects.toThrow('FULL_SOURCE_PAGE_DIGEST_MISMATCH:0000.json')

    const afterCounts = await Promise.all(emptyTables.map((table) => models[table].count()))
    expect(afterCounts).toEqual(initialCounts)
    const ledger = await prisma.$queryRaw<Array<{ rows: bigint }>>`SELECT COUNT(*) AS rows FROM local_recovery.full_source_import_ledger`
    expect(Number(ledger[0]?.rows ?? -1)).toBe(0)
  } finally {
    await prisma.$disconnect()
  }
})
