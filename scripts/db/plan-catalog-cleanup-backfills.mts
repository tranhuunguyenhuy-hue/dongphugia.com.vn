import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import prismaModule from '@/lib/prisma'

const prisma = ((prismaModule as { default?: unknown }).default ??
  prismaModule) as {
  $queryRawUnsafe: <T = unknown>(query: string) => Promise<T>
  $disconnect: () => Promise<void>
}

const OUTPUT_DIR = join(process.cwd(), 'docs', 'handoffs')

type PlannedRow = {
  lane: string
  product_id: number
  sku: string | null
  name: string
  subcategory_slug: string | null
  current_product_type: string | null
  proposed_product_type: string | null
  current_primary_taxon_slug: string | null
  proposed_primary_taxon_slug: string | null
  strategy: string
  confidence: 'high' | 'medium' | 'low'
}

function toCsvCell(value: unknown) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

async function planVatLieuNuoc() {
  const rows = await prisma.$queryRawUnsafe<Array<{
    product_id: number
    sku: string | null
    name: string
    subcategory_slug: string | null
    product_type: string | null
  }>>(`
    select
      p.id as product_id,
      p.sku,
      p.name,
      s.slug as subcategory_slug,
      p.product_type
    from products p
    join categories c on c.id = p.category_id
    left join subcategories s on s.id = p.subcategory_id
    where c.slug = 'vat-lieu-nuoc'
      and p.product_type is null
    order by s.slug asc nulls last, p.name asc
  `)

  return rows.map<PlannedRow>((row) => {
    let proposed: string | null = null
    let confidence: 'high' | 'medium' | 'low' = 'medium'

    switch (row.subcategory_slug) {
      case 'loc-nuoc':
        proposed = 'loc-nuoc'
        confidence = 'high'
        break
      case 'bon-chua-nuoc':
        proposed = 'bon-chua-nuoc'
        confidence = 'high'
        break
      case 'may-bom-nuoc':
        proposed = 'may-bom-nuoc'
        confidence = 'high'
        break
      case 'may-nuoc-nong':
        proposed = null
        confidence = 'low'
        break
      default:
        proposed = null
        confidence = 'low'
        break
    }

    return {
      lane: 'vat-lieu-nuoc',
      product_id: row.product_id,
      sku: row.sku,
      name: row.name,
      subcategory_slug: row.subcategory_slug,
      current_product_type: row.product_type,
      proposed_product_type: proposed,
      current_primary_taxon_slug: null,
      proposed_primary_taxon_slug: null,
      strategy: proposed ? 'subcategory-direct-map' : 'manual-or-name-heuristic-needed',
      confidence,
    }
  })
}

async function planGachOpLat() {
  const rows = await prisma.$queryRawUnsafe<Array<{
    product_id: number
    sku: string | null
    name: string
    subcategory_slug: string | null
    current_primary_taxon_slug: string | null
  }>>(`
    select
      p.id as product_id,
      p.sku,
      p.name,
      s.slug as subcategory_slug,
      ct.slug as current_primary_taxon_slug
    from products p
    join categories c on c.id = p.category_id
    left join subcategories s on s.id = p.subcategory_id
    left join product_taxon_assignments pta
      on pta.product_id = p.id
     and pta.is_primary = true
    left join catalog_taxons ct
      on ct.id = pta.taxon_id
    where c.slug = 'gach-op-lat'
      and pta.id is null
    order by s.slug asc nulls last, p.name asc
  `)

  return rows.map<PlannedRow>((row) => ({
    lane: 'gach-op-lat',
    product_id: row.product_id,
    sku: row.sku,
    name: row.name,
    subcategory_slug: row.subcategory_slug,
    current_product_type: null,
    proposed_product_type: null,
    current_primary_taxon_slug: row.current_primary_taxon_slug,
    proposed_primary_taxon_slug: row.subcategory_slug,
    strategy: 'subcategory-to-primary-taxon-map',
    confidence: row.subcategory_slug ? 'high' : 'low',
  }))
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const [vatLieuNuoc, gachOpLat] = await Promise.all([
    planVatLieuNuoc(),
    planGachOpLat(),
  ])

  const allRows = [...vatLieuNuoc, ...gachOpLat]
  const md = [
    '# Catalog Cleanup Backfill Planner',
    '',
    'Updated: 2026-07-09',
    '',
    `- Vật liệu nước candidates: ${vatLieuNuoc.length}`,
    `  - High-confidence direct product_type proposals: ${vatLieuNuoc.filter((row) => row.confidence === 'high').length}`,
    `  - Low-confidence/manual needed: ${vatLieuNuoc.filter((row) => row.confidence !== 'high').length}`,
    `- Gạch ốp lát missing primary taxon: ${gachOpLat.length}`,
    `  - High-confidence subcategory -> taxon proposals: ${gachOpLat.filter((row) => row.confidence === 'high').length}`,
    '',
    'This is read-only planning output. No DB writes were performed.',
    '',
  ].join('\n')

  const csvHeaders = [
    'lane',
    'product_id',
    'sku',
    'name',
    'subcategory_slug',
    'current_product_type',
    'proposed_product_type',
    'current_primary_taxon_slug',
    'proposed_primary_taxon_slug',
    'strategy',
    'confidence',
  ]

  const csv = [csvHeaders, ...allRows.map((row) => [
    row.lane,
    row.product_id,
    row.sku,
    row.name,
    row.subcategory_slug,
    row.current_product_type,
    row.proposed_product_type,
    row.current_primary_taxon_slug,
    row.proposed_primary_taxon_slug,
    row.strategy,
    row.confidence,
  ])]
    .map((row) => row.map(toCsvCell).join(','))
    .join('\n')

  const mdPath = join(OUTPUT_DIR, 'catalog-cleanup-backfill-planner.md')
  const csvPath = join(OUTPUT_DIR, 'catalog-cleanup-backfill-planner.csv')

  writeFileSync(mdPath, `${md}\n`, 'utf8')
  writeFileSync(csvPath, `${csv}\n`, 'utf8')

  console.log(JSON.stringify({
    mdPath,
    csvPath,
    vatLieuNuocHighConfidence: vatLieuNuoc.filter((row) => row.confidence === 'high').length,
    vatLieuNuocManual: vatLieuNuoc.filter((row) => row.confidence !== 'high').length,
    gachOpLatHighConfidence: gachOpLat.filter((row) => row.confidence === 'high').length,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
