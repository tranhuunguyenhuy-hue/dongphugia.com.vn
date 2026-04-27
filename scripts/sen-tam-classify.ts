/**
 * Sen Tam Classification Script
 * Maps existing product_type values → new 5-type taxonomy
 * Adds sub_type for sen-am-tuong and phu-kien
 *
 * Run: npx tsx scripts/sen-tam-classify.ts [--dry-run] [--apply]
 */
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()
const isDryRun = !process.argv.includes('--apply')
const outputCsv = path.join(__dirname, 'sen-tam-classified.csv')

// ─── Taxonomy Constants ────────────────────────────────────────────────────
type ProductType = 'tay-sen' | 'sen-dung' | 'cu-sen' | 'sen-am-tuong' | 'phu-kien'
type SubType =
  // phu-kien sub_types
  | 'bat-sen' | 'tay-sen-dau' | 'gac-sen' | 'thanh-truot' | 'day-sen'
  | 'mat-dieu-khien' | 'linh-kien'
  // sen-am-tuong sub_types
  | '1-duong' | '2-duong' | '3-duong' | 'nhiet-do'
  | null

interface Classification {
  product_type: ProductType
  sub_type: SubType
}

// ─── Helper ────────────────────────────────────────────────────────────────
const n = (name: string) => name.toLowerCase()

// ─── Core Classification Logic ─────────────────────────────────────────────
function classify(
  name: string,
  currentType: string | null,
): Classification {
  const lname = n(name)

  // ── 1. TAY SEN ──────────────────────────────────────────────────────────
  // Keep existing tay-sen. Also catch some sen-tam items
  if (
    currentType === 'tay-sen' ||
    // "Bộ tay và gác sen" → tay-sen
    (lname.includes('bộ tay') && lname.includes('gác sen')) ||
    // Explicit hand shower only
    (lname.includes('tay sen') && !lname.includes('bộ sen') && !lname.includes('sen cây') && !lname.includes('thân'))
  ) {
    return { product_type: 'tay-sen', sub_type: null }
  }

  // ── 2. SEN DUNG (Freestanding column) ────────────────────────────────────
  if (
    currentType === 'sen-cay' ||
    currentType === 'sen-cay-nhiet-do' ||
    currentType === 'combo' || // GROHE combo systems
    lname.includes('thân sen') ||
    lname.includes('sen cây') ||
    lname.includes('cây sen') ||
    lname.includes('sen tắm cây') ||
    lname.includes('bộ sen cây') ||
    lname.includes('vòi sen cây') ||
    // Grohe standing thermostatic systems
    (currentType === 'sen-nhiet-do' && (
      lname.includes('bộ cây') ||
      lname.includes('cây sen')
    ))
  ) {
    return { product_type: 'sen-dung', sub_type: null }
  }

  // ── 3. SEN AM TUONG ──────────────────────────────────────────────────────
  if (currentType === 'sen-am-tuong') {
    const subType = classifySenAmTuongSubType(lname)
    return { product_type: 'sen-am-tuong', sub_type: subType }
  }

  // ── 4. PHU KIEN ──────────────────────────────────────────────────────────

  // bat-sen (rain heads - ceiling/wall mount fixed)
  // Must NOT match "Bộ sen tắm ... kèm bát sen" combos → those are cu-sen
  const isKemBatSen = lname.includes('kèm bát sen') || lname.includes('kèm vòi sen')
  if (
    !isKemBatSen && (
      currentType === 'bat-sen' ||
      lname.includes('bát sen') ||
      (lname.includes('đầu sen') && (
        lname.includes('phun mưa') ||
        lname.includes('gắn trần') ||
        (lname.includes('gắn tường') && !lname.includes('bộ sen')) ||
        lname.includes('âm tường') // đầu sen âm tường
      ))
    )
  ) {
    return { product_type: 'phu-kien', sub_type: 'bat-sen' }
  }

  // Standalone shower head (bán lẻ, không kèm vòi)
  if (
    lname.includes('đầu sen') && !lname.includes('gắn tường') && !lname.includes('phun mưa')
    && !lname.includes('bộ')
  ) {
    return { product_type: 'phu-kien', sub_type: 'tay-sen-dau' }
  }

  // gac-sen: gác, pát, cút nối, co nối, đầu nối, thanh nối
  if (
    lname.includes('gác sen') ||
    lname.includes('pát sen') ||
    lname.includes('cút nối') ||
    lname.includes('co nối') ||
    lname.includes('đầu nối') ||
    lname.includes('gá để') ||
    lname.includes('thanh nối') ||
    lname.includes('thanh treo bát sen')
  ) {
    return { product_type: 'phu-kien', sub_type: 'gac-sen' }
  }

  // thanh-truot (standalone slide bar)
  if (
    lname.includes('thanh trượt') && !lname.includes('tay sen')
  ) {
    return { product_type: 'phu-kien', sub_type: 'thanh-truot' }
  }

  // day-sen: dây sen, cần sen
  if (
    lname.includes('dây cấp') ||
    lname.includes('dây sen') ||
    lname.includes('cần sen')
  ) {
    return { product_type: 'phu-kien', sub_type: 'day-sen' }
  }

  // mat-dieu-khien: SmartControl, mặt điều khiển
  if (
    lname.includes('mặt điều khiển') ||
    lname.includes('smartcontrol') ||
    (lname.includes('bộ âm') && lname.includes('ổn nhiệt'))
  ) {
    return { product_type: 'phu-kien', sub_type: 'mat-dieu-khien' }
  }

  // linh-kien: ruột vòi, tay gạt, nút điều chỉnh, van chuyển hướng, smartbox, đai ốc, bộ âm
  if (
    lname.includes('ruột vòi') ||
    lname.includes('tay gạt') ||
    lname.includes('nút điều chỉnh') ||
    lname.includes('van chuyển hướng') ||
    lname.includes('smartbox') ||
    lname.includes('đai ốc') ||
    lname.includes('van điều chỉnh') ||
    lname.includes('phụ kiện âm tường') ||
    lname.includes('bộ âm của bát') ||
    lname.includes('khung giá đỡ') ||
    lname.includes('co nối') ||
    lname.includes('bộ trộn') && currentType !== 'sen-am-tuong'
  ) {
    return { product_type: 'phu-kien', sub_type: 'linh-kien' }
  }

  // ── 5. CU SEN (default for remaining with hot/cold valve) ─────────────
  if (
    // thermostatic exposed → cu-sen
    currentType === 'sen-nhiet-do' ||
    // explicit keywords
    lname.includes('củ sen') ||
    lname.includes('bộ vòi sen') ||
    lname.includes('bộ sen tắm') ||
    lname.includes('sen tắm gắn tường') ||
    lname.includes('sen tắm nóng lạnh') ||
    lname.includes('vòi sen tắm') ||
    lname.includes('vòi sen lạnh') ||
    lname.includes('sen tắm lạnh') ||
    lname.includes('sen ghép')
  ) {
    return { product_type: 'cu-sen', sub_type: null }
  }

  // Fallback → cu-sen (covers remaining bộ sen/vòi items)
  return { product_type: 'cu-sen', sub_type: null }
}

// ─── Sen Am Tuong Sub Type ─────────────────────────────────────────────────
function classifySenAmTuongSubType(lname: string): SubType {
  // Thermostatic concealed
  if (
    lname.includes('ổn nhiệt') ||
    lname.includes('nhiệt độ') ||
    lname.includes('grohtherm')
  ) {
    return 'nhiet-do'
  }
  // By number of outputs
  if (lname.includes('3 đường') || lname.includes('4 đường') || lname.includes('5 đường')) return '3-duong'
  if (lname.includes('2 đường')) return '2-duong'
  if (lname.includes('1 đường')) return '1-duong'
  // Default for concealed
  return '1-duong'
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(isDryRun
    ? '🔍 DRY RUN — không ghi vào DB'
    : '⚡ APPLY MODE — sẽ ghi vào DB production')
  console.log()

  // 1. Add sub_type column if not exists
  if (!isDryRun) {
    await prisma.$executeRaw`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS sub_type VARCHAR(50)
    `
    console.log('✅ Column sub_type đã sẵn sàng')
  }

  // 2. Fetch all sen-tam products
  const products = await prisma.products.findMany({
    where: { subcategory_id: 3 },
    select: {
      id: true,
      sku: true,
      name: true,
      product_type: true,
      brands: { select: { name: true } },
    },
    orderBy: { id: 'asc' },
  })

  console.log(`📦 Tổng sản phẩm sen tắm: ${products.length}`)

  // 3. Classify
  const results = products.map(p => {
    const cls = classify(p.name || '', p.product_type)
    return {
      id: p.id,
      sku: p.sku,
      brand: p.brands?.name || '',
      name: p.name || '',
      old_type: p.product_type || '',
      new_type: cls.product_type,
      sub_type: cls.sub_type || '',
      changed: p.product_type !== cls.product_type,
    }
  })

  // 4. Stats
  const byNewType: Record<string, number> = {}
  const bySubType: Record<string, number> = {}
  let changedCount = 0

  results.forEach(r => {
    byNewType[r.new_type] = (byNewType[r.new_type] || 0) + 1
    if (r.sub_type) bySubType[r.sub_type] = (bySubType[r.sub_type] || 0) + 1
    if (r.changed) changedCount++
  })

  console.log('\n📊 Phân bố product_type MỚI:')
  Object.entries(byNewType).sort((a, b) => b[1] - a[1])
    .forEach(([t, c]) => console.log(`  ${t}: ${c} SP`))

  console.log('\n📊 Phân bố sub_type:')
  Object.entries(bySubType).sort((a, b) => b[1] - a[1])
    .forEach(([t, c]) => console.log(`  ${t}: ${c} SP`))

  console.log(`\n🔄 Số SP thay đổi product_type: ${changedCount}`)

  // 5. Export CSV for review
  const header = 'id,sku,brand,old_type,new_type,sub_type,changed,name'
  const rows = results.map(r => [
    r.id, r.sku, r.brand,
    r.old_type, r.new_type, r.sub_type,
    r.changed ? 'YES' : '',
    `"${r.name.replace(/"/g, "'")}"`,
  ].join(','))
  fs.writeFileSync(outputCsv, '\uFEFF' + [header, ...rows].join('\n'))
  console.log(`\n📄 CSV review: ${outputCsv}`)

  // 6. Apply to DB via raw SQL (product_sub_type is the existing column)
  if (!isDryRun) {
    console.log('\n⚡ Đang ghi vào DB...')
    let updated = 0
    // Batch by groups for efficiency
    const grouped: Record<string, { ids: number[]; sub_type: string | null }> = {}
    for (const r of results) {
      const key = `${r.new_type}||${r.sub_type || ''}`
      if (!grouped[key]) grouped[key] = { ids: [], sub_type: r.sub_type || null }
      grouped[key].ids.push(r.id)
    }

    for (const [key, { ids, sub_type }] of Object.entries(grouped)) {
      const [new_type] = key.split('||')
      // Use executeRawUnsafe for dynamic IN clause
      const idList = ids.join(',')
      await prisma.$executeRawUnsafe(
        `UPDATE products SET product_type = $1, product_sub_type = $2 WHERE id IN (${idList})`,
        new_type,
        sub_type,
      )
      updated += ids.length
      process.stdout.write(`  ${updated}/${results.length} SP...\r`)
    }
    console.log(`\n✅ Đã update ${updated} sản phẩm`)
  }

  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
