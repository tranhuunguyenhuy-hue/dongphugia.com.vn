import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import TileProductForm from "../tile-product-form"

interface NewTileProductPageProps {
    searchParams: Promise<{ collectionId?: string; productTypeId?: string }>
}

export default async function NewTileProductPage({ searchParams }: NewTileProductPageProps) {
    const params = await searchParams

    const tileCategory = await prisma.category.findUnique({
        where: { slug: "gach-op-lat" },
    })

    if (!tileCategory) {
        return <div>Không tìm thấy danh mục</div>
    }

    // Get productType info
    let productType = null
    if (params.productTypeId) {
        productType = await prisma.productType.findUnique({
            where: { id: params.productTypeId },
        })
    }

    if (!productType) {
        notFound()
    }

    // Get collection info
    let collection = null
    if (params.collectionId) {
        collection = await prisma.collection.findUnique({
            where: { id: params.collectionId },
        })
    }

    return (
        <TileProductForm
            tileCategoryId={tileCategory.id}
            productTypeId={productType.id}
            productTypeName={productType.name}
            collectionId={collection?.id}
            collectionName={collection?.name}
            typeSlug={productType.slug}
        />
    )
}
