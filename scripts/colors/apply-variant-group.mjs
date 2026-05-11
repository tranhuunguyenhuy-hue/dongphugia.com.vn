import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Starting TOTO color variant grouping...")

    // 1. Fetch all products that have a color_id
    const coloredProducts = await prisma.products.findMany({
        where: {
            color_id: { not: null }
        },
        select: {
            id: true,
            sku: true,
            name: true,
            variant_group: true
        }
    })

    console.log(`Found ${coloredProducts.length} products with a color assigned.`)

    let updatedCount = 0;
    const updates = []

    for (const product of coloredProducts) {
        // TOTO SKUs often have '#COLOR' suffixes. e.g. 'CS769DRT8#NW1'
        // If a SKU has a '#', the base SKU is everything before the '#'
        let baseSku = null;

        if (product.sku.includes('#')) {
            baseSku = product.sku.split('#')[0].trim()
        } else if (product.sku.includes('-')) {
             // Sometimes color suffixes are after a hyphen, e.g. 'TLG01301V-MBL'
             // but hyphens are also used normally, so we have to be careful.
             // Usually TOTO color suffixes are NW1, MBL, etc. Let's just rely on '#' for now,
             // or specific known color codes.
             const parts = product.sku.split('-');
             const lastPart = parts[parts.length - 1];
             const knownColorCodes = ['NW1', 'MBL', 'PN', 'PB', 'VR', 'CP', 'BN', 'B'];
             if (knownColorCodes.includes(lastPart)) {
                 baseSku = parts.slice(0, -1).join('-').trim();
             }
        }

        if (baseSku) {
            // Set variant_group to the baseSku if not already set or different
            if (product.variant_group !== baseSku) {
                updates.push({
                    id: product.id,
                    variant_group: baseSku
                })
            }
        }
    }

    console.log(`Found ${updates.length} products to update with a variant_group.`)

    if (updates.length > 0) {
        // Batch update
        await prisma.$transaction(
            updates.map(u => 
                prisma.products.update({
                    where: { id: u.id },
                    data: { variant_group: u.variant_group }
                })
            )
        )
        updatedCount = updates.length;
    }

    console.log(`Successfully updated ${updatedCount} products with their variant_group.`)
}

main()
    .catch(e => {
        console.error("Error during variant grouping:", e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
