/**
 * seed-gach-categories.mjs — LEO-387 Phase 0
 *
 * Creates category "Gạch Ốp Lát" + 5 subcategories in DB.
 * Idempotent: skips if already exist (upsert by slug).
 *
 * Usage:
 *   node scripts/seed/seed-gach-categories.mjs
 *   node scripts/seed/seed-gach-categories.mjs --dry-run
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(__dirname, '../../.env.local') })

const DRY_RUN = process.argv.includes('--dry-run')
const prisma = new PrismaClient()

// ─── CATEGORY CONFIG ─────────────────────────────────────────────────────────
const CATEGORY = {
  name: 'Gạch Ốp Lát',
  slug: 'gach-op-lat',
  description: 'Gạch ốp lát cao cấp nhập khẩu từ Ý, Tây Ban Nha — vân đá marble, đá tự nhiên, vân gỗ, xi măng, trang trí.',
  icon_name: 'Layers',
  sort_order: 4,
  seo_title: 'Gạch Ốp Lát Cao Cấp | Đông Phú Gia',
  seo_description: 'Gạch ốp lát nhập khẩu từ Ý, Tây Ban Nha — vân đá marble, vân gỗ, xi măng. Chất lượng cao, mẫu mã đa dạng.',
}

const SUBCATEGORIES = [
  {
    name: 'Gạch Vân Đá Marble',
    slug: 'gach-van-da-marble',
    description: 'Gạch vân đá marble nhập khẩu — tái hiện vẻ đẹp đá cẩm thạch tự nhiên.',
    sort_order: 1,
    seo_title: 'Gạch Vân Đá Marble | Đông Phú Gia',
    seo_description: 'Gạch vân đá marble cao cấp nhập khẩu, đa dạng kích thước và bề mặt.',
  },
  {
    name: 'Gạch Vân Đá Tự Nhiên',
    slug: 'gach-van-da-tu-nhien',
    description: 'Gạch vân đá tự nhiên — chất liệu bền bỉ, vẻ đẹp nguyên bản.',
    sort_order: 2,
    seo_title: 'Gạch Vân Đá Tự Nhiên | Đông Phú Gia',
    seo_description: 'Gạch vân đá tự nhiên cao cấp — đá granite, đá thạch anh, đá basalt.',
  },
  {
    name: 'Gạch Vân Gỗ',
    slug: 'gach-van-go',
    description: 'Gạch giả gỗ — kết hợp thẩm mỹ gỗ tự nhiên với độ bền gạch sứ.',
    sort_order: 3,
    seo_title: 'Gạch Vân Gỗ | Đông Phú Gia',
    seo_description: 'Gạch vân gỗ cao cấp — nét đẹp gỗ tự nhiên, độ bền vượt trội.',
  },
  {
    name: 'Gạch Thiết Kế Xi Măng',
    slug: 'gach-thiet-ke-xi-mang',
    description: 'Gạch thiết kế xi măng — phong cách công nghiệp hiện đại.',
    sort_order: 4,
    seo_title: 'Gạch Thiết Kế Xi Măng | Đông Phú Gia',
    seo_description: 'Gạch xi măng thiết kế — phong cách industrial, loft, tối giản.',
  },
  {
    name: 'Gạch Trang Trí',
    slug: 'gach-trang-tri',
    description: 'Gạch trang trí — hoa văn, mosaic, điểm nhấn không gian.',
    sort_order: 5,
    seo_title: 'Gạch Trang Trí | Đông Phú Gia',
    seo_description: 'Gạch trang trí cao cấp — hoa văn nghệ thuật, mosaic, điểm nhấn thiết kế.',
  },
]

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🧱 LEO-387 Phase 0: Seed Gạch Ốp Lát Categories`)
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN' : '🔥 LIVE'}`)
  console.log('─'.repeat(60))

  // Step 1: Upsert category
  console.log(`\n📁 Category: "${CATEGORY.name}" (slug: ${CATEGORY.slug})`)

  let category
  if (!DRY_RUN) {
    category = await prisma.categories.upsert({
      where: { slug: CATEGORY.slug },
      update: {
        name: CATEGORY.name,
        description: CATEGORY.description,
        icon_name: CATEGORY.icon_name,
        sort_order: CATEGORY.sort_order,
        seo_title: CATEGORY.seo_title,
        seo_description: CATEGORY.seo_description,
      },
      create: CATEGORY,
    })
    console.log(`   ✅ Category ID: ${category.id}`)
  } else {
    // Check if exists
    const existing = await prisma.categories.findUnique({ where: { slug: CATEGORY.slug } })
    if (existing) {
      console.log(`   ℹ️  Already exists (ID: ${existing.id}) — would update`)
      category = existing
    } else {
      console.log(`   ℹ️  Would create new category`)
      category = { id: 999 } // placeholder for dry run
    }
  }

  // Step 2: Upsert subcategories
  console.log(`\n📂 Subcategories (${SUBCATEGORIES.length}):`)

  for (const sub of SUBCATEGORIES) {
    const data = { ...sub, category_id: category.id }

    if (!DRY_RUN) {
      const result = await prisma.subcategories.upsert({
        where: {
          category_id_slug: {
            category_id: category.id,
            slug: sub.slug,
          },
        },
        update: {
          name: sub.name,
          description: sub.description,
          sort_order: sub.sort_order,
          seo_title: sub.seo_title,
          seo_description: sub.seo_description,
        },
        create: data,
      })
      console.log(`   ✅ ${sub.name} (ID: ${result.id}, slug: ${sub.slug})`)
    } else {
      console.log(`   ℹ️  Would upsert: ${sub.name} (slug: ${sub.slug})`)
    }
  }

  // Step 3: Verify
  if (!DRY_RUN) {
    const count = await prisma.subcategories.count({
      where: { category_id: category.id },
    })
    console.log(`\n✅ Verification: ${count} subcategories under "${CATEGORY.name}"`)
  }

  console.log('\n' + '─'.repeat(60))
  console.log(DRY_RUN ? '🔍 Dry run complete. No DB changes made.' : '✅ Phase 0 complete!')
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
