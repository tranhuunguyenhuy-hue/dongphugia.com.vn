/**
 * verify-gach-import.mjs - Kiểm tra data quality sau khi import Gạch LEO-387
 */
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(__dirname, '../../.env.local') })

const prisma = new PrismaClient()

async function main() {
  const cat = await prisma.categories.findUnique({ where: { slug: 'gach-op-lat' } })
  if (!cat) { console.log('❌ Category gach-op-lat NOT FOUND'); process.exit(1) }
  console.log('✅ Category:', cat.name, '(ID:', cat.id + ')\n')

  const subcats = await prisma.subcategories.findMany({
    where: { category_id: cat.id },
    include: { _count: { select: { products: true } } },
    orderBy: { sort_order: 'asc' }
  })
  console.log('📂 Subcategories:')
  subcats.forEach(s => console.log(`  - ${s.name}: ${s._count.products} SP`))

  const total = await prisma.products.count({ where: { category_id: cat.id } })
  const withImg = await prisma.products.count({ where: { category_id: cat.id, image_main_url: { not: null } } })
  const withDesc = await prisma.products.count({ where: { category_id: cat.id, description: { not: null } } })

  const brands = await prisma.brands.findMany({
    where: { products: { some: { category_id: cat.id } } }
  })

  const imgRecords = await prisma.product_images.count({
    where: { products: { category_id: cat.id } }
  })

  console.log('\n📊 Data Quality Report:')
  console.log(`  Total products:    ${total}`)
  console.log(`  With image_main:   ${withImg} (${Math.round(withImg/total*100)}%)`)
  console.log(`  With description:  ${withDesc} (${Math.round(withDesc/total*100)}%)`)
  console.log(`  product_images:    ${imgRecords}`)
  console.log(`  Brands created:    ${brands.length}`)
  console.log(`  Brands: ${brands.map(b => b.name).join(', ')}`)

  const sample = await prisma.products.findFirst({
    where: { category_id: cat.id },
    include: { product_images: true, brands: true, subcategories: true }
  })
  if (sample) {
    console.log('\n🔍 Sample product:')
    console.log(`  SKU:          ${sample.sku}`)
    console.log(`  Name:         ${sample.name}`)
    console.log(`  Brand:        ${sample.brands?.name || 'N/A'}`)
    console.log(`  Subcategory:  ${sample.subcategories?.name || 'N/A'}`)
    console.log(`  Price display:${sample.price_display}`)
    console.log(`  Images count: ${sample.product_images.length}`)
    console.log(`  Image URL:    ${sample.image_main_url?.substring(0, 90)}`)
    console.log(`  Specs keys:   ${Object.keys(sample.specs || {}).join(', ')}`)
  }

  console.log('\n✅ Verification Complete!')
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
