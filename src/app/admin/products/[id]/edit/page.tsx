import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import ProductForm from "../../product-form"

export default async function ProductEditPage({ params }: { params: { id: string } }) {
    const id = params.id
    const product = await prisma.product.findUnique({
        where: { id },
    })

    if (!product) {
        notFound()
    }

    const categories = await prisma.category.findMany()
    const brands = await prisma.brand.findMany()
    const productTypes = await prisma.productType.findMany()

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Edit Product</h2>
            </div>
            <ProductForm
                categories={categories}
                brands={brands}
                productTypes={productTypes}
                initialData={product}
            />
        </div>
    )
}
