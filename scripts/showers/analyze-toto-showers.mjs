import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
    console.log('Tìm kiếm các danh mục liên quan đến Sen tắm...')
    
    // Tìm brand TOTO
    const brand = await prisma.brands.findFirst({
        where: { name: { contains: 'TOTO' } }
    })
    
    if (!brand) return;

    // Tìm các danh mục liên quan đến Sen tắm
    const subcats = await prisma.subcategories.findMany({
        where: {
            name: { contains: 'sen', mode: 'insensitive' }
        }
    })

    console.log('Các danh mục tìm thấy:')
    subcats.forEach(s => console.log(`- ID: ${s.id} | Name: ${s.name}`))

    const subcatIds = subcats.map(s => s.id)

    // Lấy tất cả sản phẩm thuộc các danh mục này
    const products = await prisma.products.findMany({
        where: {
            brand_id: brand.id,
            subcategory_id: { in: subcatIds }
        },
        select: {
            id: true,
            sku: true,
            name: true,
            variant_group: true,
            subcategories: { select: { name: true } }
        }
    })

    console.log(`\nTổng số sản phẩm Sen Tắm TOTO: ${products.length}`)

    // Lưu vào JSON để phân tích sâu hơn
    const dirPath = path.join(process.cwd(), 'scripts', 'showers')
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
    }
    
    const logPath = path.join(dirPath, 'toto-showers-log.json')
    fs.writeFileSync(logPath, JSON.stringify(products, null, 2))
    console.log(`\nĐã lưu JSON dump tại: ${logPath}`)

    // In thử 30 mẫu để xem cấu trúc
    console.log("\n--- Sample 30 sản phẩm Sen tắm ---")
    const sample = products.slice(0, 30).map(t => ({
        sku: t.sku, 
        name: t.name.substring(0, 60), 
        cat: t.subcategories?.name
    }))
    console.table(sample)
}

main().finally(() => prisma.$disconnect())
