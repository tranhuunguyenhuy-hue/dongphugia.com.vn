import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // Lấy ID của thương hiệu TOTO
    const totoBrand = await prisma.brands.findFirst({
        where: { slug: 'toto' }
    })
    
    if (!totoBrand) {
        console.log("Không tìm thấy thương hiệu TOTO.")
        return
    }

    // Lấy tất cả sản phẩm TOTO có variant_group
    const totoProducts = await prisma.products.findMany({
        where: { 
            brand_id: totoBrand.id,
            variant_group: { not: null }
        },
        select: {
            id: true,
            sku: true,
            variant_group: true
        }
    })

    // Gom nhóm theo variant_group
    const groups = {}
    for (const p of totoProducts) {
        if (!groups[p.variant_group]) {
            groups[p.variant_group] = []
        }
        groups[p.variant_group].push(p)
    }

    let groupsWithVariants = 0
    let totalProductsInVariants = 0

    // Đếm các nhóm có từ 2 sản phẩm trở lên
    for (const groupName in groups) {
        if (groups[groupName].length > 1) {
            groupsWithVariants++
            totalProductsInVariants += groups[groupName].length
        }
    }

    console.log(`Có ${groupsWithVariants} mẫu sản phẩm (mã gốc) TOTO có biến thể về màu sắc.`)
    console.log(`Tổng số lượng các sản phẩm con (các biến thể) thuộc các mẫu này là: ${totalProductsInVariants}`)

    // Log 5 mẫu đầu tiên để xem thử
    let count = 0
    console.log("\nVí dụ 5 mẫu sản phẩm có biến thể:")
    for (const groupName in groups) {
        if (groups[groupName].length > 1) {
            console.log(`- Mã gốc: ${groupName}`)
            console.log(`  Các biến thể: ${groups[groupName].map(p => p.sku).join(', ')}`)
            count++
            if (count >= 5) break
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
