import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Hàm trích xuất Base Model từ SKU
function getBaseModel(fullSku) {
    let sku = fullSku.split('/')[0]
    sku = sku.split('#')[0]

    // Các mã nắp TOTO thường có dạng (T, E, W) + (số)
    const match = sku.match(/(.+?)(T\d+[A-Z]*|E\d+[A-Z]*|W\d+[A-Z]*)$/i)
    
    if (match) {
        return match[1]
    }
    return sku
}

async function main() {
    const totoBrand = await prisma.brands.findFirst({
        where: { slug: 'toto' }
    })

    if (!totoBrand) return

    const toilets = await prisma.products.findMany({
        where: {
            brand_id: totoBrand.id,
            subcategory_id: 1 // Bồn Cầu
        },
        select: {
            id: true,
            sku: true,
            name: true,
            variant_group: true
        }
    })

    const updates = []
    
    for (const t of toilets) {
        const base = getBaseModel(t.sku)
        
        // Cập nhật variant_group = base model
        if (t.variant_group !== base) {
            updates.push(
                prisma.products.update({
                    where: { id: t.id },
                    data: { variant_group: base }
                })
            )
        }
    }

    console.log(`Tiến hành cập nhật variant_group cho ${updates.length} bồn cầu TOTO...`)

    if (updates.length > 0) {
        const BATCH_SIZE = 100
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
            const batch = updates.slice(i, i + BATCH_SIZE)
            await prisma.$transaction(batch)
        }
        console.log(`Đã cập nhật thành công ${updates.length} sản phẩm!`)
    } else {
        console.log("Không có sản phẩm nào cần cập nhật.")
    }
}

main().finally(() => prisma.$disconnect())
