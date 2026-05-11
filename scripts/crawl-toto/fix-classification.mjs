/**
 * fix-classification.mjs — Fix misclassified TOTO products in DB
 *
 * Fixes 442 products that were assigned wrong subcategory/product_type
 * due to regex rule ordering issues in config.mjs.
 *
 * Usage:
 *   node scripts/crawl-toto/fix-classification.mjs --dry-run   # preview
 *   node scripts/crawl-toto/fix-classification.mjs              # apply
 */

import { PrismaClient } from '@prisma/client'
import { loadEnv } from './config.mjs'

loadEnv()

const DRY_RUN = process.argv.includes('--dry-run')

// ─── CLASSIFICATION FIX RULES ────────────────────────────────────────────────
// Each rule: { name, where (SQL-like filter), update (new values) }
// Order matters: more specific patterns first
const FIX_RULES = [
  // ── 1. Lavabo → must be in subcategory 2 (Chậu Lavabo) ──
  {
    name: 'Lavabo treo tường → Chậu Lavabo',
    match: (p) => /chậu lavabo.*treo tường|lavabo.*treo tường/i.test(p.name),
    correctSub: 2, fix: { subcategory_id: 2, product_type: 'lavabo-treo-tuong' },
  },
  {
    name: 'Lavabo đặt bàn → Chậu Lavabo',
    match: (p) => /lavabo.*đặt bàn/i.test(p.name),
    correctSub: 2, fix: { subcategory_id: 2, product_type: 'lavabo-dat-ban' },
  },
  {
    name: 'Lavabo dương vành → Chậu Lavabo',
    match: (p) => /lavabo.*dương vành/i.test(p.name),
    correctSub: 2, fix: { subcategory_id: 2, product_type: 'duong-vanh' },
  },
  {
    name: 'Lavabo âm bàn → Chậu Lavabo',
    match: (p) => /lavabo.*âm bàn/i.test(p.name),
    correctSub: 2, fix: { subcategory_id: 2, product_type: 'lavabo-am-ban' },
  },
  {
    name: 'Lavabo bán âm → Chậu Lavabo',
    match: (p) => /lavabo.*bán âm/i.test(p.name),
    correctSub: 2, fix: { subcategory_id: 2, product_type: 'lavabo-ban-am' },
  },
  {
    name: 'Chậu lavabo / Lavabo generic → Chậu Lavabo',
    match: (p) => /chậu lavabo|^lavabo\s/i.test(p.name),
    correctSub: 2, fix: { subcategory_id: 2, product_type: 'lavabo-treo-tuong' },
  },
  {
    name: 'Bộ xả lavabo → Chậu Lavabo',
    match: (p) => /bộ xả.*lavabo/i.test(p.name),
    correctSub: 2, fix: { subcategory_id: 2, product_type: 'lavabo' },
  },
  {
    name: 'Vòi chậu lavabo misplaced → Vòi Chậu',
    match: (p) => /vòi chậu.*lavabo|vòi lavabo/i.test(p.name) && p.subcategory_id !== 6,
    correctSub: 6, fix: { subcategory_id: 6, product_type: 'voi-nong-lanh' },
  },

  // ── 2. Nắp bồn cầu → must be in subcategory 9 ──
  {
    name: 'Nắp BC thông minh/Washlet (standalone) → Nắp Bồn Cầu',
    match: (p) => /^nắp bồn cầu.*thông minh|^nắp bồn cầu.*washlet/i.test(p.name),
    correctSub: 9, fix: { subcategory_id: 9, product_type: 'nap-dien-tu' },
  },
  {
    name: 'Washlet C/S series (standalone) → Nắp Bồn Cầu',
    match: (p) => /washlet\s*(C|S)\d/i.test(p.name) && !/bồn cầu/i.test(p.name),
    correctSub: 9, fix: { subcategory_id: 9, product_type: 'nap-dien-tu' },
  },
  {
    name: 'Nắp bồn cầu đóng êm (standalone) → Nắp Bồn Cầu',
    match: (p) => /^nắp bồn cầu|^nắp đóng êm|^nắp đậy bồn/i.test(p.name),
    correctSub: 9, fix: { subcategory_id: 9, product_type: 'nap-thuong-dong-em' },
  },
  {
    name: 'Cục hơi nắp BC → Phụ Kiện Bồn Cầu',
    match: (p) => /cục hơi.*nắp|cục hơi.*bồn cầu|cục hơi đế nắp/i.test(p.name),
    correctSub: 32, fix: { subcategory_id: 32, product_type: 'phu-kien-bon-cau' },
  },

  // ── 3. Bồn tắm → must be in subcategory 4 ──
  {
    name: 'Bồn tắm massage → Bồn Tắm',
    match: (p) => /bồn tắm.*massage|bồn tắm.*sục/i.test(p.name),
    correctSub: 4, fix: { subcategory_id: 4, product_type: 'bon-tam-massage' },
  },
  {
    name: 'Bồn tắm generic → Bồn Tắm',
    match: (p) => /bồn tắm/i.test(p.name),
    correctSub: 4, fix: { subcategory_id: 4, product_type: 'bon-tam' },
  },

  // ── 4. Sen tắm corrections ──
  {
    name: 'Bộ vòi sen tắm → Sen Tắm',
    match: (p) => /bộ vòi sen tắm|bộ vòi sen/i.test(p.name),
    correctSub: 3, fix: { subcategory_id: 3, product_type: 'bo-sen-tam' },
  },

  // ── 5. Phụ kiện corrections ──
  {
    name: 'Vít nối két nước → PK Bồn Cầu',
    match: (p) => /vít nối.*két nước/i.test(p.name),
    correctSub: 32, fix: { subcategory_id: 32, product_type: 'phu-kien-bon-cau' },
  },

  // ── 6. Bồn cầu combo → sửa product_type (giữ subcategory) ──
  {
    name: 'Bồn cầu + nắp điện tử → bon-cau-thong-minh',
    match: (p) => /bồn cầu.*nắp điện tử|bồn cầu.*washlet/i.test(p.name),
    correctSub: 1, fix: { subcategory_id: 1, product_type: 'bon-cau-thong-minh' },
  },
]

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔧 TOTO Classification Fix — Phase 4.1')
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`   Time: ${new Date().toISOString()}\n`)

  const prisma = new PrismaClient()

  try {
    // Get TOTO brand_id
    const brand = await prisma.brands.findFirst({ where: { slug: 'toto' }, select: { id: true } })
    if (!brand) { console.error('❌ TOTO brand not found'); process.exit(1) }

    // Load all TOTO products
    const products = await prisma.products.findMany({
      where: { brand_id: brand.id },
      select: { id: true, name: true, subcategory_id: true, product_type: true },
    })

    console.log(`📂 Loaded ${products.length} TOTO products\n`)

    const stats = { total_fixed: 0, by_rule: {} }
    const fixed = new Set()

    for (const rule of FIX_RULES) {
      let ruleCount = 0

      for (const p of products) {
        if (fixed.has(p.id)) continue  // already fixed by a more specific rule
        if (!rule.match(p)) continue

        // Only fix if product is NOT already in the correct subcategory
        if (p.subcategory_id === rule.correctSub &&
            p.product_type === rule.fix.product_type) continue

        if (!DRY_RUN) {
          await prisma.products.update({
            where: { id: p.id },
            data: rule.fix,
          })
        }

        fixed.add(p.id)
        ruleCount++
        stats.total_fixed++
      }

      if (ruleCount > 0) {
        stats.by_rule[rule.name] = ruleCount
        console.log(`  ✅ ${rule.name}: ${ruleCount} SP`)
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 FIX SUMMARY')
    console.log('='.repeat(60))
    console.log(`  Total fixed:      ${stats.total_fixed}`)
    console.log(`  Mode:             ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE ✅'}`)
    console.log('='.repeat(60))

    // Post-fix verification
    if (!DRY_RUN) {
      console.log('\n🔍 Post-fix verification...')
      const remaining = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count FROM products p
        JOIN subcategories s ON p.subcategory_id = s.id
        WHERE p.brand_id = ${brand.id}
        AND (
          (p.name ILIKE '%chậu lavabo%' AND s.slug != 'chau-lavabo')
          OR (p.name ILIKE '%nắp bồn cầu%thông minh%' AND s.slug != 'nap-bon-cau')
          OR (p.name ILIKE '%washlet%' AND s.slug NOT IN ('nap-bon-cau', 'bon-cau'))
          OR (p.name ILIKE '%bồn tắm%' AND s.slug NOT IN ('bon-tam'))
        )
      `
      console.log(`  Remaining misclassifications: ${remaining[0].count}`)
    }

    console.log('\n✅ Classification fix complete!')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => {
  console.error('❌ Fatal:', e.message)
  process.exit(1)
})
