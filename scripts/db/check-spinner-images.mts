import prisma from '../../src/lib/prisma'

async function main() {
  // Check GROHE 14924SH0 specifically
  const product = await prisma.products.findFirst({
    where: { sku: '14924SH0' },
    include: { product_images: { orderBy: { sort_order: 'asc' } } }
  })
  console.log('=== Product 14924SH0 ===')
  console.log('image_main_url:', product?.image_main_url?.slice(0, 100))
  console.log('\nAll product_images:')
  product?.product_images.forEach(img => {
    console.log(`  [sort=${img.sort_order}] ${img.image_url?.slice(0, 100)}`)
  })

  // Count .gif images
  const gifCount = await prisma.$queryRaw<[{count:bigint}]>`
    SELECT COUNT(*) as count FROM product_images WHERE image_url LIKE '%.gif'
  `
  console.log('\n=== GIF images in product_images ===')
  console.log('Total:', gifCount[0].count)

  // Sample gif images
  const gifs = await prisma.$queryRaw<Array<{product_id:number, image_url:string}>>`
    SELECT product_id, image_url FROM product_images WHERE image_url LIKE '%.gif' LIMIT 5
  `
  gifs.forEach(g => console.log(' -', g.image_url?.slice(0, 100)))

  // Check main image fields with .gif
  const mainGifs = await prisma.$queryRaw<[{count:bigint}]>`
    SELECT COUNT(*) as count FROM products WHERE image_main_url LIKE '%.gif'
  `
  console.log('\n=== Products with .gif as main image ===')
  console.log('Count:', mainGifs[0].count)

  const sampleMainGifs = await prisma.$queryRaw<Array<{id:number, sku:string, image_main_url:string}>>`
    SELECT id, sku, image_main_url FROM products WHERE image_main_url LIKE '%.gif' LIMIT 5
  `
  sampleMainGifs.forEach(p => console.log(`  - [${p.sku}] ${p.image_main_url?.slice(0, 100)}`))

  await prisma.$disconnect()
}

main().catch(console.error)
