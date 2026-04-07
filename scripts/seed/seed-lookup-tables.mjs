/**
 * seed-lookup-tables.mjs
 * Seed all 6 lookup tables in correct FK order.
 * Idempotent — uses upsert by slug. Safe to re-run.
 *
 * Usage: node scripts/seed/seed-lookup-tables.mjs
 * Env: DATABASE_URL must be set (reads .env.local automatically)
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import path from 'path'

// Load .env.local from project root
config({ path: path.resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

// ─── 1a. BRANDS (~45 records) ────────────────────────────────────────────────
const BRANDS = [
  // TBVS (24)
  { name: 'TOTO', slug: 'toto', origin_country: 'Nhật Bản' },
  { name: 'INAX', slug: 'inax', origin_country: 'Nhật Bản' },
  { name: 'CAESAR', slug: 'caesar', origin_country: 'Đài Loan' },
  { name: 'American Standard', slug: 'american-standard', origin_country: 'Mỹ' },
  { name: 'LUXTA', slug: 'luxta', origin_country: 'Việt Nam' },
  { name: 'HITA', slug: 'hita', origin_country: 'Việt Nam' },
  { name: 'GROHE', slug: 'grohe', origin_country: 'Đức' },
  { name: 'COTTO', slug: 'cotto', origin_country: 'Thái Lan' },
  { name: 'JOMOO', slug: 'jomoo', origin_country: 'Trung Quốc' },
  { name: 'KANLY', slug: 'kanly', origin_country: 'Việt Nam' },
  { name: 'Viglacera', slug: 'viglacera', origin_country: 'Việt Nam' },
  { name: 'ATMOR', slug: 'atmor', origin_country: 'Israel' },
  { name: 'Tovashu', slug: 'tovashu', origin_country: 'Việt Nam' },
  { name: 'Mowoen', slug: 'mowoen', origin_country: 'Trung Quốc' },
  { name: 'Landsign', slug: 'landsign', origin_country: 'Trung Quốc' },
  { name: 'Manhattan', slug: 'manhattan', origin_country: 'Mỹ' },
  { name: 'Platinum', slug: 'platinum', origin_country: 'Việt Nam' },
  { name: 'MOEN', slug: 'moen', origin_country: 'Mỹ' },
  { name: 'Hansgrohe', slug: 'hansgrohe', origin_country: 'Đức' },
  { name: 'FOXAARON', slug: 'foxaaron', origin_country: 'Trung Quốc' },
  { name: 'Thiên Thanh', slug: 'thien-thanh', origin_country: 'Việt Nam' },
  { name: 'Esslinger', slug: 'esslinger', origin_country: 'Đức' },
  { name: 'Duravit', slug: 'duravit', origin_country: 'Đức' },
  { name: 'Merdrain', slug: 'merdrain', origin_country: 'Việt Nam' },
  // Bếp thêm mới (không trùng TBVS)
  { name: 'Kluger', slug: 'kluger', origin_country: 'Đức' },
  { name: 'Elica', slug: 'elica', origin_country: 'Ý' },
  { name: 'Ariston', slug: 'ariston', origin_country: 'Ý' },
  { name: 'Kaff', slug: 'kaff', origin_country: 'Đức' },
  { name: 'SAMSUNG', slug: 'samsung', origin_country: 'Hàn Quốc' },
  // Nước thêm mới
  { name: 'PANASONIC', slug: 'panasonic', origin_country: 'Nhật Bản' },
  { name: 'Rheem', slug: 'rheem', origin_country: 'Mỹ' },
  { name: 'Ferroli', slug: 'ferroli', origin_country: 'Ý' },
  { name: 'Karofi', slug: 'karofi', origin_country: 'Việt Nam' },
  { name: 'Mitsubishi Cleansui', slug: 'mitsubishi-cleansui', origin_country: 'Nhật Bản' },
  { name: 'NANOCO', slug: 'nanoco', origin_country: 'Việt Nam' },
  { name: 'Coway', slug: 'coway', origin_country: 'Hàn Quốc' },
  { name: 'PHILIPS', slug: 'philips', origin_country: 'Hà Lan' },
  { name: 'Unilever Pureit', slug: 'unilever-pureit', origin_country: 'Mỹ' },
  { name: 'Đại Thành', slug: 'dai-thanh', origin_country: 'Việt Nam' },
  { name: 'Toshiba', slug: 'toshiba', origin_country: 'Nhật Bản' },
  { name: 'Mitsubishi Electric', slug: 'mitsubishi-electric', origin_country: 'Nhật Bản' },
]

// ─── 1b. ORIGINS (~10 records) ───────────────────────────────────────────────
const ORIGINS = [
  { name: 'Nhật Bản', slug: 'nhat-ban' },
  { name: 'Thái Lan', slug: 'thai-lan' },
  { name: 'Việt Nam', slug: 'viet-nam' },
  { name: 'Đức', slug: 'duc' },
  { name: 'Trung Quốc', slug: 'trung-quoc' },
  { name: 'Hàn Quốc', slug: 'han-quoc' },
  { name: 'Ý', slug: 'y' },
  { name: 'Mỹ', slug: 'my' },
  { name: 'Malaysia', slug: 'malaysia' },
  { name: 'Đài Loan', slug: 'dai-loan' },
  { name: 'Hà Lan', slug: 'ha-lan' },
  { name: 'Israel', slug: 'israel' },
]

// ─── 1c. MATERIALS (~12 records) ─────────────────────────────────────────────
const MATERIALS = [
  { name: 'Sứ', slug: 'su' },
  { name: 'Sứ sành dẻo', slug: 'su-sanh-deo' },
  { name: 'Inox 304', slug: 'inox-304' },
  { name: 'Inox 201', slug: 'inox-201' },
  { name: 'Đồng', slug: 'dong' },
  { name: 'Đá granite', slug: 'da-granite' },
  { name: 'Kính cường lực', slug: 'kinh-cuong-luc' },
  { name: 'HDF', slug: 'hdf' },
  { name: 'SPC', slug: 'spc' },
  { name: 'Gỗ tự nhiên', slug: 'go-tu-nhien' },
  { name: 'Nhựa ABS', slug: 'nhua-abs' },
  { name: 'Thép không gỉ', slug: 'thep-khong-gi' },
]

// ─── 1d. COLORS (~10 records) ────────────────────────────────────────────────
const COLORS = [
  { name: 'Trắng', slug: 'trang', hex_code: '#FFFFFF' },
  { name: 'Đen', slug: 'den', hex_code: '#1A1A1A' },
  { name: 'Crom', slug: 'crom', hex_code: '#C0C0C0' },
  { name: 'Đồng vàng', slug: 'dong-vang', hex_code: '#B87333' },
  { name: 'Nâu sáng', slug: 'nau-sang', hex_code: '#D2B48C' },
  { name: 'Xám', slug: 'xam', hex_code: '#808080' },
  { name: 'Vàng', slug: 'vang', hex_code: '#FFD700' },
  { name: 'Xanh navy', slug: 'xanh-navy', hex_code: '#1F3A5F' },
  { name: 'Hồng', slug: 'hong', hex_code: '#FFC0CB' },
  { name: 'Bạc', slug: 'bac', hex_code: '#A8A9AD' },
]

// ─── CATEGORIES (must exist before subcategories) ────────────────────────────
// These are expected to already be in DB. We fetch their IDs.
const CATEGORY_SLUGS_MAP = {
  tbvs: 'thiet-bi-ve-sinh',
  bep: 'thiet-bi-bep',
  nuoc: 'vat-lieu-nuoc',
}

// ─── 1e. SUBCATEGORIES (21 records) ──────────────────────────────────────────
// category_slug → subcategories array
const SUBCATEGORIES_BY_CATEGORY = {
  [CATEGORY_SLUGS_MAP.tbvs]: [
    { name: 'Bồn Cầu', slug: 'bon-cau', sort_order: 1 },
    { name: 'Chậu Lavabo', slug: 'lavabo', sort_order: 2 },
    { name: 'Sen Tắm', slug: 'sen-tam', sort_order: 3 },
    { name: 'Bồn Tắm', slug: 'bon-tam', sort_order: 4 },
    { name: 'Phụ Kiện Phòng Tắm', slug: 'phu-kien-phong-tam', sort_order: 5 },
    { name: 'Vòi Chậu', slug: 'voi-chau', sort_order: 6 },
    { name: 'Bồn Tiểu', slug: 'bon-tieu', sort_order: 7 },
    { name: 'Vòi Nước', slug: 'voi-nuoc', sort_order: 8 },
    { name: 'Nắp Bồn Cầu', slug: 'nap-bon-cau', sort_order: 9 },
  ],
  [CATEGORY_SLUGS_MAP.bep]: [
    { name: 'Vòi Rửa Chén', slug: 'voi-rua-chen', sort_order: 1 },
    { name: 'Thiết Bị Bếp Khác', slug: 'thiet-bi-bep-khac', sort_order: 2 },
    { name: 'Chậu Rửa Chén', slug: 'chau-rua-chen', sort_order: 3 },
    { name: 'Bếp Điện Từ', slug: 'bep-dien-tu', sort_order: 4 },
    { name: 'Máy Hút Mùi', slug: 'may-hut-mui', sort_order: 5 },
    { name: 'Máy Rửa Chén', slug: 'may-rua-chen', sort_order: 6 },
    { name: 'Bếp Gas', slug: 'bep-gas', sort_order: 7 },
    { name: 'Lò Nướng', slug: 'lo-nuong', sort_order: 8 },
  ],
  [CATEGORY_SLUGS_MAP.nuoc]: [
    { name: 'Máy Nước Nóng', slug: 'may-nuoc-nong', sort_order: 1 },
    { name: 'Lọc Nước', slug: 'loc-nuoc', sort_order: 2 },
    { name: 'Bồn Chứa Nước', slug: 'bon-chua-nuoc', sort_order: 3 },
    { name: 'Máy Bơm Nước', slug: 'may-bom-nuoc', sort_order: 4 },
  ],
}

// ─── 1f. PRODUCT_FEATURES (~15 records) ──────────────────────────────────────
const PRODUCT_FEATURES = [
  { name: 'Smart Toilet', slug: 'smart', icon_name: 'Brain', sort_order: 1 },
  { name: 'Nắp Êm', slug: 'nap-em', icon_name: 'VolumeX', sort_order: 2 },
  { name: 'Xả Tự Động', slug: 'xa-tu-dong', icon_name: 'Zap', sort_order: 3 },
  { name: 'CeFiONtect', slug: 'cefiontect', icon_name: 'Shield', sort_order: 4 },
  { name: 'Thoát Sàn', slug: 'thoat-san', icon_name: 'ArrowDown', sort_order: 5 },
  { name: 'Thoát Ngang', slug: 'thoat-ngang', icon_name: 'ArrowRight', sort_order: 6 },
  { name: 'Nóng Lạnh', slug: 'nong-lanh', icon_name: 'Thermometer', sort_order: 7 },
  { name: 'Tiết Kiệm Nước', slug: 'tiet-kiem-nuoc', icon_name: 'Droplet', sort_order: 8 },
  { name: 'Massage', slug: 'massage', icon_name: 'Waves', sort_order: 9 },
  { name: 'Semi-Smart', slug: 'semi-smart', icon_name: 'Cog', sort_order: 10 },
  { name: 'Chống Khuẩn', slug: 'chong-khuan', icon_name: 'ShieldCheck', sort_order: 11 },
  { name: 'Tự Động Làm Sạch', slug: 'tu-dong-lam-sach', icon_name: 'RefreshCw', sort_order: 12 },
  { name: 'Sensor Hồng Ngoại', slug: 'sensor-hong-ngoai', icon_name: 'Wifi', sort_order: 13 },
  { name: 'RO Lọc Ngược', slug: 'ro-loc-nguoc', icon_name: 'Filter', sort_order: 14 },
  { name: 'Điều Khiển Từ Xa', slug: 'dieu-khien-tu-xa', icon_name: 'Radio', sort_order: 15 },
]

// ─── MAIN SEED FUNCTION ───────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting seed-lookup-tables.mjs...\n')

  // ─── 1a. Brands ────────────────────────────────────────────────────────────
  console.log('📦 Seeding brands...')
  for (const brand of BRANDS) {
    await prisma.brands.upsert({
      where: { slug: brand.slug },
      update: { name: brand.name, origin_country: brand.origin_country },
      create: { name: brand.name, slug: brand.slug, origin_country: brand.origin_country },
    })
  }
  const brandCount = await prisma.brands.count()
  console.log(`   ✅ brands: ${brandCount} records`)

  // ─── 1b. Origins ───────────────────────────────────────────────────────────
  console.log('🌍 Seeding origins...')
  for (const origin of ORIGINS) {
    await prisma.origins.upsert({
      where: { slug: origin.slug },
      update: { name: origin.name },
      create: { name: origin.name, slug: origin.slug },
    })
  }
  const originCount = await prisma.origins.count()
  console.log(`   ✅ origins: ${originCount} records`)

  // ─── 1c. Materials ─────────────────────────────────────────────────────────
  console.log('🧱 Seeding materials...')
  for (const mat of MATERIALS) {
    await prisma.materials.upsert({
      where: { slug: mat.slug },
      update: { name: mat.name },
      create: { name: mat.name, slug: mat.slug },
    })
  }
  const materialCount = await prisma.materials.count()
  console.log(`   ✅ materials: ${materialCount} records`)

  // ─── 1d. Colors ────────────────────────────────────────────────────────────
  console.log('🎨 Seeding colors...')
  for (const color of COLORS) {
    await prisma.colors.upsert({
      where: { slug: color.slug },
      update: { name: color.name, hex_code: color.hex_code },
      create: { name: color.name, slug: color.slug, hex_code: color.hex_code },
    })
  }
  const colorCount = await prisma.colors.count()
  console.log(`   ✅ colors: ${colorCount} records`)

  // ─── 1e. Subcategories ─────────────────────────────────────────────────────
  console.log('📂 Seeding subcategories...')
  let subcatCount = 0
  for (const [catSlug, subcats] of Object.entries(SUBCATEGORIES_BY_CATEGORY)) {
    const category = await prisma.categories.findUnique({ where: { slug: catSlug } })
    if (!category) {
      console.warn(`   ⚠️  Category not found: ${catSlug} — skipping its subcategories`)
      continue
    }
    for (const subcat of subcats) {
      await prisma.subcategories.upsert({
        where: {
          category_id_slug: {
            category_id: category.id,
            slug: subcat.slug,
          },
        },
        update: { name: subcat.name, sort_order: subcat.sort_order },
        create: {
          name: subcat.name,
          slug: subcat.slug,
          sort_order: subcat.sort_order,
          category_id: category.id,
        },
      })
      subcatCount++
    }
    console.log(`   📁 ${catSlug}: ${subcats.length} subcategories seeded`)
  }
  const totalSubcats = await prisma.subcategories.count()
  console.log(`   ✅ subcategories total: ${totalSubcats} records`)

  // ─── 1f. Product Features ──────────────────────────────────────────────────
  console.log('⚡ Seeding product_features...')
  for (const feature of PRODUCT_FEATURES) {
    await prisma.product_features.upsert({
      where: { slug: feature.slug },
      update: { name: feature.name, icon_name: feature.icon_name, sort_order: feature.sort_order },
      create: {
        name: feature.name,
        slug: feature.slug,
        icon_name: feature.icon_name,
        sort_order: feature.sort_order,
      },
    })
  }
  const featureCount = await prisma.product_features.count()
  console.log(`   ✅ product_features: ${featureCount} records`)

  // ─── FINAL VERIFICATION ────────────────────────────────────────────────────
  console.log('\n📊 SEED SUMMARY:')
  const summary = {
    brands: await prisma.brands.count(),
    origins: await prisma.origins.count(),
    materials: await prisma.materials.count(),
    colors: await prisma.colors.count(),
    subcategories: await prisma.subcategories.count(),
    product_features: await prisma.product_features.count(),
  }
  for (const [table, count] of Object.entries(summary)) {
    console.log(`   ${table.padEnd(20)}: ${count}`)
  }

  const allOk =
    summary.brands >= 40 &&
    summary.origins >= 10 &&
    summary.materials >= 12 &&
    summary.colors >= 10 &&
    summary.subcategories >= 21 &&
    summary.product_features >= 15

  if (allOk) {
    console.log('\n✅ All lookup tables seeded successfully!')
  } else {
    console.warn('\n⚠️  Some tables may have fewer records than expected. Please check above.')
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
