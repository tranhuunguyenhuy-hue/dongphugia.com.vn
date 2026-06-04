/**
 * audit-db-categories.mjs
 * Comprehensive analysis of database category structure.
 * Compares TOTO (crawled from Hita) vs legacy products.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  PHÂN TÍCH CẤU TRÚC DATABASE DANH MỤC - ĐÔNG PHÚ GIA')
  console.log('═══════════════════════════════════════════════════════════════')

  // 1. Category overview
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  1. TỔNG QUAN CÁC DANH MỤC (Categories)                    ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  
  const categories = await prisma.categories.findMany({
    include: { 
      subcategories: { orderBy: { sort_order: 'asc' } },
      _count: { select: { products: true } }
    },
    orderBy: { sort_order: 'asc' }
  })

  for (const cat of categories) {
    console.log(`\n🏷️  [ID:${cat.id}] ${cat.name} (slug: ${cat.slug})`)
    console.log(`   └─ Sản phẩm: ${cat._count.products} | Active: ${cat.is_active} | SEO: ${cat.seo_title ? '✅' : '❌'}`)
    
    for (const sub of cat.subcategories) {
      const prodCount = await prisma.products.count({ where: { subcategory_id: sub.id } })
      console.log(`      ├─ [ID:${sub.id}] ${sub.name} (${sub.slug}) → ${prodCount} SP | Active: ${sub.is_active}`)
    }
  }

  // 2. Brand analysis
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  2. PHÂN BỐ THƯƠNG HIỆU                                    ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  
  const brands = await prisma.brands.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: 'asc' }
  })

  for (const b of brands) {
    console.log(`  ${b.name} [ID:${b.id}] → ${b._count.products} sản phẩm | Active: ${b.is_active}`)
  }

  // 3. TOTO vs non-TOTO
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  3. SO SÁNH TOTO (Hita crawl) vs SẢN PHẨM CŨ               ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  
  const totoBrand = await prisma.brands.findFirst({ where: { slug: 'toto' } })
  if (!totoBrand) {
    console.log('  ❌ Không tìm thấy brand TOTO!')
    return
  }

  const totoProducts = await prisma.products.findMany({
    where: { brand_id: totoBrand.id },
    include: {
      categories: true,
      subcategories: true,
      origins: true,
      colors: true,
      materials: true,
      product_images: true,
    }
  })

  const nonTotoProducts = await prisma.products.findMany({
    where: { brand_id: { not: totoBrand.id } },
    include: {
      categories: true,
      subcategories: true,
      brands: true,
      origins: true,
      colors: true,
      materials: true,
      product_images: true,
    }
  })

  console.log(`\n  📊 Tổng sản phẩm TOTO: ${totoProducts.length}`)
  console.log(`  📊 Tổng sản phẩm KHÁC: ${nonTotoProducts.length}`)
  console.log(`  📊 Tổng cộng: ${totoProducts.length + nonTotoProducts.length}`)

  // 3a. Source URL analysis (Hita vs others)
  const totoFromHita = totoProducts.filter(p => p.source_url && p.source_url.includes('hita'))
  const totoWithHitaId = totoProducts.filter(p => p.hita_product_id)
  const totoNoSource = totoProducts.filter(p => !p.source_url)
  
  console.log(`\n  🔗 TOTO có source_url (Hita): ${totoFromHita.length}`)
  console.log(`  🔗 TOTO có hita_product_id: ${totoWithHitaId.length}`)
  console.log(`  🔗 TOTO không có source_url: ${totoNoSource.length}`)

  // 3b. Category distribution comparison
  console.log('\n  ────────────────────────────────────────────────────────')
  console.log('  PHÂN BỐ THEO SUBCATEGORY:')
  console.log('  ────────────────────────────────────────────────────────')
  
  const allSubcats = await prisma.subcategories.findMany({ 
    include: { categories: true },
    orderBy: [{ category_id: 'asc' }, { sort_order: 'asc' }]
  })
  
  console.log(`  ${'Danh mục'.padEnd(35)} | ${'TOTO'.padStart(6)} | ${'Khác'.padStart(6)} | ${'Tổng'.padStart(6)}`)
  console.log(`  ${'-'.repeat(35)}-|-${'-'.repeat(6)}-|-${'-'.repeat(6)}-|-${'-'.repeat(6)}`)
  
  for (const sub of allSubcats) {
    const totoCount = totoProducts.filter(p => p.subcategory_id === sub.id).length
    const otherCount = nonTotoProducts.filter(p => p.subcategory_id === sub.id).length
    if (totoCount === 0 && otherCount === 0) continue
    
    const label = `${sub.categories.name} > ${sub.name}`
    console.log(`  ${label.padEnd(35)} | ${String(totoCount).padStart(6)} | ${String(otherCount).padStart(6)} | ${String(totoCount + otherCount).padStart(6)}`)
  }

  // 4. Data quality comparison
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  4. CHẤT LƯỢNG DỮ LIỆU: TOTO vs SẢN PHẨM CŨ               ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  
  const analyzeGroup = (products, label) => {
    const total = products.length
    if (total === 0) return
    
    const withPrice = products.filter(p => p.price && Number(p.price) > 0).length
    const withOrigPrice = products.filter(p => p.original_price && Number(p.original_price) > 0).length
    const withOnlineDiscount = products.filter(p => p.online_discount_amount && Number(p.online_discount_amount) > 0).length
    const withDesc = products.filter(p => p.description && p.description.length > 10).length
    const withFeatures = products.filter(p => p.features && p.features.length > 10).length
    const withSpecs = products.filter(p => {
      try { return p.specs && Object.keys(p.specs).length > 0 }
      catch { return false }
    }).length
    const withMainImg = products.filter(p => p.image_main_url).length
    const withGallery = products.filter(p => p.product_images.length > 0).length
    const avgGallerySize = products.reduce((sum, p) => sum + p.product_images.length, 0) / total
    const withOrigin = products.filter(p => p.origin_id).length
    const withColor = products.filter(p => p.color_id).length
    const withMaterial = products.filter(p => p.material_id).length
    const withWarranty = products.filter(p => p.warranty_months).length
    const withProductType = products.filter(p => p.product_type).length
    const withProductSubType = products.filter(p => p.product_sub_type).length
    const withVariantGroup = products.filter(p => p.variant_group).length
    const isMaster = products.filter(p => p.is_master === true).length
    const isCombo = products.filter(p => p.is_combo === true).length
    const isFeatured = products.filter(p => p.is_featured === true).length
    const isPromo = products.filter(p => p.is_promotion === true).length
    const withSeoTitle = products.filter(p => p.seo_title).length
    const withSeoDesc = products.filter(p => p.seo_description).length
    const withDisplayName = products.filter(p => p.display_name).length
    const withSourceUrl = products.filter(p => p.source_url).length
    const withHitaId = products.filter(p => p.hita_product_id).length

    const pct = (n) => `${n}/${total} (${((n/total)*100).toFixed(1)}%)`

    console.log(`\n  ── ${label} (${total} sản phẩm) ──`)
    console.log(`  ${'Trường'.padEnd(28)} | Giá trị`)
    console.log(`  ${'-'.repeat(28)}-|--------`)
    console.log(`  ${'Có giá bán (price)'.padEnd(28)} | ${pct(withPrice)}`)
    console.log(`  ${'Có giá gốc (original_price)'.padEnd(28)} | ${pct(withOrigPrice)}`)
    console.log(`  ${'Có giảm online'.padEnd(28)} | ${pct(withOnlineDiscount)}`)
    console.log(`  ${'Có mô tả (description)'.padEnd(28)} | ${pct(withDesc)}`)
    console.log(`  ${'Có features'.padEnd(28)} | ${pct(withFeatures)}`)
    console.log(`  ${'Có specs (JSON)'.padEnd(28)} | ${pct(withSpecs)}`)
    console.log(`  ${'Có ảnh chính'.padEnd(28)} | ${pct(withMainImg)}`)
    console.log(`  ${'Có gallery'.padEnd(28)} | ${pct(withGallery)}`)
    console.log(`  ${'Số ảnh gallery TB'.padEnd(28)} | ${avgGallerySize.toFixed(1)}`)
    console.log(`  ${'Có xuất xứ (origin)'.padEnd(28)} | ${pct(withOrigin)}`)
    console.log(`  ${'Có màu sắc (color)'.padEnd(28)} | ${pct(withColor)}`)
    console.log(`  ${'Có chất liệu (material)'.padEnd(28)} | ${pct(withMaterial)}`)
    console.log(`  ${'Có bảo hành'.padEnd(28)} | ${pct(withWarranty)}`)
    console.log(`  ${'Có product_type'.padEnd(28)} | ${pct(withProductType)}`)
    console.log(`  ${'Có product_sub_type'.padEnd(28)} | ${pct(withProductSubType)}`)
    console.log(`  ${'Có variant_group'.padEnd(28)} | ${pct(withVariantGroup)}`)
    console.log(`  ${'is_master = true'.padEnd(28)} | ${pct(isMaster)}`)
    console.log(`  ${'is_combo'.padEnd(28)} | ${pct(isCombo)}`)
    console.log(`  ${'is_featured'.padEnd(28)} | ${pct(isFeatured)}`)
    console.log(`  ${'is_promotion'.padEnd(28)} | ${pct(isPromo)}`)
    console.log(`  ${'Có SEO title'.padEnd(28)} | ${pct(withSeoTitle)}`)
    console.log(`  ${'Có SEO description'.padEnd(28)} | ${pct(withSeoDesc)}`)
    console.log(`  ${'Có display_name'.padEnd(28)} | ${pct(withDisplayName)}`)
    console.log(`  ${'Có source_url'.padEnd(28)} | ${pct(withSourceUrl)}`)
    console.log(`  ${'Có hita_product_id'.padEnd(28)} | ${pct(withHitaId)}`)
  }

  analyzeGroup(totoProducts, 'SẢN PHẨM TOTO (Crawl từ Hita)')
  analyzeGroup(nonTotoProducts, 'SẢN PHẨM CŨ (Không phải TOTO)')

  // 5. Product type distribution for TOTO
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  5. PHÂN LOẠI PRODUCT_TYPE (TOTO)                           ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  
  const totoTypeGroups = {}
  for (const p of totoProducts) {
    const subName = p.subcategories?.name || 'N/A'
    const key = `${subName} → ${p.product_type || '(null)'}`
    totoTypeGroups[key] = (totoTypeGroups[key] || 0) + 1
  }
  
  const sortedTypes = Object.entries(totoTypeGroups).sort((a, b) => b[1] - a[1])
  for (const [type, count] of sortedTypes) {
    console.log(`  ${type}: ${count}`)
  }

  // 6. Product type distribution for non-TOTO
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  6. PHÂN LOẠI PRODUCT_TYPE (Sản phẩm cũ)                    ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  
  const otherTypeGroups = {}
  for (const p of nonTotoProducts) {
    const subName = p.subcategories?.name || 'N/A'
    const brandName = p.brands?.name || 'N/A'
    const key = `${subName} → ${p.product_type || '(null)'} [${brandName}]`
    otherTypeGroups[key] = (otherTypeGroups[key] || 0) + 1
  }
  
  const sortedOtherTypes = Object.entries(otherTypeGroups).sort((a, b) => b[1] - a[1])
  for (const [type, count] of sortedOtherTypes) {
    console.log(`  ${type}: ${count}`)
  }

  // 7. Variant analysis
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  7. PHÂN TÍCH BIẾN THỂ (Variant)                            ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  
  const totoVariantGroups = new Set(totoProducts.filter(p => p.variant_group).map(p => p.variant_group))
  const otherVariantGroups = new Set(nonTotoProducts.filter(p => p.variant_group).map(p => p.variant_group))
  
  console.log(`  TOTO: ${totoVariantGroups.size} nhóm biến thể | ${totoProducts.filter(p => p.variant_group).length} SP có variant_group`)
  console.log(`  Khác: ${otherVariantGroups.size} nhóm biến thể | ${nonTotoProducts.filter(p => p.variant_group).length} SP có variant_group`)

  // 8. Sample data
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  8. MẪU DỮ LIỆU ĐẠI DIỆN                                   ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  
  const sampleToto = totoProducts.slice(0, 3)
  const sampleOther = nonTotoProducts.slice(0, 3)
  
  console.log('\n  ── MẪU TOTO ──')
  for (const p of sampleToto) {
    console.log(`  SKU: ${p.sku}`)
    console.log(`    name: ${p.name}`)
    console.log(`    price: ${p.price} | original: ${p.original_price}`)
    console.log(`    category: ${p.categories?.name} > ${p.subcategories?.name}`)
    console.log(`    product_type: ${p.product_type} | sub_type: ${p.product_sub_type}`)
    console.log(`    variant_group: ${p.variant_group} | is_master: ${p.is_master}`)
    console.log(`    specs keys: ${Object.keys(p.specs || {}).join(', ') || '(empty)'}`)
    console.log(`    gallery: ${p.product_images.length} images`)
    console.log(`    origin: ${p.origins?.name || 'N/A'} | color: ${p.colors?.name || 'N/A'}`)
    console.log(`    source_url: ${p.source_url || 'N/A'}`)
    console.log(`    hita_product_id: ${p.hita_product_id || 'N/A'}`)
    console.log()
  }

  console.log('\n  ── MẪU SẢN PHẨM CŨ ──')
  for (const p of sampleOther) {
    console.log(`  SKU: ${p.sku}`)
    console.log(`    name: ${p.name}`)
    console.log(`    price: ${p.price} | original: ${p.original_price}`)
    console.log(`    category: ${p.categories?.name} > ${p.subcategories?.name}`)
    console.log(`    product_type: ${p.product_type} | sub_type: ${p.product_sub_type}`)
    console.log(`    variant_group: ${p.variant_group} | is_master: ${p.is_master}`)
    console.log(`    specs keys: ${Object.keys(p.specs || {}).join(', ') || '(empty)'}`)
    console.log(`    gallery: ${p.product_images.length} images`)
    console.log(`    origin: ${p.origins?.name || 'N/A'} | color: ${p.colors?.name || 'N/A'}`)
    console.log(`    source_url: ${p.source_url || 'N/A'}`)
    console.log(`    brand: ${p.brands?.name || 'N/A'}`)
    console.log()
  }

  // 9. Specs comparison
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  9. SO SÁNH SPECS JSON                                      ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  
  const collectSpecKeys = (products) => {
    const keys = {}
    for (const p of products) {
      try {
        const specKeys = Object.keys(p.specs || {})
        for (const k of specKeys) {
          keys[k] = (keys[k] || 0) + 1
        }
      } catch {}
    }
    return keys
  }

  const totoSpecKeys = collectSpecKeys(totoProducts)
  const otherSpecKeys = collectSpecKeys(nonTotoProducts)

  console.log('\n  ── Spec keys phổ biến (TOTO) ──')
  const sortedTotoSpecs = Object.entries(totoSpecKeys).sort((a, b) => b[1] - a[1])
  for (const [key, count] of sortedTotoSpecs.slice(0, 20)) {
    console.log(`    ${key}: ${count} SP`)
  }

  console.log('\n  ── Spec keys phổ biến (Sản phẩm cũ) ──')
  const sortedOtherSpecs = Object.entries(otherSpecKeys).sort((a, b) => b[1] - a[1])
  for (const [key, count] of sortedOtherSpecs.slice(0, 20)) {
    console.log(`    ${key}: ${count} SP`)
  }

  // 10. Null subcategory check
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  10. SẢN PHẨM KHÔNG CÓ SUBCATEGORY                         ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  
  const noSubcat = await prisma.products.count({ where: { subcategory_id: null } })
  console.log(`  Sản phẩm không có subcategory: ${noSubcat}`)

  // 11. Secondary subcategories
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  11. SECONDARY SUBCATEGORIES (Danh mục phụ)                 ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  
  const secondarySubs = await prisma.product_secondary_subcategories.findMany({
    include: {
      products: { select: { sku: true, name: true, brand_id: true } },
      subcategories: { select: { name: true, slug: true } }
    }
  })
  console.log(`  Tổng bản ghi secondary subcategory: ${secondarySubs.length}`)
  
  const secSubBySubcat = {}
  for (const ss of secondarySubs) {
    const key = ss.subcategories.name
    secSubBySubcat[key] = (secSubBySubcat[key] || 0) + 1
  }
  for (const [k, v] of Object.entries(secSubBySubcat).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k}: ${v}`)
  }

  // 12. Image source analysis
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  12. PHÂN TÍCH NGUỒN ẢNH                                   ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  
  const imgAnalyze = (products, label) => {
    const mainImgs = products.map(p => p.image_main_url).filter(Boolean)
    const cdnDpg = mainImgs.filter(u => u.includes('cdn.dongphugia.com.vn')).length
    const hita = mainImgs.filter(u => u.includes('hita.com.vn')).length
    const other = mainImgs.length - cdnDpg - hita
    console.log(`  ${label}:`)
    console.log(`    CDN DPG: ${cdnDpg} | Hita: ${hita} | Khác: ${other} | Không có: ${products.length - mainImgs.length}`)
  }
  imgAnalyze(totoProducts, 'TOTO')
  imgAnalyze(nonTotoProducts, 'Sản phẩm cũ')

  console.log('\n\n═══════════════════════════════════════════════════════════════')
  console.log('  PHÂN TÍCH HOÀN TẤT')
  console.log('═══════════════════════════════════════════════════════════════')
}

main().catch(console.error).finally(() => prisma.$disconnect())
