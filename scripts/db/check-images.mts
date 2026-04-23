import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
const prisma = new PrismaClient()

async function main() {
  const images = await prisma.products.findMany({
    where: { image_main_url: { not: null } },
    select: { image_main_url: true },
    take: 500
  })
  const domains: Record<string, number> = {}
  images.forEach(p => {
    try {
      const url = new URL(p.image_main_url!)
      const host = url.hostname
      domains[host] = (domains[host] || 0) + 1
    } catch {}
  })
  console.log('=== Image Domains Distribution ===')
  Object.entries(domains).sort((a,b) => b[1] - a[1]).forEach(([d, c]) => console.log(`  ${d}: ${c}`))
  
  const total = await prisma.products.count({ where: { image_main_url: { not: null } } })
  const noImage = await prisma.products.count({ where: { image_main_url: null } })
  console.log(`\nTotal with image: ${total}`)
  console.log(`Total without image: ${noImage}`)
  
  const gallery = await prisma.product_images.count()
  console.log(`Gallery images (product_images table): ${gallery}`)
}
main().finally(() => prisma.$disconnect())
