import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const unmapped = await prisma.products.findMany({
        where: { sku: { contains: '#' }, color_id: null },
    })

    const updates = []
    
    for (const p of unmapped) {
        let newColorId = null
        const sku = p.sku.toUpperCase()

        if (sku.includes('#MW') || sku.includes('#GW')) newColorId = 1 // Trắng
        else if (sku.includes('#BL')) newColorId = 2 // Đen
        else if (sku.includes('#MBE')) newColorId = 40 // Kem
        else if (sku.includes('#SS') || sku.includes('#SA') || sku.includes('#GR')) newColorId = 41 // Xước mờ / Bạc
        else if (sku.includes('#BFG') || sku.includes('#BGP')) newColorId = 25 // Vàng mờ
        else if (sku.includes('#BRG')) newColorId = 26 // Vàng hồng

        if (newColorId !== null) {
            updates.push({ id: p.id, color_id: newColorId })
        }
    }

    if (updates.length > 0) {
        await prisma.$transaction(
            updates.map(u => prisma.products.update({
                where: { id: u.id },
                data: { color_id: u.color_id }
            }))
        )
        console.log(`Đã map thành công ${updates.length} sản phẩm còn sót.`)
    } else {
        console.log("Không có sản phẩm nào được map.")
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
