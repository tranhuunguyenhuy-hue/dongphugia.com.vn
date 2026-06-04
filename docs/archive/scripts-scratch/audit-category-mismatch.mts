/**
 * Category Mismatch Audit - Tìm sản phẩm nằm sai danh mục
 * Usage: npx tsx scripts/scratch/audit-category-mismatch.mts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface MismatchResult {
  id: number
  sku: string
  name: string
  currentSubcat: string
  suggestedSubcat: string
  reason: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
}

async function audit() {
  const mismatches: MismatchResult[] = []

  // Load all subcategories
  const subcats = await prisma.subcategories.findMany({
    include: { categories: true },
    orderBy: { id: 'asc' }
  })
  const subcatMap = Object.fromEntries(subcats.map(s => [s.id, s]))

  // Load all active products
  const products = await prisma.products.findMany({
    where: { is_active: true },
    select: {
      id: true, sku: true, name: true,
      subcategory_id: true, category_id: true,
      product_type: true, product_sub_type: true,
      subcategories: { select: { name: true, slug: true } },
      categories: { select: { name: true, slug: true } }
    },
    orderBy: { id: 'asc' }
  })

  console.log(`=== CATEGORY MISMATCH AUDIT ===`)
  console.log(`Total active products: ${products.length}`)
  console.log(`Total subcategories: ${subcats.length}\n`)

  // ====== CHECK 1: Product name vs subcategory mismatch ======
  console.log('--- CHECK 1: Name-based keyword mismatch ---')

  // Define keyword → expected subcategory mapping
  const keywordRules: Array<{
    keywords: string[]
    expectedSubcatSlugs: string[]
    label: string
  }> = [
    // Bồn cầu products
    { keywords: ['bồn cầu', 'bon cau', 'toilet'], expectedSubcatSlugs: ['bon-cau'], label: 'Bồn Cầu' },
    // Nắp bồn cầu
    { keywords: ['nắp bồn cầu', 'nắp rửa', 'nắp điện tử', 'washlet', 'bidet seat'], expectedSubcatSlugs: ['nap-bon-cau', 'bon-cau'], label: 'Nắp Bồn Cầu' },
    // Lavabo
    { keywords: ['lavabo', 'chậu rửa', 'chau rua', 'basin', 'chậu đặt bàn'], expectedSubcatSlugs: ['lavabo'], label: 'Chậu Lavabo' },
    // Vòi chậu
    { keywords: ['vòi chậu', 'vòi lavabo', 'faucet'], expectedSubcatSlugs: ['voi-chau'], label: 'Vòi Chậu' },
    // Sen tắm
    { keywords: ['sen tắm', 'sen cây', 'bộ sen', 'tay sen', 'shower'], expectedSubcatSlugs: ['sen-tam'], label: 'Sen Tắm' },
    // Bát sen
    { keywords: ['bát sen', 'đầu sen'], expectedSubcatSlugs: ['sen-tam'], label: 'Sen Tắm (Bát sen)' },
    // Bồn tắm
    { keywords: ['bồn tắm', 'bathtub'], expectedSubcatSlugs: ['bon-tam'], label: 'Bồn Tắm' },
    // Bồn tiểu
    { keywords: ['bồn tiểu', 'tiểu nam', 'tiểu nữ', 'urinal'], expectedSubcatSlugs: ['bon-tieu'], label: 'Bồn Tiểu' },
    // Phụ kiện phòng tắm
    { keywords: ['móc áo', 'kệ kính', 'giá đỡ', 'hộp giấy', 'thanh vịn', 'gương'], expectedSubcatSlugs: ['phu-kien-phong-tam'], label: 'Phụ Kiện Phòng Tắm' },
    // Phụ kiện bồn cầu (van, cần gạt, xả...)
    { keywords: ['van xả', 'cần gạt', 'bộ xả', 'nút nhấn'], expectedSubcatSlugs: ['phu-kien-bon-cau'], label: 'Phụ Kiện Bồn Cầu' },
    // Thân bồn cầu
    { keywords: ['thân bồn cầu'], expectedSubcatSlugs: ['than-bon-cau'], label: 'Thân Bồn Cầu' },
    // Vòi nước
    { keywords: ['vòi nước', 'vòi bếp', 'vòi rửa bát'], expectedSubcatSlugs: ['voi-nuoc'], label: 'Vòi Nước' },
    // Sàn gỗ
    { keywords: ['sàn gỗ', 'san go', 'laminate', 'hardwood'], expectedSubcatSlugs: ['san-go-cong-nghiep', 'san-go-tu-nhien', 'san-go-xuong-ca', 'san-nhua'], label: 'Sàn Gỗ' },
    // Gạch
    { keywords: ['gạch ốp', 'gạch lát', 'gach op', 'gach lat', 'tile'], expectedSubcatSlugs: ['gach-op-tuong', 'gach-lat-nen', 'gach-men'], label: 'Gạch Ốp Lát' },
  ]

  for (const product of products) {
    const nameLower = product.name.toLowerCase()
    const currentSlug = product.subcategories?.slug || ''

    for (const rule of keywordRules) {
      const matchedKeyword = rule.keywords.find(kw => nameLower.includes(kw.toLowerCase()))
      if (matchedKeyword && !rule.expectedSubcatSlugs.includes(currentSlug)) {
        // Check if it's a combo (e.g., "Bồn cầu + nắp") — these are OK in bon-cau
        const isCombo = nameLower.includes('+') || nameLower.includes('kèm')
        if (isCombo && currentSlug === 'bon-cau' && rule.label.includes('Nắp')) continue

        mismatches.push({
          id: product.id,
          sku: product.sku,
          name: product.name,
          currentSubcat: `${product.subcategories?.name || 'N/A'} (${currentSlug})`,
          suggestedSubcat: rule.label,
          reason: `Tên chứa "${matchedKeyword}" nhưng nằm trong "${product.subcategories?.name}"`,
          severity: 'HIGH'
        })
        break // Only first match per product
      }
    }
  }

  // ====== CHECK 2: product_type vs subcategory mismatch ======
  console.log('--- CHECK 2: product_type vs subcategory mismatch ---')

  const typeToSubcat: Record<string, string[]> = {
    'bon-cau-1-khoi': ['bon-cau'],
    'bon-cau-2-khoi': ['bon-cau'],
    'bon-cau-treo-tuong': ['bon-cau'],
    'bon-cau-dat-san': ['bon-cau'],
    'bon-cau-thong-minh': ['bon-cau'],
    'bon-cau-xom': ['bon-cau'],
    'nap-bon-cau': ['nap-bon-cau'],
    'phu-kien-bon-cau': ['phu-kien-bon-cau'],
    'lavabo': ['lavabo'],
    'lavabo-dat-ban': ['lavabo'],
    'lavabo-treo-tuong': ['lavabo'],
    'lavabo-am-ban': ['lavabo'],
    'lavabo-ban-am': ['lavabo'],
    'sen-tam': ['sen-tam'],
    'tay-sen': ['sen-tam'],
    'sen-am-tuong': ['sen-tam'],
    'sen-cay': ['sen-tam'],
    'sen-cay-nhiet-do': ['sen-tam'],
    'sen-nhiet-do': ['sen-tam'],
    'bat-sen': ['sen-tam'],
    'bon-tam': ['bon-tam'],
    'bon-tam-massage': ['bon-tam'],
    'bon-tam-xay': ['bon-tam'],
  }

  for (const product of products) {
    if (!product.product_type) continue
    const expectedSlugs = typeToSubcat[product.product_type]
    if (!expectedSlugs) continue
    const currentSlug = product.subcategories?.slug || ''
    if (!expectedSlugs.includes(currentSlug)) {
      // Avoid duplicate with Check 1
      if (!mismatches.find(m => m.id === product.id)) {
        mismatches.push({
          id: product.id,
          sku: product.sku,
          name: product.name,
          currentSubcat: `${product.subcategories?.name || 'N/A'} (${currentSlug})`,
          suggestedSubcat: expectedSlugs.join(' hoặc '),
          reason: `product_type="${product.product_type}" không khớp subcategory "${currentSlug}"`,
          severity: 'HIGH'
        })
      }
    }
  }

  // ====== CHECK 3: category_id vs subcategory.category_id mismatch ======
  console.log('--- CHECK 3: category vs subcategory parent mismatch ---')

  for (const product of products) {
    if (!product.subcategory_id || !product.category_id) continue
    const subcat = subcatMap[product.subcategory_id]
    if (subcat && subcat.category_id !== product.category_id) {
      if (!mismatches.find(m => m.id === product.id)) {
        mismatches.push({
          id: product.id,
          sku: product.sku,
          name: product.name,
          currentSubcat: `Cat: ${product.categories?.name} / Subcat: ${product.subcategories?.name}`,
          suggestedSubcat: `Subcat parent cat: ${subcat.categories?.name}`,
          reason: `product.category_id (${product.category_id}) ≠ subcategory.category_id (${subcat.category_id})`,
          severity: 'MEDIUM'
        })
      }
    }
  }

  // ====== CHECK 4: Products without subcategory ======
  console.log('--- CHECK 4: Products without subcategory ---')

  const noSubcat = products.filter(p => !p.subcategory_id)
  for (const p of noSubcat) {
    if (!mismatches.find(m => m.id === p.id)) {
      mismatches.push({
        id: p.id,
        sku: p.sku,
        name: p.name,
        currentSubcat: `Category: ${p.categories?.name || 'N/A'} / Subcat: NONE`,
        suggestedSubcat: 'Cần gán subcategory',
        reason: 'Thiếu subcategory_id',
        severity: 'MEDIUM'
      })
    }
  }

  // ====== CHECK 5: Products without category ======
  console.log('--- CHECK 5: Products without category ---')

  const noCat = products.filter(p => !p.category_id)
  for (const p of noCat) {
    if (!mismatches.find(m => m.id === p.id)) {
      mismatches.push({
        id: p.id,
        sku: p.sku,
        name: p.name,
        currentSubcat: 'NO CATEGORY',
        suggestedSubcat: 'Cần gán category',
        reason: 'Thiếu category_id',
        severity: 'HIGH'
      })
    }
  }

  // ====== CHECK 6: Duplicate keywords in wrong subcat (specific patterns) ======
  console.log('--- CHECK 6: Specific known patterns ---')
  
  // Check: "vòi" products in non-vòi subcategories
  for (const product of products) {
    const nameLower = product.name.toLowerCase()
    const currentSlug = product.subcategories?.slug || ''
    
    // "Vòi chậu" should not be in "sen-tam"
    if (nameLower.includes('vòi chậu') && currentSlug === 'sen-tam') {
      if (!mismatches.find(m => m.id === product.id)) {
        mismatches.push({
          id: product.id, sku: product.sku, name: product.name,
          currentSubcat: `Sen Tắm (${currentSlug})`,
          suggestedSubcat: 'Vòi Chậu (voi-chau)',
          reason: 'Vòi chậu nằm trong danh mục Sen Tắm',
          severity: 'HIGH'
        })
      }
    }

    // "Máy nước nóng" should not be in "phu-kien-phong-tam"
    if (nameLower.includes('máy nước nóng') && !currentSlug.includes('may-nuoc-nong')) {
      if (!mismatches.find(m => m.id === product.id)) {
        mismatches.push({
          id: product.id, sku: product.sku, name: product.name,
          currentSubcat: `${product.subcategories?.name} (${currentSlug})`,
          suggestedSubcat: 'Máy Nước Nóng',
          reason: 'Máy nước nóng nằm sai danh mục',
          severity: 'HIGH'
        })
      }
    }

    // "Chân chậu" / "chân lavabo" should be in lavabo, not phu-kien
    if ((nameLower.includes('chân chậu') || nameLower.includes('chân lavabo') || nameLower.includes('chân lửng')) 
        && currentSlug !== 'lavabo' && !nameLower.includes('lavabo')) {
      if (!mismatches.find(m => m.id === product.id)) {
        mismatches.push({
          id: product.id, sku: product.sku, name: product.name,
          currentSubcat: `${product.subcategories?.name} (${currentSlug})`,
          suggestedSubcat: 'Phụ kiện Lavabo hoặc Lavabo',
          reason: 'Chân chậu có thể nằm sai danh mục',
          severity: 'LOW'
        })
      }
    }
  }

  // ====== RESULTS ======
  console.log(`\n${'='.repeat(80)}`)
  console.log(`TOTAL MISMATCHES FOUND: ${mismatches.length}`)
  console.log(`${'='.repeat(80)}`)

  // Group by severity
  const high = mismatches.filter(m => m.severity === 'HIGH')
  const medium = mismatches.filter(m => m.severity === 'MEDIUM')
  const low = mismatches.filter(m => m.severity === 'LOW')

  console.log(`\n🔴 HIGH: ${high.length} | 🟡 MEDIUM: ${medium.length} | ⚪ LOW: ${low.length}`)

  console.log(`\n${'─'.repeat(80)}`)
  console.log('🔴 HIGH SEVERITY MISMATCHES:')
  console.log(`${'─'.repeat(80)}`)
  for (const m of high) {
    console.log(`\n  [${m.id}] ${m.sku}`)
    console.log(`  Name: ${m.name.substring(0, 80)}`)
    console.log(`  Current: ${m.currentSubcat}`)
    console.log(`  Suggested: ${m.suggestedSubcat}`)
    console.log(`  Reason: ${m.reason}`)
  }

  console.log(`\n${'─'.repeat(80)}`)
  console.log('🟡 MEDIUM SEVERITY MISMATCHES:')
  console.log(`${'─'.repeat(80)}`)
  for (const m of medium) {
    console.log(`\n  [${m.id}] ${m.sku}`)
    console.log(`  Name: ${m.name.substring(0, 80)}`)
    console.log(`  Current: ${m.currentSubcat}`)
    console.log(`  Suggested: ${m.suggestedSubcat}`)
    console.log(`  Reason: ${m.reason}`)
  }

  if (low.length > 0) {
    console.log(`\n${'─'.repeat(80)}`)
    console.log('⚪ LOW SEVERITY MISMATCHES:')
    console.log(`${'─'.repeat(80)}`)
    for (const m of low) {
      console.log(`\n  [${m.id}] ${m.sku}`)
      console.log(`  Name: ${m.name.substring(0, 80)}`)
      console.log(`  Current: ${m.currentSubcat}`)
      console.log(`  Reason: ${m.reason}`)
    }
  }

  // Summary by subcategory
  console.log(`\n${'─'.repeat(80)}`)
  console.log('SUMMARY BY CURRENT SUBCATEGORY:')
  console.log(`${'─'.repeat(80)}`)
  const bySubcat: Record<string, number> = {}
  for (const m of mismatches) {
    bySubcat[m.currentSubcat] = (bySubcat[m.currentSubcat] || 0) + 1
  }
  for (const [subcat, count] of Object.entries(bySubcat).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${subcat}: ${count} mismatches`)
  }

  await prisma.$disconnect()
}

audit().catch(console.error)
