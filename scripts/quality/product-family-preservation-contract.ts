import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const PRODUCT_FAMILY_PRESERVATION_CONTRACT = {
  id: 'dongphugia:product-family-preservation:v1',
  migration: {
    baseline: '0000_baseline_v1',
    family: '0001_ms885_normalized_family',
    familyPath: 'db/postgres-migrations/0001_ms885_normalized_family/migration.sql',
    familyChecksumPath: '0001_ms885_normalized_family/migration.sql',
    familySha256: '4a2d57689db064fe577316404b7f9b7b38da9314876b6a1e23b32b190cd3f470',
  },
  schema: {
    manifestPath: 'db/postgres-migrations/manifest.json',
    checksumPath: 'db/postgres-migrations/checksums.sha256',
    schemaManifestPath: 'db/postgres-migrations/schema-manifest.json',
    driftAllowlistPath: 'db/postgres-migrations/schema-drift-allowlist.json',
    protectedTables: [
      'public.products',
      'public.product_variant_groups',
      'public.product_families',
      'public.product_family_configuration_groups',
      'public.product_family_memberships',
      'public.product_family_catalogue_gaps',
    ],
    protectedTableSha256: {
      'public.product_families': '78dc8051d891fb2695f9529ef8f32ad0fbd74369d71d0d57fa48cc97809dae77',
      'public.product_family_configuration_groups': '46f96977bb604844d67ad48628e31069caa2717b5f6bbf66d7193e126e13a6ea',
      'public.product_family_memberships': 'a4a01efc8f3786b026863786320c9d878c4e3b7da3d1717c5b7344d1fb8f5612',
      'public.product_family_catalogue_gaps': '3472612916288fa41bd18b65b97e54c8d3df4e6e885b52cd4c76daba461f7923',
    },
    protectedIndexes: [
      'public.product_family_memberships.uq_product_family_memberships_family_product',
    ],
    protectedConstraints: [
      'public.product_family_memberships.product_family_memberships_configuration_group_fkey',
      'public.product_family_memberships.product_family_memberships_product_fkey',
    ],
  },
  ms885: {
    familyKey: 'toto:ms885',
    familyLabel: 'TOTO MS885',
    canonicalMembers: {
      ecowasher: ['MS885DE2#XW', 'MS885DE4#XW'],
      'soft-close': ['MS885DT2#XW', 'MS885DT3#XW', 'MS885DT8#XW'],
      'electronic-washlet': [
        'MS885DW4#XW', 'MS885DW6#XW', 'MS885DW7#XW', 'MS885DW11#XW',
        'MS885DW14#XW', 'MS885DW16#XW', 'MS885DW18#XW', 'MS885CDW12#XW',
        'MS885CDW15#XW', 'MS885CDW17#XW', 'MS885CDW23#XW', 'MS885CDW24#XW',
        'MS885CDW25#XW', 'MS885DW24#XW', 'MS885DW25#XW',
      ],
    },
    catalogueGaps: ['MS885DW4#XW', 'MS885DW18#XW'],
    deferredOutsideFamily: ['MS885DE6#XW'],
    existingMembershipCount: 18,
    currentRowDistribution: {
      ecowasher: 2,
      'electronic-washlet': 13,
      'soft-close': 3,
    },
  },
} as const

type SchemaObject = { kind: string; identity: string; properties?: Record<string, unknown> }
type SchemaManifest = { formatVersion: number; objects: SchemaObject[] }
type MigrationManifest = {
  formatVersion: number
  origin: string
  baseline: string
  checksumFile: string
  schemaManifest: string
  driftAllowlist: string
  layers: Array<{ name: string; path: string }>
  migrations: Array<{ name: string; path: string }>
}

export type ProductFamilyPreservationSources = {
  migrationSql: string
  migrationManifest: MigrationManifest
  checksumFile: string
  schemaManifest: SchemaManifest
  prismaSchema: string
}

export type Ms885PreservationSnapshot = {
  familyKey: string
  canonicalMemberKeys: string[]
  memberships: Array<{ memberKey: string; groupKey: string }>
  catalogueGapKeys: string[]
  deferredOutsideFamily: string[]
}

const canonicalMemberGroups = PRODUCT_FAMILY_PRESERVATION_CONTRACT.ms885.canonicalMembers
const canonicalMemberKeys = Object.values(canonicalMemberGroups).flat()
const canonicalGroupByMember = new Map(
  Object.entries(canonicalMemberGroups).flatMap(([groupKey, members]) => members.map((memberKey) => [memberKey, groupKey] as const)),
)
const gapKeys = new Set(PRODUCT_FAMILY_PRESERVATION_CONTRACT.ms885.catalogueGaps)
const existingMemberKeys = canonicalMemberKeys.filter((memberKey) => !gapKeys.has(memberKey))

function sha256(content: string) {
  return createHash('sha256').update(content).digest('hex')
}

function objectByIdentity(manifest: SchemaManifest, identity: string) {
  return manifest.objects.find((object) => object.identity === identity)
}

function checksumFor(checksumFile: string, relativePath: string) {
  const line = checksumFile
    .split('\n')
    .map((value) => value.trim())
    .find((value) => value.endsWith(`  ${relativePath}`))
  return line?.split(/\s+/)[0]
}

function migrationRows(migrationSql: string) {
  const section = migrationSql.split('INSERT INTO ms885_approved_members')[1]?.split('\n\n-- Persist approved members')[0] ?? ''
  return [...section.matchAll(/\('([^']+)', '([^']+)', (\d+), (true|false)\)/g)].map(([, memberKey, groupKey, sortOrder, gap]) => ({
    memberKey,
    groupKey,
    sortOrder: Number(sortOrder),
    gap: gap === 'true',
  }))
}

export function validateMs885PreservationSnapshot(snapshot: Ms885PreservationSnapshot) {
  const violations: string[] = []
  const expected = PRODUCT_FAMILY_PRESERVATION_CONTRACT.ms885
  const expectedDistribution = expected.currentRowDistribution
  const actualGroupCounts = new Map<string, number>()
  const membershipKeys = snapshot.memberships.map(({ memberKey }) => memberKey)

  if (snapshot.familyKey !== expected.familyKey) violations.push('MS885 family key changed')
  if (JSON.stringify([...snapshot.canonicalMemberKeys].sort()) !== JSON.stringify([...canonicalMemberKeys].sort())) {
    violations.push('MS885 canonical member set changed')
  }
  if (JSON.stringify([...snapshot.catalogueGapKeys].sort()) !== JSON.stringify([...expected.catalogueGaps].sort())) {
    violations.push('MS885 catalogue-gap set changed')
  }
  if (JSON.stringify([...snapshot.deferredOutsideFamily].sort()) !== JSON.stringify([...expected.deferredOutsideFamily].sort())) {
    violations.push('MS885 deferred-outside-Family set changed')
  }
  if (snapshot.memberships.length !== expected.existingMembershipCount) {
    violations.push(`MS885 membership count changed: expected ${expected.existingMembershipCount}`)
  }
  if (new Set(membershipKeys).size !== membershipKeys.length) violations.push('MS885 membership keys are not unique')
  if (membershipKeys.some((memberKey) => !canonicalGroupByMember.has(memberKey))) {
    violations.push('MS885 membership contains an unapproved Product')
  }
  if (membershipKeys.some((memberKey) => gapKeys.has(memberKey))) violations.push('MS885 catalogue gap was turned into a membership')

  for (const membership of snapshot.memberships) {
    const expectedGroup = canonicalGroupByMember.get(membership.memberKey)
    if (expectedGroup !== membership.groupKey) violations.push(`MS885 membership group changed for ${membership.memberKey}`)
    actualGroupCounts.set(membership.groupKey, (actualGroupCounts.get(membership.groupKey) ?? 0) + 1)
  }
  for (const [groupKey, expectedCount] of Object.entries(expectedDistribution)) {
    if ((actualGroupCounts.get(groupKey) ?? 0) !== expectedCount) {
      violations.push(`MS885 current-row distribution changed for ${groupKey}: expected ${expectedCount}`)
    }
  }
  if (existingMemberKeys.some((memberKey) => !membershipKeys.includes(memberKey))) {
    violations.push('MS885 existing canonical Product membership is missing')
  }
  if (membershipKeys.some((memberKey) => !existingMemberKeys.includes(memberKey))) {
    violations.push('MS885 membership is outside the accepted existing Product set')
  }

  return [...new Set(violations)]
}

export function evaluateProductFamilyPreservationContract(sources: ProductFamilyPreservationSources) {
  const violations: string[] = []
  const expected = PRODUCT_FAMILY_PRESERVATION_CONTRACT
  const migration = sources.migrationManifest

  if (sha256(sources.migrationSql) !== expected.migration.familySha256) violations.push('canonical Family migration checksum changed')
  if (checksumFor(sources.checksumFile, expected.migration.familyChecksumPath) !== expected.migration.familySha256) {
    violations.push('canonical Family migration checksum record changed')
  }
  if (migration.formatVersion !== 2 || migration.origin !== 'postgresql' || migration.baseline !== 'v1') {
    violations.push('canonical PostgreSQL migration manifest changed')
  }
  if (migration.checksumFile !== 'checksums.sha256' || migration.schemaManifest !== 'schema-manifest.json' || migration.driftAllowlist !== 'schema-drift-allowlist.json') {
    violations.push('canonical migration support identifiers changed')
  }
  if (!migration.layers.some((layer) => layer.name === 'core' && layer.path === '0000_baseline_v1/core.sql')) {
    violations.push('canonical baseline core layer is missing')
  }
  if (!migration.migrations.some((item) => item.name === 'ms885-normalized-family' && item.path === '0001_ms885_normalized_family/migration.sql')) {
    violations.push('canonical Family migration is missing from the manifest')
  }

  const rows = migrationRows(sources.migrationSql)
  const expectedRows = canonicalMemberKeys.map((memberKey, sortOrder) => ({
    memberKey,
    groupKey: canonicalGroupByMember.get(memberKey),
    sortOrder,
    gap: gapKeys.has(memberKey),
  }))
  if (JSON.stringify(rows) !== JSON.stringify(expectedRows)) violations.push('MS885 approved migration member contract changed')
  for (const approvedGroup of [
    "('ecowasher', 'nắp rửa cơ', 0)",
    "('electronic-washlet', 'nắp điện tử', 1)",
    "('soft-close', 'nắp đóng êm', 2)",
  ]) {
    if (!sources.migrationSql.includes(approvedGroup)) violations.push(`MS885 configuration-group contract changed: ${approvedGroup}`)
  }
  if (!sources.migrationSql.includes("VALUES ('toto:ms885', 'TOTO MS885', 'toto-catalogue', 'high')")) {
    violations.push('MS885 Family identity contract changed')
  }
  if (sources.migrationSql.includes("('MS885DE6#XW'")) violations.push('deferred MS885DE6#XW entered the canonical Family')
  if (/(?:INSERT INTO|UPDATE|DELETE FROM|ALTER TABLE)\s+(?:ONLY\s+)?(?:public\.)?products\b/i.test(sources.migrationSql)) {
    violations.push('Family migration writes the Product table')
  }
  if (/\bproducts\.(?:variant_group|variant_group_id)\s*=/i.test(sources.migrationSql)) {
    violations.push('Family migration rewrites legacy Product variant grouping')
  }
  for (const relation of [
    'CONSTRAINT uq_product_family_memberships_family_product UNIQUE (family_id, product_id)',
    'FOREIGN KEY (configuration_group_id, family_id)',
    'REFERENCES product_family_configuration_groups(id, family_id)',
    'FOREIGN KEY (product_id) REFERENCES products(id)',
  ]) {
    if (!sources.migrationSql.includes(relation)) violations.push(`Family relationship invariant missing: ${relation}`)
  }

  const schemaManifest = sources.schemaManifest
  if (schemaManifest.formatVersion !== 2) violations.push('canonical schema manifest format changed')
  for (const identity of expected.schema.protectedTables) {
    const object = objectByIdentity(schemaManifest, identity)
    if (!object) violations.push(`protected schema table missing: ${identity}`)
    else if (expected.schema.protectedTableSha256[identity as keyof typeof expected.schema.protectedTableSha256]
      && expected.schema.protectedTableSha256[identity as keyof typeof expected.schema.protectedTableSha256] !== sha256(JSON.stringify(object.properties))) {
      violations.push(`protected schema table changed: ${identity}`)
    }
  }
  for (const identity of [...expected.schema.protectedIndexes, ...expected.schema.protectedConstraints]) {
    if (!objectByIdentity(schemaManifest, identity)) violations.push(`protected schema identifier missing: ${identity}`)
  }
  const products = objectByIdentity(schemaManifest, 'public.products')
  const productColumns = new Set(((products?.properties?.columns ?? []) as Array<{ name: string }>).map((column) => column.name))
  if (!productColumns.has('id') || !productColumns.has('sku')) violations.push('Product identity columns changed')
  const membershipConstraint = objectByIdentity(schemaManifest, 'public.product_family_memberships.product_family_memberships_configuration_group_fkey')
  if (membershipConstraint?.properties?.definition !== 'FOREIGN KEY (configuration_group_id, family_id) REFERENCES product_family_configuration_groups(id, family_id) ON DELETE CASCADE') {
    violations.push('Family membership configuration-group scope changed')
  }
  const productConstraint = objectByIdentity(schemaManifest, 'public.product_family_memberships.product_family_memberships_product_fkey')
  if (productConstraint?.properties?.definition !== 'FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE') {
    violations.push('Family membership Product relation changed')
  }
  const membershipIndex = objectByIdentity(schemaManifest, 'public.product_family_memberships.uq_product_family_memberships_family_product')
  if (membershipIndex?.properties?.definition !== 'CREATE UNIQUE INDEX uq_product_family_memberships_family_product ON public.product_family_memberships USING btree (family_id, product_id)') {
    violations.push('Family membership uniqueness changed')
  }

  if (!sources.prismaSchema.includes('model product_families')) violations.push('Prisma Product Family model is missing')
  if (!sources.prismaSchema.includes('model product_family_configuration_groups')) violations.push('Prisma configuration-group model is missing')
  if (!sources.prismaSchema.includes('model product_family_memberships')) violations.push('Prisma Family membership model is missing')
  for (const relation of [
    '@relation(fields: [configuration_group_id, family_id], references: [id, family_id]',
    '@@unique([family_id, product_id], map: "uq_product_family_memberships_family_product")',
  ]) {
    if (!sources.prismaSchema.includes(relation)) violations.push(`Prisma Family relationship invariant missing: ${relation}`)
  }
  if (!sources.prismaSchema.includes('Product identity and') || !sources.prismaSchema.includes('commercial/PDP fields remain owned by products')) {
    violations.push('Product-owned identity/commercial semantics changed')
  }

  return [...new Set(violations)]
}

export async function loadProductFamilyPreservationSources(root = process.cwd()): Promise<ProductFamilyPreservationSources> {
  const read = (relativePath: string) => readFile(path.join(root, relativePath), 'utf8')
  const [migrationSql, migrationManifest, checksumFile, schemaManifest, prismaSchema] = await Promise.all([
    read(expectedMigrationPath()),
    read(expected.manifestPath),
    read(expected.checksumPath),
    read(expected.schemaManifestPath),
    read('prisma/schema.prisma'),
  ])
  return {
    migrationSql,
    migrationManifest: JSON.parse(migrationManifest) as MigrationManifest,
    checksumFile,
    schemaManifest: JSON.parse(schemaManifest) as SchemaManifest,
    prismaSchema,
  }
}

function expectedMigrationPath() {
  return PRODUCT_FAMILY_PRESERVATION_CONTRACT.migration.familyPath
}

const expected = PRODUCT_FAMILY_PRESERVATION_CONTRACT.schema

export function assertProductFamilyPreservationContract(sources: ProductFamilyPreservationSources) {
  const violations = evaluateProductFamilyPreservationContract(sources)
  if (violations.length > 0) throw new Error(`PRODUCT_FAMILY_PRESERVATION_FAILED: ${violations.join('; ')}`)
}

export { canonicalMemberKeys, existingMemberKeys }

export function groupKeyForMs885Member(memberKey: string) {
  return canonicalGroupByMember.get(memberKey)
}
