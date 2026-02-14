import prisma from "@/lib/prisma"
import { TileProductsClient } from "./tile-products-client"

export default async function TileProductsPage() {
    const tileCategory = await prisma.category.findUnique({
        where: { slug: "gach-op-lat" },
    })

    if (!tileCategory) {
        return <div>Không tìm thấy danh mục Gạch ốp lát</div>
    }

    // Get sub-categories with product & collection counts
    const subCategories = await prisma.productType.findMany({
        where: { categoryId: tileCategory.id },
        include: {
            _count: { select: { products: true, collections: true } },
        },
        orderBy: { name: "asc" },
    })

    const totalProducts = subCategories.reduce((sum, sc) => sum + sc._count.products, 0)
    const totalCollections = subCategories.reduce((sum, sc) => sum + sc._count.collections, 0)

    return (
        <TileProductsClient
            categoryId={tileCategory.id}
            subCategories={subCategories}
            totalProducts={totalProducts}
            totalCollections={totalCollections}
        />
    )
}
