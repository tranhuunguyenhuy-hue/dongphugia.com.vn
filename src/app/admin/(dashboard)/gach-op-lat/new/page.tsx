import prisma from "@/lib/prisma"
import TileProductForm from "../tile-product-form"

export default async function NewTileProductPage() {
    const tileCategory = await prisma.category.findUnique({
        where: { slug: "gach-op-lat" },
    })

    if (!tileCategory) {
        return <div>Không tìm thấy danh mục</div>
    }

    const [subCategories, collections] = await Promise.all([
        prisma.productType.findMany({
            where: { categoryId: tileCategory.id },
            orderBy: { name: "asc" },
        }),
        prisma.collection.findMany({
            where: { productType: { categoryId: tileCategory.id } },
            orderBy: { name: "asc" },
        }),
    ])

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Thêm sản phẩm gạch</h1>
                <p className="text-muted-foreground">Tạo sản phẩm gạch ốp lát mới</p>
            </div>

            <TileProductForm
                subCategories={subCategories}
                collections={collections}
                tileCategoryId={tileCategory.id}
            />
        </div>
    )
}
