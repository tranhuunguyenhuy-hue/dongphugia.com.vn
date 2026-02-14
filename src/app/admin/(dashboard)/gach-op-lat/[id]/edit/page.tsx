import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import TileProductForm from "../../tile-product-form"

export default async function EditTileProductPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    const tileCategory = await prisma.category.findUnique({
        where: { slug: "gach-op-lat" },
    })

    if (!tileCategory) {
        return <div>Không tìm thấy danh mục</div>
    }

    const [product, subCategories, collections] = await Promise.all([
        prisma.product.findUnique({ where: { id } }),
        prisma.productType.findMany({
            where: { categoryId: tileCategory.id },
            orderBy: { name: "asc" },
        }),
        prisma.collection.findMany({
            where: { productType: { categoryId: tileCategory.id } },
            orderBy: { name: "asc" },
        }),
    ])

    if (!product) {
        notFound()
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Sửa sản phẩm gạch</h1>
                <p className="text-muted-foreground">{product.name}</p>
            </div>

            <TileProductForm
                subCategories={subCategories}
                collections={collections}
                tileCategoryId={tileCategory.id}
                initialData={product as any}
            />
        </div>
    )
}
