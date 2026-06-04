/**
 * Category Migration Script - Phase 1: Safe Data Updates
 * 
 * PM Decisions summary:
 * A. Multi-subcategory: Combo bồn cầu+lavabo (VI44/77/28) → cần junction table
 * B. Sen gắn bồn (1171, 1174) → GIỮ NGUYÊN ở Bồn Tắm
 * C. 18 Lavabo trong PKPT → chuyển sang Lavabo (sort_order cao để không lên top)
 * D. 37 Két nước trong PKPT → chuyển sang Phụ Kiện Bồn Cầu (phu-kien-bon-cau)
 * E. 2 Combo sen vòi Grohe trong PKPT → chuyển sang Sen Tắm (product_type='combo')
 * F. 182 Vòi chậu trong Lavabo → chuyển sang Vòi Chậu
 * G. 27 Vòi bếp trong TBBK → chuyển sang Vòi Rửa Chén
 * H. 2 Đế Washlet trong PK Bồn Cầu → chuyển sang Nắp Bồn Cầu
 * 
 * NOTE: Multi-subcat yêu cầu schema migration riêng (xem migration file)
 * Script này chỉ làm các single-subcat fixes
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function dryRun(description: string, fn: () => Promise<number>): Promise<number> {
  const count = await fn()
  console.log(`  ✓ ${description}: ${count} sản phẩm`)
  return count
}

async function migrate() {
  console.log('=== CATEGORY MIGRATION DRY RUN ===')
  console.log('(Chạy với DRY_RUN=true để xem trước, bỏ biến để thực thi)\n')

  const IS_DRY_RUN = process.env.DRY_RUN !== 'false'
  if (IS_DRY_RUN) {
    console.log('⚠️  DRY RUN MODE — Không thay đổi gì cả\n')
  } else {
    console.log('🔴 EXECUTE MODE — Sẽ thay đổi database!\n')
  }

  // Lấy subcategory IDs
  const subcatIds = await prisma.subcategories.findMany({
    select: { id: true, slug: true, category_id: true }
  })
  const getSubcat = (slug: string) => subcatIds.find(s => s.slug === slug)

  const lavabo       = getSubcat('lavabo')!
  const voiChau      = getSubcat('voi-chau')!
  const voiRuaChen   = getSubcat('voi-rua-chen')!
  const napBonCau    = getSubcat('nap-bon-cau')!
  const pkBonCau     = getSubcat('phu-kien-bon-cau')!
  const senTam       = getSubcat('sen-tam')!
  const pkPhongTam   = getSubcat('phu-kien-phong-tam')!

  console.log('Subcategory IDs:')
  console.log(`  lavabo=${lavabo.id} cat=${lavabo.category_id}`)
  console.log(`  voi-chau=${voiChau.id} cat=${voiChau.category_id}`)
  console.log(`  voi-rua-chen=${voiRuaChen.id} cat=${voiRuaChen.category_id}`)
  console.log(`  nap-bon-cau=${napBonCau.id} cat=${napBonCau.category_id}`)
  console.log(`  phu-kien-bon-cau=${pkBonCau.id} cat=${pkBonCau.category_id}`)
  console.log(`  sen-tam=${senTam.id} cat=${senTam.category_id}`)
  console.log()

  // ─────────────────────────────────────────────────
  // FIX C: 18 Lavabo Viglacera trong PKPT → Lavabo
  // sort_order cao (999) để không hiển thị trên cùng
  // ─────────────────────────────────────────────────
  console.log('📦 FIX C: Lavabo Viglacera (PKPT → Lavabo)')
  const fixC_ids = [1745, 1746, 1747, 1748, 1749, 1750, 1751, 1752, 1753, 1754, 1755, 1756, 1757, 1758, 1759, 1760, 1761, 1762]
  const fixC_count = await prisma.products.count({ where: { id: { in: fixC_ids }, subcategory_id: pkPhongTam.id } })
  console.log(`  Cần chuyển: ${fixC_count} SP (expected 18)`)
  if (!IS_DRY_RUN) {
    const result = await prisma.products.updateMany({
      where: { id: { in: fixC_ids } },
      data: {
        subcategory_id: lavabo.id,
        category_id: lavabo.category_id,
        sort_order: 999, // Không hiển thị trên cùng như PM yêu cầu
        updated_at: new Date()
      }
    })
    console.log(`  ✅ Đã chuyển ${result.count} SP sang Lavabo (sort_order=999)`)
  }

  // ─────────────────────────────────────────────────
  // FIX D: 37 Két nước trong PKPT → Phụ Kiện Bồn Cầu
  // ─────────────────────────────────────────────────
  console.log('\n📦 FIX D: Két nước/Nắp đậy (PKPT → Phụ Kiện Bồn Cầu)')
  const ketNuocIds = [
    4651, 4642, 4648, 4650, 4743, 4745, 4746, 4747, 4748, 4769, 4649, 4744,
    4563, 4564, 4566, 4567, 4568, 4569, 4570, 4571, 4572, 4573, 4574,
    4643, 4644, 4645, 4646, 4647, 4795, 4787, 4788, 4789, 4790, 4791, 4792, 4793, 4794
  ]
  const fixD_count = await prisma.products.count({ where: { id: { in: ketNuocIds } } })
  console.log(`  Cần chuyển: ${fixD_count} SP (expected 37)`)
  if (!IS_DRY_RUN) {
    // Assign product_type for grouping
    // Types: 'ket-nuoc-am-tuong', 'ket-nuoc', 'nap-ket-nuoc'
    await prisma.products.updateMany({
      where: {
        id: { in: ketNuocIds },
        OR: [
          { name: { contains: 'âm tường', mode: 'insensitive' } },
          { name: { contains: 'am tuong', mode: 'insensitive' } },
          { name: { contains: 'Rapid SL', mode: 'insensitive' } },
        ]
      },
      data: { subcategory_id: pkBonCau.id, category_id: pkBonCau.category_id, product_type: 'ket-nuoc-am-tuong', updated_at: new Date() }
    })
    await prisma.products.updateMany({
      where: {
        id: { in: ketNuocIds },
        name: { contains: 'Nắp két', mode: 'insensitive' }
      },
      data: { subcategory_id: pkBonCau.id, category_id: pkBonCau.category_id, product_type: 'nap-ket-nuoc', updated_at: new Date() }
    })
    // Remaining: regular két nước
    await prisma.products.updateMany({
      where: { id: { in: ketNuocIds }, subcategory_id: pkPhongTam.id },
      data: { subcategory_id: pkBonCau.id, category_id: pkBonCau.category_id, product_type: 'ket-nuoc', updated_at: new Date() }
    })
    console.log(`  ✅ Đã chuyển két nước sang Phụ Kiện Bồn Cầu`)
  }

  // ─────────────────────────────────────────────────
  // FIX E: 2 Combo sen vòi Grohe trong PKPT → Sen Tắm
  // product_type = 'combo'
  // ─────────────────────────────────────────────────
  console.log('\n📦 FIX E: Combo sen vòi Grohe (PKPT → Sen Tắm)')
  const senVoiIds = [1289, 1290]
  const fixE_count = await prisma.products.count({ where: { id: { in: senVoiIds } } })
  console.log(`  Cần chuyển: ${fixE_count} SP (expected 2)`)
  if (!IS_DRY_RUN) {
    const result = await prisma.products.updateMany({
      where: { id: { in: senVoiIds } },
      data: {
        subcategory_id: senTam.id,
        category_id: senTam.category_id,
        product_type: 'combo',
        updated_at: new Date()
      }
    })
    console.log(`  ✅ Đã chuyển ${result.count} SP sang Sen Tắm (product_type=combo)`)
  }

  // ─────────────────────────────────────────────────
  // FIX F: 182 Vòi chậu trong Lavabo → Vòi Chậu
  // ─────────────────────────────────────────────────
  console.log('\n📦 FIX F: Vòi chậu (Lavabo → Vòi Chậu)')
  const fixF_count = await prisma.products.count({
    where: {
      is_active: true,
      subcategory_id: lavabo.id,
      OR: [
        { name: { startsWith: 'Vòi chậu', mode: 'insensitive' } },
        { name: { startsWith: 'Vòi lavabo', mode: 'insensitive' } },
        { name: { startsWith: 'Vòi chậu lavabo', mode: 'insensitive' } },
      ]
    }
  })
  console.log(`  Cần chuyển: ${fixF_count} SP (expected ~182)`)
  if (!IS_DRY_RUN) {
    const result = await prisma.products.updateMany({
      where: {
        subcategory_id: lavabo.id,
        OR: [
          { name: { startsWith: 'Vòi chậu', mode: 'insensitive' } },
          { name: { startsWith: 'Vòi lavabo', mode: 'insensitive' } },
        ]
      },
      data: {
        subcategory_id: voiChau.id,
        category_id: voiChau.category_id,
        updated_at: new Date()
      }
    })
    console.log(`  ✅ Đã chuyển ${result.count} SP sang Vòi Chậu`)
  }

  // ─────────────────────────────────────────────────
  // FIX G: 27 Vòi bếp trong TBBK → Vòi Rửa Chén
  // ─────────────────────────────────────────────────
  console.log('\n📦 FIX G: Vòi bếp (Thiết Bị Bếp Khác → Vòi Rửa Chén)')
  const tbbkSubcat = getSubcat('thiet-bi-bep-khac')
  if (!tbbkSubcat) {
    console.log('  ⚠️  Không tìm thấy subcat thiet-bi-bep-khac')
  } else {
    const fixG_count = await prisma.products.count({
      where: {
        subcategory_id: tbbkSubcat.id,
        is_active: true,
        OR: [
          { name: { startsWith: 'Vòi rửa chén', mode: 'insensitive' } },
          { name: { startsWith: 'Vòi bếp', mode: 'insensitive' } },
          { name: { startsWith: 'Vòi rửa bát', mode: 'insensitive' } },
        ]
      }
    })
    console.log(`  Cần chuyển: ${fixG_count} SP (expected ~27)`)
    if (!IS_DRY_RUN) {
      const result = await prisma.products.updateMany({
        where: {
          subcategory_id: tbbkSubcat.id,
          OR: [
            { name: { startsWith: 'Vòi rửa chén', mode: 'insensitive' } },
            { name: { startsWith: 'Vòi bếp', mode: 'insensitive' } },
            { name: { startsWith: 'Vòi rửa bát', mode: 'insensitive' } },
          ]
        },
        data: {
          subcategory_id: voiRuaChen.id,
          category_id: voiRuaChen.category_id,
          updated_at: new Date()
        }
      })
      console.log(`  ✅ Đã chuyển ${result.count} SP sang Vòi Rửa Chén`)
    }
  }

  // ─────────────────────────────────────────────────
  // FIX H: 2 Đế Washlet trong PK Bồn Cầu → Nắp Bồn Cầu
  // ─────────────────────────────────────────────────
  console.log('\n📦 FIX H: Đế Washlet (Phụ Kiện BC → Nắp Bồn Cầu)')
  const washletIds = [3838, 4585]
  const fixH_count = await prisma.products.count({ where: { id: { in: washletIds } } })
  console.log(`  Cần chuyển: ${fixH_count} SP (expected 2)`)
  if (!IS_DRY_RUN) {
    const result = await prisma.products.updateMany({
      where: { id: { in: washletIds } },
      data: {
        subcategory_id: napBonCau.id,
        category_id: napBonCau.category_id,
        updated_at: new Date()
      }
    })
    console.log(`  ✅ Đã chuyển ${result.count} SP sang Nắp Bồn Cầu`)
  }

  // ─────────────────────────────────────────────────
  // SKIP B: Sen gắn bồn (1171, 1174) → GIỮ NGUYÊN
  // ─────────────────────────────────────────────────
  console.log('\n📦 SKIP B: Sen gắn bồn — GIỮ NGUYÊN ở Bồn Tắm (theo yêu cầu PM)')

  // ─────────────────────────────────────────────────
  // PENDING A: Combo bồn cầu + lavabo (VI44/77/28)
  // Cần schema migration trước: thêm bảng product_subcategories
  // ─────────────────────────────────────────────────
  console.log('\n⏳ PENDING A: Combo bồn cầu+lavabo (VI44/77/28) — Cần migration schema trước')

  // ─────────────────────────────────────────────────
  // VERIFICATION
  // ─────────────────────────────────────────────────
  if (!IS_DRY_RUN) {
    console.log('\n=== POST-MIGRATION VERIFICATION ===')
    const voiChauCount = await prisma.products.count({ where: { subcategory_id: voiChau.id, is_active: true } })
    const lavaboCount  = await prisma.products.count({ where: { subcategory_id: lavabo.id, is_active: true } })
    const pkBCCount    = await prisma.products.count({ where: { subcategory_id: pkBonCau.id, is_active: true } })
    const senTamCount  = await prisma.products.count({ where: { subcategory_id: senTam.id, is_active: true } })
    const napBCCount   = await prisma.products.count({ where: { subcategory_id: napBonCau.id, is_active: true } })
    console.log(`  Vòi Chậu: ${voiChauCount} SP (was 180, expected ~362)`)
    console.log(`  Lavabo: ${lavaboCount} SP (was 684, expected ~520 after vòi removal + lavabo addition)`)
    console.log(`  Phụ Kiện Bồn Cầu: ${pkBCCount} SP (was 231, expected ~268)`)
    console.log(`  Sen Tắm: ${senTamCount} SP (was 997, expected ~999)`)
    console.log(`  Nắp Bồn Cầu: ${napBCCount} SP (was 146, expected ~148)`)
  }

  console.log('\n=== DONE ===')
  if (IS_DRY_RUN) {
    console.log('Để thực thi: DRY_RUN=false npx tsx scripts/scratch/run-migration.mts')
  }

  await prisma.$disconnect()
}

migrate().catch(console.error)
