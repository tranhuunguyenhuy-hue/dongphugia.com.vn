/**
 * Analyze product variants and combo patterns for brainstorming
 * Usage: npx tsx scripts/scratch/analyze-variants.mts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function analyze() {
  // 1. Product relationships overview
  const rels = await prisma.product_relationships.findMany({
    include: {
      parent: {
        select: {
          id: true, sku: true, name: true,
          product_type: true, product_sub_type: true,
          subcategory_id: true, is_active: true
        }
      }
    },
    orderBy: { parent_id: 'asc' }
  })
  console.log('=== PRODUCT RELATIONSHIPS ===')
  console.log('Total relationships:', rels.length)

  const byType: Record<string, number> = {}
  for (const r of rels) {
    byType[r.relationship_type] = (byType[r.relationship_type] || 0) + 1
  }
  console.log('By type:', JSON.stringify(byType))

  // 2. Subcategories of TBVS
  const subcats = await prisma.subcategories.findMany({
    where: { categories: { slug: 'thiet-bi-ve-sinh' } },
    select: {
      id: true, name: true, slug: true,
      _count: { select: { products: true } }
    },
    orderBy: { sort_order: 'asc' }
  })
  console.log('\n=== SUBCATEGORIES (TBVS) ===')
  for (const s of subcats) {
    console.log(`  [${s.id}] ${s.slug.padEnd(30)} ${s.name.padEnd(25)} Products: ${s._count.products}`)
  }

  // 3. Product types for bồn cầu subcategory
  const bonCauSubcat = subcats.find(s => s.slug.includes('bon-cau'))
  if (bonCauSubcat) {
    const types = await prisma.$queryRaw<Array<{ product_type: string | null, product_sub_type: string | null, cnt: bigint }>>`
      SELECT product_type, product_sub_type, COUNT(*) as cnt
      FROM products
      WHERE subcategory_id = ${bonCauSubcat.id} AND is_active = true
      GROUP BY product_type, product_sub_type
      ORDER BY cnt DESC
    `
    console.log('\n=== BỒN CẦU - PRODUCT TYPES ===')
    for (const t of types) {
      console.log(`  type: ${String(t.product_type).padEnd(15)} sub_type: ${String(t.product_sub_type).padEnd(20)} count: ${t.cnt}`)
    }
  }

  // 4. Sample parents with relationships
  const parentIds = [...new Set(rels.map(r => r.parent_id))]
  console.log('\n=== PARENTS WITH RELATIONSHIPS ===')
  console.log('Unique parents:', parentIds.length)

  for (const pid of parentIds.slice(0, 10)) {
    const parent = await prisma.products.findUnique({
      where: { id: pid },
      select: { id: true, sku: true, name: true, subcategory_id: true, product_type: true }
    })
    const children = rels.filter(r => r.parent_id === pid)
    console.log(`\n  Parent: [${parent?.id}] ${parent?.sku} - ${parent?.name?.substring(0, 60)}`)
    console.log(`  Type: ${parent?.product_type}, SubcatID: ${parent?.subcategory_id}`)
    for (const c of children) {
      console.log(`    → [${c.relationship_type}] child_sku: ${c.child_sku}, child_id: ${c.child_id || 'NULL'}`)
    }
  }

  // 5. Combo bồn cầu products
  if (bonCauSubcat) {
    const combos = await prisma.products.findMany({
      where: {
        product_type: 'combo',
        is_active: true,
        subcategory_id: bonCauSubcat.id
      },
      select: { id: true, sku: true, name: true, component_skus: true },
      orderBy: { sku: 'asc' },
      take: 15
    })
    console.log('\n=== COMBO BỒN CẦU (sample) ===')
    for (const p of combos) {
      console.log(`  [${p.id}] ${p.sku.padEnd(35)} ${p.name.substring(0, 60)}`)
      if (p.component_skus.length > 0) {
        console.log(`    components: ${JSON.stringify(p.component_skus)}`)
      }
    }

    // 6. KEY ANALYSIS: Find bồn cầu sharing same base body
    // Pattern: "GG TOTO C971 TCF9433A" → base = "C971", nắp = "TCF9433A"
    // Group combos by body SKU pattern
    console.log('\n=== VARIANT ANALYSIS: Same body, different lid ===')

    const allCombos = await prisma.products.findMany({
      where: {
        product_type: 'combo',
        is_active: true,
        subcategory_id: bonCauSubcat.id
      },
      select: { id: true, sku: true, name: true },
      orderBy: { sku: 'asc' }
    })

    // Also get all relationships for these combos
    const comboIds = allCombos.map(c => c.id)
    const comboRels = await prisma.product_relationships.findMany({
      where: { parent_id: { in: comboIds } },
      orderBy: { parent_id: 'asc' }
    })

    // Group by parent, find combos sharing same component
    const componentMap: Record<string, Array<{ parentId: number, parentSku: string, parentName: string }>> = {}
    for (const rel of comboRels) {
      const combo = allCombos.find(c => c.id === rel.parent_id)
      if (!combo) continue
      if (!componentMap[rel.child_sku]) componentMap[rel.child_sku] = []
      componentMap[rel.child_sku].push({
        parentId: combo.id,
        parentSku: combo.sku,
        parentName: combo.name
      })
    }

    // Find components shared by multiple combos (= variants!)
    const sharedComponents = Object.entries(componentMap)
      .filter(([, parents]) => parents.length > 1)
      .sort((a, b) => b[1].length - a[1].length)

    console.log(`\nShared components (potential variant groups): ${sharedComponents.length}`)
    for (const [childSku, parents] of sharedComponents.slice(0, 10)) {
      console.log(`\n  Component: ${childSku} → used in ${parents.length} combos:`)
      for (const p of parents) {
        console.log(`    - [${p.parentId}] ${p.parentSku} - ${p.parentName.substring(0, 60)}`)
      }
    }
  }

  // 7. Check other subcategories for combo patterns
  console.log('\n=== OTHER SUBCATEGORIES WITH COMBOS ===')
  for (const subcat of subcats) {
    const comboCount = await prisma.products.count({
      where: {
        subcategory_id: subcat.id,
        product_type: 'combo',
        is_active: true
      }
    })
    if (comboCount > 0) {
      console.log(`  [${subcat.id}] ${subcat.name.padEnd(30)} combos: ${comboCount}`)
    }
  }

  // 8. Check product_type distribution across all TBVS subcategories
  console.log('\n=== PRODUCT_TYPE DISTRIBUTION (ALL TBVS) ===')
  const subcatIds = subcats.map(s => s.id)
  const typeDistro = await prisma.$queryRaw<Array<{ subcategory_id: number, product_type: string | null, cnt: bigint }>>`
    SELECT subcategory_id, product_type, COUNT(*) as cnt
    FROM products
    WHERE subcategory_id = ANY(${subcatIds}) AND is_active = true AND product_type IS NOT NULL
    GROUP BY subcategory_id, product_type
    ORDER BY subcategory_id, cnt DESC
  `
  for (const t of typeDistro) {
    const subcatName = subcats.find(s => s.id === t.subcategory_id)?.name || 'Unknown'
    console.log(`  ${subcatName.padEnd(30)} type: ${String(t.product_type).padEnd(15)} count: ${t.cnt}`)
  }

  await prisma.$disconnect()
}

analyze().catch(console.error)
