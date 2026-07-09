import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import prismaModule from '@/lib/prisma'

const prisma = ((prismaModule as { default?: unknown }).default ??
  prismaModule) as {
  $queryRawUnsafe: <T = unknown>(query: string) => Promise<T>
  $disconnect: () => Promise<void>
  $transaction: <T>(
    fn: (tx: {
      $queryRawUnsafe: <R = unknown>(query: string) => Promise<R>
      products: {
        updateMany: (args: {
          where: {
            id: number
            sku: string | null
            product_type: null
          }
          data: {
            product_type: string
          }
        }) => Promise<{ count: number }>
      }
      product_taxon_assignments: {
        createMany: (args: {
          data: Array<{
            product_id: number
            taxon_id: number
            is_primary: boolean
            source: string
            role: string
            confidence: number
            metadata: unknown
          }>
          skipDuplicates?: boolean
        }) => Promise<{ count: number }>
        deleteMany: (args: {
          where: {
            product_id?: { in: number[] }
            source?: string
            product_id_taxton_guard?: never
          }
        }) => Promise<{ count: number }>
      }
    }) => Promise<T>,
    options?: { isolationLevel?: 'Serializable' | 'ReadCommitted' | 'RepeatableRead' }
  ) => Promise<T>
}

const HANDOFF_DIR = join(process.cwd(), 'docs', 'handoffs')
const OUTPUT_DIR = join(process.cwd(), 'scripts', 'output')
const SOURCE_TAG = 'catalog_cleanup_high_confidence_v1'

type TaxonRow = {
  id: number
  slug: string
  name: string
  canonical_path: string
}

type VatLieuNuocRow = {
  lane: 'vat-lieu-nuoc'
  product_id: number
  sku: string | null
  name: string
  subcategory_slug: string
  current_product_type: string | null
  proposed_product_type: string
}

type GachOpLatRow = {
  lane: 'gach-op-lat'
  product_id: number
  sku: string | null
  name: string
  subcategory_slug: string
  taxon_id: number
  proposed_primary_taxon_slug: string
  proposed_primary_taxon_path: string
}

type CleanupPlan = {
  generatedAt: string
  sourceTag: string
  counts: {
    vatLieuNuocHighConfidence: number
    gachOpLatHighConfidence: number
    total: number
  }
  taxonMap: Record<string, { id: number; canonicalPath: string }>
  vatLieuNuoc: VatLieuNuocRow[]
  gachOpLat: GachOpLatRow[]
}

type RollbackArtifact = {
  generatedAt: string
  sourceTag: string
  counts: CleanupPlan['counts']
  vatLieuNuoc: Array<{
    product_id: number
    sku: string | null
    expected_current_product_type: string
    rollback_product_type: null
  }>
  gachOpLat: Array<{
    product_id: number
    taxon_id: number
    source: string
  }>
}

function argValue(prefix: string) {
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null
}

const shouldExecute = process.argv.includes('--execute')
const rollbackArtifactPath = argValue('--rollback=')

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

async function queryTaxonMap() {
  const rows = normalizeRows(
    await prisma.$queryRawUnsafe<TaxonRow[]>(`
      select id, slug, name, canonical_path
      from catalog_taxons
      where canonical_path in (
        'gach-op-lat/gach-op-lat',
        'gach-op-lat/gach-op-tuong',
        'gach-op-lat/gach-inax-ecocarat',
        'gach-op-lat/gach-trang-tri'
      )
      order by canonical_path asc
    `)
  )

  const taxonMap = Object.fromEntries(
    rows.map((row) => [
      row.slug,
      {
        id: row.id,
        canonicalPath: row.canonical_path,
      },
    ])
  )

  for (const slug of ['gach-op-lat', 'gach-op-tuong', 'gach-inax-ecocarat', 'gach-trang-tri']) {
    if (!taxonMap[slug]) throw new Error(`Missing catalog taxon for slug ${slug}`)
  }

  return taxonMap
}

async function buildPlan(): Promise<CleanupPlan> {
  const taxonMap = await queryTaxonMap()

  const vatLieuNuoc = normalizeRows(
    await prisma.$queryRawUnsafe<VatLieuNuocRow[]>(`
      select
        'vat-lieu-nuoc' as lane,
        p.id as product_id,
        p.sku,
        p.name,
        s.slug as subcategory_slug,
        p.product_type as current_product_type,
        s.slug as proposed_product_type
      from products p
      join categories c on c.id = p.category_id
      join subcategories s on s.id = p.subcategory_id
      where c.slug = 'vat-lieu-nuoc'
        and p.product_type is null
        and s.slug in ('loc-nuoc', 'bon-chua-nuoc', 'may-bom-nuoc')
      order by s.slug asc, p.id asc
    `)
  )

  const gachOpLatBase = normalizeRows(
    await prisma.$queryRawUnsafe<Array<{
      product_id: number
      sku: string | null
      name: string
      subcategory_slug: string
    }>>(`
      select
        p.id as product_id,
        p.sku,
        p.name,
        s.slug as subcategory_slug
      from products p
      join categories c on c.id = p.category_id
      join subcategories s on s.id = p.subcategory_id
      left join product_taxon_assignments pta
        on pta.product_id = p.id
       and pta.is_primary = true
      where c.slug = 'gach-op-lat'
        and pta.id is null
        and s.slug in ('gach-op-lat', 'gach-op-tuong', 'gach-inax-ecocarat', 'gach-trang-tri')
      order by s.slug asc, p.id asc
    `)
  )

  const gachOpLat: GachOpLatRow[] = gachOpLatBase.map((row) => ({
    lane: 'gach-op-lat',
    product_id: row.product_id,
    sku: row.sku,
    name: row.name,
    subcategory_slug: row.subcategory_slug,
    taxon_id: taxonMap[row.subcategory_slug].id,
    proposed_primary_taxon_slug: row.subcategory_slug,
    proposed_primary_taxon_path: taxonMap[row.subcategory_slug].canonicalPath,
  }))

  return {
    generatedAt: new Date().toISOString(),
    sourceTag: SOURCE_TAG,
    counts: {
      vatLieuNuocHighConfidence: vatLieuNuoc.length,
      gachOpLatHighConfidence: gachOpLat.length,
      total: vatLieuNuoc.length + gachOpLat.length,
    },
    taxonMap,
    vatLieuNuoc,
    gachOpLat,
  }
}

function writePlanArtifacts(plan: CleanupPlan) {
  mkdirSync(HANDOFF_DIR, { recursive: true })

  const planJsonPath = join(HANDOFF_DIR, 'catalog-cleanup-high-confidence-plan.json')
  const planMdPath = join(HANDOFF_DIR, 'catalog-cleanup-high-confidence-plan.md')
  const planCsvPath = join(HANDOFF_DIR, 'catalog-cleanup-high-confidence-plan.csv')

  const md = [
    '# Catalog Cleanup High-Confidence Plan',
    '',
    `Updated: ${plan.generatedAt}`,
    '',
    `- Source tag: \`${plan.sourceTag}\``,
    `- Vật liệu nước high-confidence product_type backfill: \`${plan.counts.vatLieuNuocHighConfidence}\``,
    `- Gạch ốp lát high-confidence primary taxon backfill: \`${plan.counts.gachOpLatHighConfidence}\``,
    `- Total write candidates: \`${plan.counts.total}\``,
    '',
    '## Vật liệu nước',
    '',
    '- Scope: chỉ các sản phẩm `product_type is null` và subcategory nằm trong `loc-nuoc`, `bon-chua-nuoc`, `may-bom-nuoc`.',
    '- Không đụng `may-nuoc-nong` vì hiện vẫn là lane low-confidence/manual.',
    '',
    ...['loc-nuoc', 'bon-chua-nuoc', 'may-bom-nuoc'].map((slug) => {
      const count = plan.vatLieuNuoc.filter((row) => row.subcategory_slug === slug).length
      return `- ${slug}: ${count}`
    }),
    '',
    '## Gạch ốp lát',
    '',
    '- Scope: chỉ các sản phẩm `gach-op-lat` chưa có primary taxon và subcategory nằm trong 4 leaf high-confidence.',
    '- Không đổi `product_type`, không đổi `category_id/subcategory_id`, chỉ thêm `product_taxon_assignments` primary.',
    '',
    ...['gach-op-tuong', 'gach-trang-tri', 'gach-inax-ecocarat', 'gach-op-lat'].map((slug) => {
      const count = plan.gachOpLat.filter((row) => row.subcategory_slug === slug).length
      const taxon = plan.taxonMap[slug]
      return `- ${slug}: ${count} -> taxon_id=${taxon.id} (${taxon.canonicalPath})`
    }),
    '',
    '## Guardrails',
    '',
    '- Chỉ execute nếu preflight xác nhận exact scope count vẫn khớp.',
    '- Rollback lane `vat-lieu-nuoc`: trả `product_type` về `null` đúng cho scope đã cập nhật.',
    '- Rollback lane `gạch ốp lát`: chỉ xóa assignment được tạo bởi source tag này.',
    '',
  ].join('\n')

  const csvRows = [
    ['lane', 'product_id', 'sku', 'name', 'subcategory_slug', 'current_product_type', 'proposed_product_type', 'taxon_id', 'proposed_primary_taxon_slug', 'proposed_primary_taxon_path'],
    ...plan.vatLieuNuoc.map((row) => [
      row.lane,
      row.product_id,
      row.sku,
      row.name,
      row.subcategory_slug,
      row.current_product_type,
      row.proposed_product_type,
      '',
      '',
      '',
    ]),
    ...plan.gachOpLat.map((row) => [
      row.lane,
      row.product_id,
      row.sku,
      row.name,
      row.subcategory_slug,
      '',
      '',
      row.taxon_id,
      row.proposed_primary_taxon_slug,
      row.proposed_primary_taxon_path,
    ]),
  ]
    .map((row) => row.map(toCsvCell).join(','))
    .join('\n')

  writeFileSync(planJsonPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8')
  writeFileSync(planMdPath, `${md}\n`, 'utf8')
  writeFileSync(planCsvPath, `${csvRows}\n`, 'utf8')

  return { planJsonPath, planMdPath, planCsvPath }
}

async function runPreflight(plan: CleanupPlan) {
  const vatIds = plan.vatLieuNuoc.map((row) => row.product_id)
  const gachIds = plan.gachOpLat.map((row) => row.product_id)

  const vatCountRows = normalizeRows(
    await prisma.$queryRawUnsafe<Array<{ exact_count: number }>>(`
      select count(*) as exact_count
      from products p
      join categories c on c.id = p.category_id
      join subcategories s on s.id = p.subcategory_id
      where p.id in (${vatIds.length ? vatIds.join(',') : 'null'})
        and c.slug = 'vat-lieu-nuoc'
        and p.product_type is null
        and s.slug in ('loc-nuoc', 'bon-chua-nuoc', 'may-bom-nuoc')
    `)
  )

  const gachCountRows = normalizeRows(
    await prisma.$queryRawUnsafe<Array<{ exact_count: number }>>(`
      select count(*) as exact_count
      from products p
      join categories c on c.id = p.category_id
      join subcategories s on s.id = p.subcategory_id
      where p.id in (${gachIds.length ? gachIds.join(',') : 'null'})
        and c.slug = 'gach-op-lat'
        and s.slug in ('gach-op-lat', 'gach-op-tuong', 'gach-inax-ecocarat', 'gach-trang-tri')
        and not exists (
          select 1
          from product_taxon_assignments pta
          where pta.product_id = p.id
            and pta.is_primary = true
        )
    `)
  )

  const productsCountRows = normalizeRows(
    await prisma.$queryRawUnsafe<Array<{ total: number; active: number }>>(`
      select count(*) as total, count(*) filter (where is_active = true) as active
      from products
    `)
  )

  return {
    vatExactCount: vatCountRows[0]?.exact_count ?? 0,
    gachExactCount: gachCountRows[0]?.exact_count ?? 0,
    productsCount: productsCountRows[0]?.total ?? 0,
    activeProductsCount: productsCountRows[0]?.active ?? 0,
  }
}

function writeRollbackArtifact(plan: CleanupPlan) {
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const artifact: RollbackArtifact = {
    generatedAt: new Date().toISOString(),
    sourceTag: SOURCE_TAG,
    counts: plan.counts,
    vatLieuNuoc: plan.vatLieuNuoc.map((row) => ({
      product_id: row.product_id,
      sku: row.sku,
      expected_current_product_type: row.proposed_product_type,
      rollback_product_type: null,
    })),
    gachOpLat: plan.gachOpLat.map((row) => ({
      product_id: row.product_id,
      taxon_id: row.taxon_id,
      source: SOURCE_TAG,
    })),
  }

  const artifactPath = join(OUTPUT_DIR, 'catalog-cleanup-high-confidence-rollback.json')
  writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  return { artifact, artifactPath }
}

async function executePlan(plan: CleanupPlan) {
  const rollback = writeRollbackArtifact(plan)
  const before = await runPreflight(plan)

  if (before.vatExactCount !== plan.counts.vatLieuNuocHighConfidence) {
    throw new Error(`Vat lieu nuoc preflight mismatch: expected ${plan.counts.vatLieuNuocHighConfidence}, got ${before.vatExactCount}`)
  }
  if (before.gachExactCount !== plan.counts.gachOpLatHighConfidence) {
    throw new Error(`Gach op lat preflight mismatch: expected ${plan.counts.gachOpLatHighConfidence}, got ${before.gachExactCount}`)
  }

  const result = await prisma.$transaction(async (tx) => {
    const vatValues = plan.vatLieuNuoc
      .map(
        (row) =>
          `(${row.product_id}, ${sqlNullableString(row.sku)}, ${sqlString(row.proposed_product_type)})`
      )
      .join(',\n')

    const vatUpdatedRows = normalizeRows(
      await tx.$queryRawUnsafe<Array<{ updated_count: number }>>(`
        with input(product_id, sku, proposed_product_type) as (
          values
          ${vatValues}
        ),
        updated as (
          update products p
          set product_type = input.proposed_product_type,
              updated_at = now()
          from input
          where p.id = input.product_id
            and coalesce(p.sku, '') = coalesce(input.sku, '')
            and p.product_type is null
            and p.category_id = (
              select id from categories where slug = 'vat-lieu-nuoc' limit 1
            )
            and exists (
              select 1
              from subcategories s
              where s.id = p.subcategory_id
                and s.slug = input.proposed_product_type
            )
          returning p.id
        )
        select count(*) as updated_count from updated
      `)
    )

    const vatUpdated = vatUpdatedRows[0]?.updated_count ?? 0
    if (vatUpdated !== plan.counts.vatLieuNuocHighConfidence) {
      throw new Error(`Expected to update ${plan.counts.vatLieuNuocHighConfidence} vat-lieu-nuoc rows, updated ${vatUpdated}`)
    }

    const gachPrecheck = normalizeRows(
      await tx.$queryRawUnsafe<Array<{ exact_count: number }>>(`
        select count(*) as exact_count
        from products p
        join categories c on c.id = p.category_id
        join subcategories s on s.id = p.subcategory_id
        where p.id in (${plan.gachOpLat.map((row) => row.product_id).join(',')})
          and c.slug = 'gach-op-lat'
          and s.slug in ('gach-op-lat', 'gach-op-tuong', 'gach-inax-ecocarat', 'gach-trang-tri')
          and not exists (
            select 1
            from product_taxon_assignments pta
            where pta.product_id = p.id
              and pta.is_primary = true
          )
      `)
    )[0]?.exact_count ?? 0

    if (gachPrecheck !== plan.counts.gachOpLatHighConfidence) {
      throw new Error(`Gach precheck mismatch inside transaction: expected ${plan.counts.gachOpLatHighConfidence}, got ${gachPrecheck}`)
    }

    const metadataJson = sqlString(
      JSON.stringify({
        lane: 'gach-op-lat',
        strategy: 'subcategory-to-primary-taxon-map',
        script: 'run-catalog-cleanup-high-confidence.mts',
      })
    )
    const gachValues = plan.gachOpLat
      .map(
        (row) =>
          `(${row.product_id}, ${row.taxon_id}, true, ${sqlString(SOURCE_TAG)}, 0, 'primary', 95, ${metadataJson}::jsonb, now(), now())`
      )
      .join(',\n')

    const insertedRows = normalizeRows(
      await tx.$queryRawUnsafe<Array<{ inserted_count: number }>>(`
        with inserted as (
          insert into product_taxon_assignments (
            product_id,
            taxon_id,
            is_primary,
            source,
            sort_order,
            role,
            confidence,
            metadata,
            created_at,
            updated_at
          )
          values
          ${gachValues}
          returning product_id
        )
        select count(*) as inserted_count from inserted
      `)
    )

    const gachInserted = insertedRows[0]?.inserted_count ?? 0
    if (gachInserted !== plan.counts.gachOpLatHighConfidence) {
      throw new Error(`Expected to insert ${plan.counts.gachOpLatHighConfidence} primary taxon rows, inserted ${gachInserted}`)
    }

    return {
      vatUpdated,
      gachInserted,
    }
  }, { isolationLevel: 'Serializable' })

  const after = await runPreflight(plan)

  const executeResult = {
    executedAt: new Date().toISOString(),
    sourceTag: SOURCE_TAG,
    before,
    result,
    after,
    rollbackArtifact: rollback.artifactPath,
  }

  const resultJsonPath = join(HANDOFF_DIR, 'catalog-cleanup-high-confidence-execute-result.json')
  const resultMdPath = join(HANDOFF_DIR, 'catalog-cleanup-high-confidence-execute-result.md')

  writeFileSync(resultJsonPath, `${JSON.stringify(executeResult, null, 2)}\n`, 'utf8')
  writeFileSync(
    resultMdPath,
    [
      '# Catalog Cleanup High-Confidence Execute Result',
      '',
      `Executed: ${executeResult.executedAt}`,
      '',
      `- Vật liệu nước updated: \`${result.vatUpdated}\``,
      `- Gạch ốp lát primary assignments inserted: \`${result.gachInserted}\``,
      `- Rollback artifact: \`${rollback.artifactPath}\``,
      '',
      '## Before',
      '',
      `- vat exact count: ${before.vatExactCount}`,
      `- gach exact count: ${before.gachExactCount}`,
      `- products count: ${before.productsCount}`,
      `- active products count: ${before.activeProductsCount}`,
      '',
      '## After',
      '',
      `- vat exact count remaining: ${after.vatExactCount}`,
      `- gach exact count remaining: ${after.gachExactCount}`,
      `- products count: ${after.productsCount}`,
      `- active products count: ${after.activeProductsCount}`,
      '',
    ].join('\n'),
    'utf8'
  )

  return { executeResult, resultJsonPath, resultMdPath }
}

async function rollbackFromArtifact(artifactPath: string) {
  const resolvedPath = resolve(process.cwd(), artifactPath)
  const rollback = JSON.parse(readFileSync(resolvedPath, 'utf8')) as RollbackArtifact

  const result = await prisma.$transaction(async (tx) => {
    const vatValues = rollback.vatLieuNuoc
      .map(
        (row) =>
          `(${row.product_id}, ${sqlNullableString(row.sku)}, ${sqlString(row.expected_current_product_type)})`
      )
      .join(',\n')

    const vatRolledBackRows = normalizeRows(
      await tx.$queryRawUnsafe<Array<{ rolled_back_count: number }>>(`
        with input(product_id, sku, expected_current_product_type) as (
          values
          ${vatValues}
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

    const vatRolledBack = vatRolledBackRows[0]?.rolled_back_count ?? 0

    const deleted = await tx.product_taxon_assignments.deleteMany({
      where: {
        product_id: { in: rollback.gachOpLat.map((row) => row.product_id) },
        source: rollback.sourceTag,
      },
    })

    return {
      vatRolledBack,
      gachDeleted: deleted.count,
    }
  }, { isolationLevel: 'Serializable' })

  const resultPath = join(HANDOFF_DIR, 'catalog-cleanup-high-confidence-rollback-result.json')
  writeFileSync(
    resultPath,
    `${JSON.stringify({ rolledBackAt: new Date().toISOString(), artifactPath: resolvedPath, result }, null, 2)}\n`,
    'utf8'
  )

  return { resultPath, result }
}

async function main() {
  if (rollbackArtifactPath) {
    const rollback = await rollbackFromArtifact(rollbackArtifactPath)
    console.log(JSON.stringify({ mode: 'rollback', ...rollback }, null, 2))
    return
  }

  const plan = await buildPlan()
  const artifactPaths = writePlanArtifacts(plan)
  const preflight = await runPreflight(plan)

  const summary = {
    mode: shouldExecute ? 'execute' : 'dry-run',
    sourceTag: SOURCE_TAG,
    counts: plan.counts,
    preflight,
    artifacts: artifactPaths,
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
