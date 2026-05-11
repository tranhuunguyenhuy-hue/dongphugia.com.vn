import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // 1. Total products
    const totalProducts = await prisma.products.count()
    
    // 2. Total products with color mapped
    const coloredProducts = await prisma.products.count({
        where: { color_id: { not: null } }
    })
    
    // 3. Total products from TOTO
    // Let's find TOTO brand ID first
    const totoBrand = await prisma.brands.findFirst({
        where: { slug: 'toto' }
    })
    
    let totoProductsCount = 0;
    let totoColoredProductsCount = 0;
    
    if (totoBrand) {
        totoProductsCount = await prisma.products.count({
            where: { brand_id: totoBrand.id }
        })
        
        totoColoredProductsCount = await prisma.products.count({
            where: { brand_id: totoBrand.id, color_id: { not: null } }
        })
    }
    
    console.log("=== Báo cáo Tình trạng Mapping Màu Sắc ===")
    console.log(`Tổng số sản phẩm trong DB: ${totalProducts}`)
    console.log(`Số sản phẩm ĐÃ CÓ color_id: ${coloredProducts}`)
    console.log(`Số sản phẩm CHƯA CÓ color_id: ${totalProducts - coloredProducts}`)
    console.log("---")
    if (totoBrand) {
        console.log(`Thương hiệu TOTO:`)
        console.log(`- Tổng số sản phẩm TOTO: ${totoProductsCount}`)
        console.log(`- Sản phẩm TOTO đã map màu: ${totoColoredProductsCount}`)
        console.log(`- Sản phẩm TOTO chưa map màu: ${totoProductsCount - totoColoredProductsCount}`)
    }
}

main()
    .catch(e => {
        console.error("Error:", e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
