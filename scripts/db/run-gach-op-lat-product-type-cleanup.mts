import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import prismaModule from '@/lib/prisma'

const prisma = ((prismaModule as { default?: unknown }).default ??
  prismaModule) as {
  $queryRawUnsafe: <T = unknown>(query: string) => Promise<T>
  $disconnect: () => Promise<void>
  $transaction: <T>(
    fn: (tx: {
      $queryRawUnsafe: <R = unknown>(query: string) => Promise<R>
    }) => Promise<T>,
    options?: { isolationLevel?: 'Serializable' | 'ReadCommitted' | 'RepeatableRead' }
  ) => Promise<T>
}

const HANDOFF_DIR = join(process.cwd(), 'docs', 'handoffs')
const OUTPUT_DIR = join(process.cwd(), 'scripts', 'output')
const SOURCE_TAG = 'gach_op_lat_product_type_cleanup_v1'

type CleanupRow = {
  product_id: number
  sku: string | null
  name: string
  subcategory_id: number
  subcategory_slug: string
  current_product_type: string | null
  proposed_product_type: string
  heuristic_reason: string
}

type ProductTypeSeed = {
  subcategorySlug: string
  subcategoryId: number
  slug: string
  name: string
  sortOrder: number
}

type CleanupPlan = {
  generatedAt: string
  sourceTag: string
  seedsToEnsure: ProductTypeSeed[]
  counts: {
    total: number
    byType: Record<string, number>
    bySubcategory: Record<string, number>
  }
  rows: CleanupRow[]
}

type RollbackArtifact = {
  generatedAt: string
  sourceTag: string
  rows: Array<{
    product_id: number
    sku: string | null
    expected_current_product_type: string
    rollback_product_type: null
  }>
}

const shouldExecute = process.argv.includes('--execute')
const rollbackArg = process.argv.find((arg) => arg.startsWith('--rollback='))?.slice('--rollback='.length) ?? null

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

function sqlNullableString(value: string | null) {
  return value === null ? 'null' : sqlString(value)
}

function toCsvCell(value: unknown) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

function normalizeRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? Number(value) : value])
    ) as T
  )
}

function inferGachProductType(row: {
  name: string
  subcategory_slug: string
}) {
  const lower = row.name.toLowerCase()

  if (row.subcategory_slug !== 'gach-op-lat') {
    return {
      productType: row.subcategory_slug,
      heuristicReason: 'subcategory-direct-map',
    }
  }

  if (lower.includes('keo dán gạch') || lower.includes('keo dan gach')) {
    return {
      productType: 'keo-dan-gach',
      heuristicReason: 'name-keywords-keo-dan-gach',
    }
  }

  if (lower.includes('hồ bơi') || lower.includes('ho boi') || lower.includes('/pol')) {
    return {
      productType: 'gach-ho-boi',
      heuristicReason: 'name-keywords-gach-ho-boi',
    }
  }

  return {
    productType: 'gach-op-lat',
    heuristicReason: 'fallback-subcategory-gach-op-lat',
  }
}

async function getSubcategories() {
  return normalizeRows(
    await prisma.$queryRawUnsafe<Array<{
      subcategory_id: number
      subcategory_slug: string
      subcategory_name: string
    }>>(`
      select s.id as subcategory_id, s.slug as subcategory_slug, s.name as subcategory_name
      from subcategories s
      join categories c on c.id = s.category_id
      where c.slug = 'gach-op-lat'
      order by s.id asc
    `)
  )
}

function buildSeeds(subcategories: Array<{
  subcategory_id: number
  subcategory_slug: string
  subcategory_name: string
}>) {
  const subcategoryMap = new Map(subcategories.map((item) => [item.subcategory_slug, item]))

  const requireSubcategory = (slug: string) => {
    const found = subcategoryMap.get(slug)
    if (!found) throw new Error(`Missing subcategory ${slug}`)
    return found
  }

  const generic = requireSubcategory('gach-op-lat')

  const directSeeds = subcategories
    .filter((item) => item.subcategory_slug !== 'gach-op-lat')
    .map<ProductTypeSeed>((item, index) => ({
      subcategorySlug: item.subcategory_slug,
      subcategoryId: item.subcategory_id,
      slug: item.subcategory_slug,
      name: item.subcategory_name,
      sortOrder: (index + 1) * 10,
    }))

  return [
    ...directSeeds,
    {
      subcategorySlug: generic.subcategory_slug,
      subcategoryId: generic.subcategory_id,
      slug: 'gach-ho-boi',
      name: 'Gạch hồ bơi',
      sortOrder: 10,
    },
    {
      subcategorySlug: generic.subcategory_slug,
      subcategoryId: generic.subcategory_id,
      slug: 'keo-dan-gach',
      name: 'Keo dán gạch',
      sortOrder: 20,
    },
    {
      subcategorySlug: generic.subcategory_slug,
      subcategoryId: generic.subcategory_id,
      slug: 'gach-op-lat',
      name: 'Gạch ốp lát',
      sortOrder: 30,
    },
  ]
}

async function buildPlan(): Promise<CleanupPlan> {
  const subcategories = await getSubcategories()
  const seedsToEnsure = buildSeeds(subcategories)

  const rawRows = normalizeRows(
    await prisma.$queryRawUnsafe<Array<{
      product_id: number
      sku: string | null
      name: string
      subcategory_id: number
      subcategory_slug: string
      current_product_type: string | null
    }>>(`
      select
        p.id as product_id,
        p.sku,
        p.name,
        s.id as subcategory_id,
        s.slug as subcategory_slug,
        p.product_type as current_product_type
      from products p
      join categories c on c.id = p.category_id
      join subcategories s on s.id = p.subcategory_id
      where c.slug = 'gach-op-lat'
        and p.product_type is null
      order by s.slug asc, p.name asc, p.id asc
    `)
  )

  const rows: CleanupRow[] = rawRows.map((row) => {
    const inferred = inferGachProductType(row)
    return {
      product_id: row.product_id,
      sku: row.sku,
      name: row.name,
      subcategory_id: row.subcategory_id,
      subcategory_slug: row.subcategory_slug,
      current_product_type: row.current_product_type,
      proposed_product_type: inferred.productType,
      heuristic_reason: inferred.heuristicReason,
    }
  })

  const countsByType = Object.fromEntries(
    [...rows.reduce((map, row) => map.set(row.proposed_product_type, (map.get(row.proposed_product_type) ?? 0) + 1), new Map<string, number>()).entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
  )

  const countsBySubcategory = Object.fromEntries(
    [...rows.reduce((map, row) => map.set(row.subcategory_slug, (map.get(row.subcategory_slug) ?? 0) + 1), new Map<string, number>()).entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
  )

  return {
    generatedAt: new Date().toISOString(),
    sourceTag: SOURCE_TAG,
    seedsToEnsure,
    counts: {
      total: rows.length,
      byType: countsByType,
      bySubcategory: countsBySubcategory,
    },
    rows,
  }
}

function writePlanArtifacts(plan: CleanupPlan) {
  mkdirSync(HANDOFF_DIR, { recursive: true })
  const jsonPath = join(HANDOFF_DIR, 'catalog-gach-op-lat-product-type-cleanup-plan.json')
  const mdPath = join(HANDOFF_DIR, 'catalog-gach-op-lat-product-type-cleanup-plan.md')
  const csvPath = join(HANDOFF_DIR, 'catalog-gach-op-lat-product-type-cleanup-plan.csv')

  const md = [
    '# Gach Op Lat Product Type Cleanup Plan',
    '',
    `Updated: ${plan.generatedAt}`,
    '',
    `- Source tag: \`${plan.sourceTag}\``,
    `- Total candidates: \`${plan.counts.total}\``,
    '',
    '## Proposed product_type breakdown',
    '',
    ...Object.entries(plan.counts.byType).map(([key, count]) => `- ${key}: ${count}`),
    '',
    '## Breakdown by subcategory',
    '',
    ...Object.entries(plan.counts.bySubcategory).map(([key, count]) => `- ${key}: ${count}`),
    '',
    '## Product types to ensure',
    '',
    ...plan.seedsToEnsure.map((seed) => `- ${seed.subcategorySlug} -> ${seed.slug} | ${seed.name}`),
    '',
    '## Guardrails',
    '',
    '- Chỉ update các row hiện `product_type is null` trong `gach-op-lat`.',
    '- Seed product_types theo kiểu additive; không sửa slug/type cũ.',
    '- Rollback chỉ trả product rows về `null`; không xóa type seed additive.',
    '- Với subcategory `gach-op-lat`, heuristic hiện chỉ chấp nhận `gach-ho-boi`, `keo-dan-gach`, hoặc fallback `gach-op-lat`.',
    '',
  ].join('\n')

  const csv = [
    ['product_id', 'sku', 'subcategory_slug', 'name', 'current_product_type', 'proposed_product_type', 'heuristic_reason'],
    ...plan.rows.map((row) => [
      row.product_id,
      row.sku,
      row.subcategory_slug,
      row.name,
      row.current_product_type,
      row.proposed_product_type,
      row.heuristic_reason,
    ]),
  ]
    .map((row) => row.map(toCsvCell).join(','))
    .join('\n')

  writeFileSync(jsonPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8')
  writeFileSync(mdPath, `${md}\n`, 'utf8')
  writeFileSync(csvPath, `${csv}\n`, 'utf8')

  return { jsonPath, mdPath, csvPath }
}

async function runPreflight(plan: CleanupPlan) {
  const ids = plan.rows.map((row) => row.product_id)
  const exactCountRows = normalizeRows(
    await prisma.$queryRawUnsafe<Array<{ exact_count: number }>>(`
      select count(*) as exact_count
      from products p
      where p.id in (${ids.join(',')})
        and p.product_type is null
    `)
  )

  const existingTypeRows = normalizeRows(
    await prisma.$queryRawUnsafe<Array<{
      subcategory_id: number
      slug: string
    }>>(`
      select subcategory_id, slug
      from product_types
      where (subcategory_id, slug) in (
        ${plan.seedsToEnsure.map((seed) => `(${seed.subcategoryId}, ${sqlString(seed.slug)})`).join(', ')}
      )
      order by subcategory_id asc, slug asc
    `)
  )

  return {
    exactCount: exactCountRows[0]?.exact_count ?? 0,
    existingTypeKeys: existingTypeRows.map((row) => `${row.subcategory_id}:${row.slug}`),
  }
}

function writeRollbackArtifact(plan: CleanupPlan) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  const artifact: RollbackArtifact = {
    generatedAt: new Date().toISOString(),
    sourceTag: SOURCE_TAG,
    rows: plan.rows.map((row) => ({
      product_id: row.product_id,
      sku: row.sku,
      expected_current_product_type: row.proposed_product_type,
      rollback_product_type: null,
    })),
  }
  const artifactPath = join(OUTPUT_DIR, 'catalog-gach-op-lat-product-type-cleanup-rollback.json')
  writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  return { artifactPath }
}

async function executePlan(plan: CleanupPlan) {
  const rollback = writeRollbackArtifact(plan)
  const preflight = await runPreflight(plan)
  if (preflight.exactCount !== plan.counts.total) {
    throw new Error(`Preflight mismatch: expected ${plan.counts.total}, got ${preflight.exactCount}`)
  }

  const executeResult = await prisma.$transaction(async (tx) => {
    const seedValues = plan.seedsToEnsure
      .map(
        (seed) =>
          `(${seed.subcategoryId}, ${sqlString(seed.slug)}, ${sqlString(seed.name)}, ${seed.sortOrder}, true, now(), now())`
      )
      .join(',\n')

    await tx.$queryRawUnsafe(`
      insert into product_types (
        subcategory_id,
        slug,
        name,
        sort_order,
        is_active,
        created_at,
        updated_at
      )
      values
      ${seedValues}
      on conflict (subcategory_id, slug) do update
      set name = excluded.name,
          is_active = true,
          updated_at = now()
    `)

    const updateValues = plan.rows
      .map(
        (row) =>
          `(${row.product_id}, ${sqlNullableString(row.sku)}, ${row.subcategory_id}, ${sqlString(row.proposed_product_type)})`
      )
      .join(',\n')

    const updatedRows = normalizeRows(
      await tx.$queryRawUnsafe<Array<{ updated_count: number }>>(`
        with input(product_id, sku, subcategory_id, proposed_product_type) as (
          values
          ${updateValues}
        ),
        updated as (
          update products p
          set product_type = input.proposed_product_type,
              updated_at = now()
          from input
          where p.id = input.product_id
            and coalesce(p.sku, '') = coalesce(input.sku, '')
            and p.subcategory_id = input.subcategory_id
            and p.product_type is null
          returning p.id
        )
        select count(*) as updated_count from updated
      `)
    )

    const updatedCount = updatedRows[0]?.updated_count ?? 0
    if (updatedCount !== plan.counts.total) {
      throw new Error(`Expected to update ${plan.counts.total} rows, updated ${updatedCount}`)
    }

    return { updatedCount }
  }, { isolationLevel: 'Serializable' })

  const after = await runPreflight(plan)
  const result = {
    executedAt: new Date().toISOString(),
    sourceTag: SOURCE_TAG,
    before: preflight,
    result: executeResult,
    after,
    rollbackArtifact: rollback.artifactPath,
  }

  const resultJsonPath = join(HANDOFF_DIR, 'catalog-gach-op-lat-product-type-cleanup-execute-result.json')
  const resultMdPath = join(HANDOFF_DIR, 'catalog-gach-op-lat-product-type-cleanup-execute-result.md')
  writeFileSync(resultJsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  writeFileSync(
    resultMdPath,
    [
      '# Gach Op Lat Product Type Cleanup Execute Result',
      '',
      `Executed: ${result.executedAt}`,
      `- Updated rows: ${executeResult.updatedCount}`,
      `- Rollback artifact: ${rollback.artifactPath}`,
      '',
      `- Before exact count: ${preflight.exactCount}`,
      `- After exact count: ${after.exactCount}`,
      `- Existing product_type keys after execute: ${after.existingTypeKeys.join(', ')}`,
      '',
    ].join('\n'),
    'utf8'
  )

  return { resultJsonPath, resultMdPath, result }
}

async function rollbackPlan(artifactPathArg: string) {
  const artifactPath = resolve(process.cwd(), artifactPathArg)
  const artifact = JSON.parse(readFileSync(artifactPath, 'utf8')) as RollbackArtifact

  const result = await prisma.$transaction(async (tx) => {
    const values = artifact.rows
      .map(
        (row) =>
          `(${row.product_id}, ${sqlNullableString(row.sku)}, ${sqlString(row.expected_current_product_type)})`
      )
      .join(',\n')

    const rolledBackRows = normalizeRows(
      await tx.$queryRawUnsafe<Array<{ rolled_back_count: number }>>(`
        with input(product_id, sku, expected_current_product_type) as (
          values
          ${values}
        ),
        updated as (
          update products p
          set product_type = null,
              updated_at = now()
          from input
          where p.id = input.product_id
            and coalesce(p.sku, '') = coalesce(input.sku, '')
            and p.product_type = input.expected_current_product_type
          returning p.id
        )
        select count(*) as rolled_back_count from updated
      `)
    )

    return {
      rolledBackCount: rolledBackRows[0]?.rolled_back_count ?? 0,
    }
  }, { isolationLevel: 'Serializable' })

  const resultPath = join(HANDOFF_DIR, 'catalog-gach-op-lat-product-type-cleanup-rollback-result.json')
  writeFileSync(resultPath, `${JSON.stringify({ rolledBackAt: new Date().toISOString(), artifactPath, result }, null, 2)}\n`, 'utf8')
  return { resultPath, result }
}

async function main() {
  if (rollbackArg) {
    const rollback = await rollbackPlan(rollbackArg)
    console.log(JSON.stringify({ mode: 'rollback', ...rollback }, null, 2))
    return
  }

  const plan = await buildPlan()
  const artifacts = writePlanArtifacts(plan)
  const preflight = await runPreflight(plan)
  const summary = {
    mode: shouldExecute ? 'execute' : 'dry-run',
    sourceTag: SOURCE_TAG,
    counts: plan.counts,
    preflight,
    artifacts,
  }

  if (!shouldExecute) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  const execute = await executePlan(plan)
  console.log(JSON.stringify({ ...summary, execute }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
