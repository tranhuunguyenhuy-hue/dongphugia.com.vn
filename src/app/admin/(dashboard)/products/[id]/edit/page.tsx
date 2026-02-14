import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import ProductForm from "../../product-form"

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const [product, categories, brands, productTypes, collections] = await Promise.all([
        prisma.product.findUnique({ where: { id } }),
        prisma.category.findMany(),
        prisma.brand.findMany(),
        prisma.productType.findMany(),
        prisma.collection.findMany(),
    ])

    if (!product) {
        notFound()
    }

    const tileCategory = categories.find(c => c.slug === 'gach-op-lat')

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Sửa sản phẩm</h1>
            </div>
            <ProductForm
                categories={categories}
                brands={brands}
                productTypes={productTypes}
                collections={collections}
                initialData={product}
                tileCategoryId={tileCategory?.id}
            />
        </div>
    )
}
