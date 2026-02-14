import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import TileProductForm from "../../tile-product-form"

export default async function EditTileProductPage({
    params,
}: {
    params: Promise<{ productId: string }>
}) {
    const { productId } = await params

    const tileCategory = await prisma.category.findUnique({
        where: { slug: "gach-op-lat" },
    })

    if (!tileCategory) {
        return <div>Không tìm thấy danh mục</div>
    }

    const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
            productType: true,
            collection: true,
        },
    })

    if (!product || !product.productType) {
        notFound()
    }

    return (
        <TileProductForm
            tileCategoryId={tileCategory.id}
            productTypeId={product.productType.id}
            productTypeName={product.productType.name}
            collectionId={product.collection?.id}
            collectionName={product.collection?.name}
            typeSlug={product.productType.slug}
            initialData={product}
        />
    )
}
