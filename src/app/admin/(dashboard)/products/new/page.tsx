import ProductForm from "../product-form"
import prisma from "@/lib/prisma"

export default async function NewProductPage() {
    const [categories, brands, productTypes, collections] = await Promise.all([
        prisma.category.findMany(),
        prisma.brand.findMany(),
        prisma.productType.findMany(),
        prisma.collection.findMany(),
    ])

    // Find tile category ID for conditional specs display
    const tileCategory = categories.find(c => c.slug === 'gach-op-lat')

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Thêm sản phẩm</h1>
            </div>
            <ProductForm
                categories={categories}
                brands={brands}
                productTypes={productTypes}
                collections={collections}
                tileCategoryId={tileCategory?.id}
            />
        </div>
    )
}
