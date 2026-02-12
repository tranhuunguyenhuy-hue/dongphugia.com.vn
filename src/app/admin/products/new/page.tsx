import ProductForm from "../product-form"
import prisma from "@/lib/prisma"

export default async function NewProductPage() {
    const [categories, brands, productTypes] = await Promise.all([
        prisma.category.findMany(),
        prisma.brand.findMany(),
        prisma.productType.findMany(),
    ])

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Create Product</h1>
            </div>
            <ProductForm categories={categories} brands={brands} productTypes={productTypes} />
        </div>
    )
}
