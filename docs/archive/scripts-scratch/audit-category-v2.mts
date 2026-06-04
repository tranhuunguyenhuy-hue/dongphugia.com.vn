/**
 * Category Mismatch Audit V2 - Refined (loại bỏ false positives)
 * Usage: npx tsx scripts/scratch/audit-category-v2.mts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface MismatchResult {
  id: number
  sku: string
  name: string
  currentSubcat: string
  currentSubcatSlug: string
  suggestedSubcat: string
  reason: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  category: string
}

async function audit() {
  const mismatches: MismatchResult[] = []

  // Load subcategories
  const subcats = await prisma.subcategories.findMany({
    include: { categories: true },
    orderBy: { id: 'asc' }
  })
  const subcatMap = Object.fromEntries(subcats.map(s => [s.id, s]))

  // Load active products
  const products = await prisma.products.findMany({
    where: { is_active: true },
    select: {
      id: true, sku: true, name: true,
      subcategory_id: true, category_id: true,
      product_type: true, product_sub_type: true,
      subcategories: { select: { name: true, slug: true, category_id: true } },
      categories: { select: { name: true, slug: true } }
    },
    orderBy: { id: 'asc' }
  })

  console.log(`=== CATEGORY MISMATCH AUDIT V2 (Refined) ===`)
  console.log(`Total active products: ${products.length}\n`)

  // ====== RULE-BASED CHECKS (Higher precision) ======

  for (const p of products) {
    const nameLower = p.name.toLowerCase()
    const currentSlug = p.subcategories?.slug || ''
    const currentCat = p.categories?.slug || ''
    const currentSubcatName = p.subcategories?.name || 'N/A'

    // ────── TBVS specific rules ──────

    // RULE 1: "Nắp bồn cầu" / "nắp rửa" / "nắp điện tử" / "washlet" in non-nắp subcats
    // But NOT if it's a combo (bồn cầu + nắp)
    if ((nameLower.includes('nắp bồn cầu') || nameLower.includes('nắp rửa điện tử') 
        || nameLower.includes('washlet') || nameLower.match(/^nắp (rửa|điện tử)/))
        && currentSlug !== 'nap-bon-cau'
        && !nameLower.includes('bồn cầu') // not a combo
        && !nameLower.includes('+')) {
      mismatches.push({
        id: p.id, sku: p.sku, name: p.name, category: currentCat,
        currentSubcat: currentSubcatName, currentSubcatSlug: currentSlug,
        suggestedSubcat: 'Nắp Bồn Cầu (nap-bon-cau)',
        reason: 'Sản phẩm nắp bồn cầu nằm ngoài danh mục Nắp Bồn Cầu',
        severity: 'HIGH'
      })
      continue
    }

    // RULE 2: "Thân bồn cầu" stand-alone in non-thân-bồn-cầu subcats
    if (nameLower.includes('thân bồn cầu') && currentSlug !== 'than-bon-cau' && !nameLower.includes('+')) {
      mismatches.push({
        id: p.id, sku: p.sku, name: p.name, category: currentCat,
        currentSubcat: currentSubcatName, currentSubcatSlug: currentSlug,
        suggestedSubcat: 'Thân Bồn Cầu (than-bon-cau)',
        reason: 'Sản phẩm thân bồn cầu nằm ngoài danh mục Thân Bồn Cầu',
        severity: 'HIGH'
      })
      continue
    }

    // RULE 3: Products with ONLY "bồn cầu" in name but in wrong subcat
    if (nameLower.match(/^bồn cầu\b/) && currentSlug !== 'bon-cau' && !nameLower.includes('nắp') && !nameLower.includes('phụ kiện')) {
      mismatches.push({
        id: p.id, sku: p.sku, name: p.name, category: currentCat,
        currentSubcat: currentSubcatName, currentSubcatSlug: currentSlug,
        suggestedSubcat: 'Bồn Cầu (bon-cau)',
        reason: 'Sản phẩm bồn cầu nằm ngoài danh mục Bồn Cầu',
        severity: 'HIGH'
      })
      continue
    }

    // RULE 4: "Lavabo" products in non-lavabo subcat
    if ((nameLower.includes('lavabo') || nameLower.match(/^chậu (rửa mặt|đặt bàn|treo tường|âm bàn)/))
        && currentSlug !== 'lavabo'
        && !nameLower.includes('vòi') && !nameLower.includes('chân')
        && !nameLower.includes('chén') && !nameLower.includes('bát')) {
      mismatches.push({
        id: p.id, sku: p.sku, name: p.name, category: currentCat,
        currentSubcat: currentSubcatName, currentSubcatSlug: currentSlug,
        suggestedSubcat: 'Chậu Lavabo (lavabo)',
        reason: 'Sản phẩm lavabo nằm ngoài danh mục Lavabo',
        severity: 'HIGH'
      })
      continue
    }

    // RULE 5: "Bồn tắm" products in non-bồn-tắm subcat
    if (nameLower.match(/^bồn tắm\b/) && currentSlug !== 'bon-tam') {
      mismatches.push({
        id: p.id, sku: p.sku, name: p.name, category: currentCat,
        currentSubcat: currentSubcatName, currentSubcatSlug: currentSlug,
        suggestedSubcat: 'Bồn Tắm (bon-tam)',
        reason: 'Sản phẩm bồn tắm nằm ngoài danh mục Bồn Tắm',
        severity: 'HIGH'
      })
      continue
    }

    // RULE 6: "Bồn tiểu" products in non-bồn-tiểu subcat
    if (nameLower.match(/^bồn tiểu\b/) && currentSlug !== 'bon-tieu') {
      mismatches.push({
        id: p.id, sku: p.sku, name: p.name, category: currentCat,
        currentSubcat: currentSubcatName, currentSubcatSlug: currentSlug,
        suggestedSubcat: 'Bồn Tiểu (bon-tieu)',
        reason: 'Sản phẩm bồn tiểu nằm ngoài danh mục Bồn Tiểu',
        severity: 'HIGH'
      })
      continue
    }

    // RULE 7: "Sen tắm / sen cây / bộ sen" in non-sen-tam subcat
    if (nameLower.match(/^(bộ sen|sen tắm|sen cây)\b/) && currentSlug !== 'sen-tam') {
      mismatches.push({
        id: p.id, sku: p.sku, name: p.name, category: currentCat,
        currentSubcat: currentSubcatName, currentSubcatSlug: currentSlug,
        suggestedSubcat: 'Sen Tắm (sen-tam)',
        reason: 'Sản phẩm sen tắm nằm ngoài danh mục Sen Tắm',
        severity: 'HIGH'
      })
      continue
    }

    // RULE 8: "Vòi chậu" / "vòi lavabo" in non-vòi-chậu subcat
    if (nameLower.match(/^vòi (chậu|lavabo)\b/) && currentSlug !== 'voi-chau') {
      mismatches.push({
        id: p.id, sku: p.sku, name: p.name, category: currentCat,
        currentSubcat: currentSubcatName, currentSubcatSlug: currentSlug,
        suggestedSubcat: 'Vòi Chậu (voi-chau)',
        reason: 'Sản phẩm vòi chậu nằm ngoài danh mục Vòi Chậu',
        severity: 'HIGH'
      })
      continue
    }

    // RULE 9: "Vòi bếp" / "vòi rửa chén/bát" in non-vòi-rửa-chén subcat
    if (nameLower.match(/^vòi (bếp|rửa (chén|bát))\b/) && currentSlug !== 'voi-rua-chen') {
      mismatches.push({
        id: p.id, sku: p.sku, name: p.name, category: currentCat,
        currentSubcat: currentSubcatName, currentSubcatSlug: currentSlug,
        suggestedSubcat: 'Vòi Rửa Chén (voi-rua-chen)',
        reason: 'Sản phẩm vòi bếp nằm ngoài danh mục Vòi Rửa Chén',
        severity: 'HIGH'
      })
      continue
    }

    // RULE 10: TBVS products in Thiết Bị Bếp category and vice versa
    // Bồn cầu, lavabo, sen, bồn tắm... should be in TBVS category
    if (currentCat === 'thiet-bi-bep') {
      if (nameLower.match(/(bồn cầu|lavabo|sen tắm|bồn tắm|bồn tiểu|phụ kiện phòng tắm)/)) {
        mismatches.push({
          id: p.id, sku: p.sku, name: p.name, category: currentCat,
          currentSubcat: currentSubcatName, currentSubcatSlug: currentSlug,
          suggestedSubcat: 'Nên ở Thiết Bị Vệ Sinh',
          reason: 'Sản phẩm TBVS nằm trong danh mục Thiết Bị Bếp',
          severity: 'HIGH'
        })
        continue
      }
    }

    // RULE 11: Category-Subcategory parent mismatch
    if (p.subcategory_id && p.category_id) {
      const subcat = subcatMap[p.subcategory_id]
      if (subcat && subcat.category_id !== p.category_id) {
        mismatches.push({
          id: p.id, sku: p.sku, name: p.name, category: currentCat,
          currentSubcat: `${p.categories?.name} → ${currentSubcatName}`,
          currentSubcatSlug: currentSlug,
          suggestedSubcat: `Parent cat should be: ${subcat.categories?.name}`,
          reason: `category_id (${p.category_id}) ≠ subcategory.category_id (${subcat.category_id})`,
          severity: 'HIGH'
        })
        continue
      }
    }

    // RULE 12: Missing subcategory
    if (!p.subcategory_id) {
      mismatches.push({
        id: p.id, sku: p.sku, name: p.name, category: currentCat,
        currentSubcat: 'N/A (không có subcategory)',
        currentSubcatSlug: '',
        suggestedSubcat: 'Cần gán subcategory',
        reason: 'Thiếu subcategory_id',
        severity: 'MEDIUM'
      })
      continue
    }

    // RULE 13: "Phụ kiện" bồn cầu vs phòng tắm
    if (nameLower.includes('phụ kiện bồn cầu') && currentSlug !== 'phu-kien-bon-cau') {
      mismatches.push({
        id: p.id, sku: p.sku, name: p.name, category: currentCat,
        currentSubcat: currentSubcatName, currentSubcatSlug: currentSlug,
        suggestedSubcat: 'Phụ Kiện Bồn Cầu (phu-kien-bon-cau)',
        reason: 'Phụ kiện bồn cầu nằm ngoài danh mục Phụ Kiện Bồn Cầu',
        severity: 'MEDIUM'
      })
      continue
    }

    // RULE 14: Chậu rửa CHÉN/BÁT in lavabo (they're kitchen, not bathroom!)
    if (nameLower.includes('chậu rửa chén') || nameLower.includes('chậu rửa bát')) {
      if (currentSlug === 'lavabo') {
        mismatches.push({
          id: p.id, sku: p.sku, name: p.name, category: currentCat,
          currentSubcat: currentSubcatName, currentSubcatSlug: currentSlug,
          suggestedSubcat: 'Chậu Rửa Chén (thiet-bi-bep)',
          reason: 'Chậu rửa chén/bát (bếp) nằm trong danh mục Lavabo (phòng tắm)',
          severity: 'HIGH'
        })
        continue
      }
    }
  }

  // ====== SPECIAL: Cross-verify product_type vs name ======
  console.log('--- Cross-verify product_type vs actual product ---')

  for (const p of products) {
    if (!p.product_type) continue
    const nameLower = p.name.toLowerCase()
    
    // product_type says "nap-bon-cau" but name says "bồn cầu"
    if (p.product_type === 'nap-bon-cau' && nameLower.match(/^bồn cầu/)) {
      if (!mismatches.find(m => m.id === p.id)) {
        mismatches.push({
          id: p.id, sku: p.sku, name: p.name, category: p.categories?.slug || '',
          currentSubcat: p.subcategories?.name || 'N/A', currentSubcatSlug: p.subcategories?.slug || '',
          suggestedSubcat: 'Kiểm tra: product_type=nap-bon-cau nhưng tên là bồn cầu',
          reason: 'product_type không khớp với tên sản phẩm',
          severity: 'MEDIUM'
        })
      }
    }
  }

  // ====== OUTPUT RESULTS ======
  console.log(`\n${'='.repeat(80)}`)
  console.log(`TOTAL CONFIRMED MISMATCHES: ${mismatches.length}`)
  console.log(`${'='.repeat(80)}`)

  const high = mismatches.filter(m => m.severity === 'HIGH')
  const medium = mismatches.filter(m => m.severity === 'MEDIUM')
  const low = mismatches.filter(m => m.severity === 'LOW')

  console.log(`\n🔴 HIGH: ${high.length} | 🟡 MEDIUM: ${medium.length} | ⚪ LOW: ${low.length}`)

  // Group by reason pattern
  const byReason: Record<string, MismatchResult[]> = {}
  for (const m of mismatches) {
    if (!byReason[m.reason]) byReason[m.reason] = []
    byReason[m.reason].push(m)
  }

  console.log(`\n${'─'.repeat(80)}`)
  console.log('GROUPED BY ISSUE TYPE:')
  console.log(`${'─'.repeat(80)}`)

  for (const [reason, items] of Object.entries(byReason).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n📌 ${reason} (${items.length} sản phẩm)`)
    console.log('─'.repeat(60))
    for (const m of items.slice(0, 8)) {
      console.log(`  [${m.id}] ${m.sku.padEnd(30)} ${m.name.substring(0, 65)}`)
      console.log(`         Hiện tại: ${m.currentSubcat} → Gợi ý: ${m.suggestedSubcat}`)
    }
    if (items.length > 8) console.log(`  ... và ${items.length - 8} sản phẩm khác`)
  }

  // Summary table
  console.log(`\n${'─'.repeat(80)}`)
  console.log('SUMMARY TABLE:')
  console.log(`${'─'.repeat(80)}`)
  console.log(`${'Issue'.padEnd(60)} | Count | Severity`)
  console.log(`${'─'.repeat(60)}-+-------+---------`)
  for (const [reason, items] of Object.entries(byReason).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${reason.substring(0, 60).padEnd(60)} | ${String(items.length).padStart(5)} | ${items[0].severity}`)
  }

  await prisma.$disconnect()
}

audit().catch(console.error)
