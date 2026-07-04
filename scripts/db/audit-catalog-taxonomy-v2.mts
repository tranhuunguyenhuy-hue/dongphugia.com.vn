import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type TableName =
  | 'catalog_taxons'
  | 'product_taxon_assignments'
  | 'external_taxonomy_mappings'
  | 'product_attribute_values'

async function tableExists(tableName: TableName) {
  const rows = await prisma.$queryRaw<Array<{ exists: string | null }>>`
    SELECT to_regclass(${`public.${tableName}`}) AS exists
  `

  return rows[0]?.exists === tableName
}

async function countIfExists(tableName: TableName) {
  if (!(await tableExists(tableName))) {
    return null
  }

  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS count FROM ${tableName}`
  )

  return Number(rows[0]?.count ?? 0n)
}

async function main() {
  const [
    productsCount,
    activeProductsCount,
    nullSubcategoryCount,
    tables,
  ] = await Promise.all([
    prisma.products.count(),
    prisma.products.count({ where: { is_active: true } }),
    prisma.products.count({ where: { is_active: true, subcategory_id: null } }),
    Promise.all([
      countIfExists('catalog_taxons'),
      countIfExists('product_taxon_assignments'),
      countIfExists('external_taxonomy_mappings'),
      countIfExists('product_attribute_values'),
    ]),
  ])

  const [catalogTaxonsCount, productTaxonAssignmentsCount, externalMappingsCount, productAttributeValuesCount] =
    tables

  const rootTaxonsCount = catalogTaxonsCount === null
    ? null
    : await prisma.catalog_taxons.count({ where: { parent_id: null } })

  const childTaxonsCount = catalogTaxonsCount === null
    ? null
    : await prisma.catalog_taxons.count({ where: { parent_id: { not: null } } })

  const primaryTaxonViolations = productTaxonAssignmentsCount === null
    ? null
    : await prisma.$queryRaw<Array<{ duplicate_products: bigint }>>`
        SELECT COUNT(*)::bigint AS duplicate_products
        FROM (
          SELECT product_id
          FROM product_taxon_assignments
          WHERE is_primary IS TRUE
          GROUP BY product_id
          HAVING COUNT(*) > 1
        ) AS duplicates
      `

  const sampleTaxons = catalogTaxonsCount === null
    ? []
    : await prisma.catalog_taxons.findMany({
        select: {
          canonical_path: true,
          name: true,
          parent_id: true,
        },
        orderBy: [
          { depth: 'asc' },
          { sort_order: 'asc' },
          { canonical_path: 'asc' },
        ],
        take: 12,
      })

  console.log('=== Catalog Taxonomy v2 Audit ===')
  console.log(`products_count=${productsCount}`)
  console.log(`active_products_count=${activeProductsCount}`)
  console.log(`active_products_null_subcategory=${nullSubcategoryCount}`)
  console.log(`catalog_taxons_count=${catalogTaxonsCount ?? 'missing'}`)
  console.log(`catalog_taxons_root_count=${rootTaxonsCount ?? 'missing'}`)
  console.log(`catalog_taxons_child_count=${childTaxonsCount ?? 'missing'}`)
  console.log(`product_taxon_assignments_count=${productTaxonAssignmentsCount ?? 'missing'}`)
  console.log(`product_taxon_assignments_primary_violations=${primaryTaxonViolations?.[0]?.duplicate_products?.toString() ?? 'missing'}`)
  console.log(`external_taxonomy_mappings_count=${externalMappingsCount ?? 'missing'}`)
  console.log(`product_attribute_values_count=${productAttributeValuesCount ?? 'missing'}`)

  if (sampleTaxons.length > 0) {
    console.log('sample_taxons=')
    for (const taxon of sampleTaxons) {
      console.log(`- ${taxon.canonical_path} | ${taxon.name} | parent_id=${taxon.parent_id ?? 'null'}`)
    }
  }

  if (nullSubcategoryCount > 0) {
    console.log(`warning=active products with null subcategory remain at ${nullSubcategoryCount}; route/listing risk still exists until Goal 2 mapping.`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
