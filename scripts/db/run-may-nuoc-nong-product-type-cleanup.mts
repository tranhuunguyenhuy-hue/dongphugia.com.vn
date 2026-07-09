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
const SOURCE_TAG = 'may_nuoc_nong_product_type_cleanup_v1'
const PRODUCT_TYPE_SOURCE = 'taxonomy_seed_manual_v1'

type CleanupRow = {
  product_id: number
  sku: string | null
  name: string
  brand_name: string | null
  current_product_type: string | null
  proposed_product_type: string
  heuristic_reason: string
}

type ProductTypeSeed = {
  slug: string
  name: string
  sort_order: number
}

type CleanupPlan = {
  generatedAt: string
  sourceTag: string
  subcategoryId: number
  seedsToEnsure: ProductTypeSeed[]
  counts: {
    total: number
    byType: Record<string, number>
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

function inferProductType(name: string) {
  const lower = name.toLowerCase()

  if (
    lower.includes('phụ kiện') ||
    lower.includes('phu kien') ||
    lower.includes('thanh đốt') ||
    lower.includes('thanh dot') ||
    lower.includes('bộ hỗ trợ nhiệt') ||
    lower.includes('bo ho tro nhiet')
  ) {
    return {
      productType: 'phu-kien-may-nuoc-nong',
      heuristicReason: 'name-keywords-phu-kien',
    }
  }

  if (
    lower.includes('năng lượng mặt trời') ||
    lower.includes('nang luong mat troi')
  ) {
    return {
      productType: 'may-nuoc-nong-nang-luong-mat-troi',
      heuristicReason: 'name-keywords-solar',
    }
  }

  if (
    lower.includes('gián tiếp') ||
    lower.includes('gian tiep')
  ) {
    return {
      productType: 'may-nuoc-nong-gian-tiep',
      heuristicReason: 'name-keywords-gian-tiep',
    }
  }

  if (
    lower.includes('trực tiếp') ||
    lower.includes('truc tiep') ||
    lower.includes('máy tắm nước nóng') ||
    lower.includes('may tam nuoc nong')
  ) {
    return {
      productType: 'may-nuoc-nong-truc-tiep',
      heuristicReason: 'name-keywords-truc-tiep',
    }
  }

  return {
    productType: 'may-nuoc-nong-truc-tiep',
    heuristicReason: 'fallback-truc-tiep-review-accepted',
  }
}

async function getSubcategoryId() {
  const rows = normalizeRows(
    await prisma.$queryRawUnsafe<Array<{ subcategory_id: number }>>(`
      select s.id as subcategory_id
      from subcategories s
      join categories c on c.id = s.category_id
      where c.slug = 'vat-lieu-nuoc'
        and s.slug = 'may-nuoc-nong'
      limit 1
    `)
  )

  const id = rows[0]?.subcategory_id
  if (!id) throw new Error('Missing subcategory may-nuoc-nong')
  return id
}

async function buildPlan(): Promise<CleanupPlan> {
  const subcategoryId = await getSubcategoryId()

  const rawRows = normalizeRows(
    await prisma.$queryRawUnsafe<Array<{
      product_id: number
      sku: string | null
      name: string
      brand_name: string | null
      current_product_type: string | null
    }>>(`
      select
        p.id as product_id,
        p.sku,
        p.name,
        b.name as brand_name,
        p.product_type as current_product_type
      from products p
      join categories c on c.id = p.category_id
      join subcategories s on s.id = p.subcategory_id
      left join brands b on b.id = p.brand_id
      where c.slug = 'vat-lieu-nuoc'
        and s.slug = 'may-nuoc-nong'
        and p.product_type is null
      order by p.id asc
    `)
  )

  const rows: CleanupRow[] = rawRows.map((row) => {
    const inferred = inferProductType(row.name)
    return {
      product_id: row.product_id,
      sku: row.sku,
      name: row.name,
      brand_name: row.brand_name,
      current_product_type: row.current_product_type,
      proposed_product_type: inferred.productType,
      heuristic_reason: inferred.heuristicReason,
    }
  })

  const countsByType = Object.fromEntries(
    [...rows.reduce((map, row) => map.set(row.proposed_product_type, (map.get(row.proposed_product_type) ?? 0) + 1), new Map<string, number>()).entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
  )

  return {
    generatedAt: new Date().toISOString(),
    sourceTag: SOURCE_TAG,
    subcategoryId,
    seedsToEnsure: [
      { slug: 'may-nuoc-nong-truc-tiep', name: 'Máy nước nóng trực tiếp', sort_order: 10 },
      { slug: 'may-nuoc-nong-gian-tiep', name: 'Máy nước nóng gián tiếp', sort_order: 20 },
      { slug: 'may-nuoc-nong-nang-luong-mat-troi', name: 'Máy nước nóng năng lượng mặt trời', sort_order: 30 },
      { slug: 'phu-kien-may-nuoc-nong', name: 'Phụ kiện máy nước nóng', sort_order: 40 },
    ],
    counts: {
      total: rows.length,
      byType: countsByType,
    },
    rows,
  }
}

function writePlanArtifacts(plan: CleanupPlan) {
  mkdirSync(HANDOFF_DIR, { recursive: true })
  const jsonPath = join(HANDOFF_DIR, 'catalog-may-nuoc-nong-product-type-cleanup-plan.json')
  const mdPath = join(HANDOFF_DIR, 'catalog-may-nuoc-nong-product-type-cleanup-plan.md')
  const csvPath = join(HANDOFF_DIR, 'catalog-may-nuoc-nong-product-type-cleanup-plan.csv')

  const md = [
    '# May Nuoc Nong Product Type Cleanup Plan',
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
    '## Product types to ensure',
    '',
    ...plan.seedsToEnsure.map((seed) => `- ${seed.slug} | ${seed.name}`),
    '',
    '## Guardrails',
    '',
    '- Chỉ update các row hiện `product_type is null` trong `vat-lieu-nuoc/may-nuoc-nong`.',
    '- Seed product_types theo kiểu additive; không sửa slug/type cũ.',
    '- Rollback chỉ trả product rows về `null`; không xóa type seed additive.',
    '',
  ].join('\n')

  const csv = [
    ['product_id', 'sku', 'brand_name', 'name', 'current_product_type', 'proposed_product_type', 'heuristic_reason'],
    ...plan.rows.map((row) => [
      row.product_id,
      row.sku,
      row.brand_name,
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
  const countRows = normalizeRows(
    await prisma.$queryRawUnsafe<Array<{ exact_count: number }>>(`
      select count(*) as exact_count
      from products p
      where p.id in (${ids.join(',')})
        and p.subcategory_id = ${plan.subcategoryId}
        and p.product_type is null
    `)
  )

  const existingTypeRows = normalizeRows(
    await prisma.$queryRawUnsafe<Array<{ slug: string }>>(`
      select slug
      from product_types
      where subcategory_id = ${plan.subcategoryId}
        and slug in (${plan.seedsToEnsure.map((seed) => sqlString(seed.slug)).join(', ')})
      order by slug asc
    `)
  )

  return {
    exactCount: countRows[0]?.exact_count ?? 0,
    existingTypeSlugs: existingTypeRows.map((row) => row.slug),
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
  const artifactPath = join(OUTPUT_DIR, 'catalog-may-nuoc-nong-product-type-cleanup-rollback.json')
  writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  return { artifact, artifactPath }
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
          `(${plan.subcategoryId}, ${sqlString(seed.slug)}, ${sqlString(seed.name)}, ${seed.sort_order}, true, now(), now())`
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
          `(${row.product_id}, ${sqlNullableString(row.sku)}, ${sqlString(row.proposed_product_type)})`
      )
      .join(',\n')

    const updatedRows = normalizeRows(
      await tx.$queryRawUnsafe<Array<{ updated_count: number }>>(`
        with input(product_id, sku, proposed_product_type) as (
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
            and p.subcategory_id = ${plan.subcategoryId}
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

    return {
      updatedCount,
    }
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

  const resultJsonPath = join(HANDOFF_DIR, 'catalog-may-nuoc-nong-product-type-cleanup-execute-result.json')
  const resultMdPath = join(HANDOFF_DIR, 'catalog-may-nuoc-nong-product-type-cleanup-execute-result.md')
  writeFileSync(resultJsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  writeFileSync(
    resultMdPath,
    [
      '# May Nuoc Nong Product Type Cleanup Execute Result',
      '',
      `Executed: ${result.executedAt}`,
      `- Updated rows: ${executeResult.updatedCount}`,
      `- Rollback artifact: ${rollback.artifactPath}`,
      '',
      `- Before exact count: ${preflight.exactCount}`,
      `- After exact count: ${after.exactCount}`,
      `- Existing product_type slugs after execute: ${after.existingTypeSlugs.join(', ')}`,
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

  const resultPath = join(HANDOFF_DIR, 'catalog-may-nuoc-nong-product-type-cleanup-rollback-result.json')
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
