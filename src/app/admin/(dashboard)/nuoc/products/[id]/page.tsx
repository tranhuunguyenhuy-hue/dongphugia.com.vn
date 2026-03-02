import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { NuocProductForm } from '../nuoc-product-form'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function EditNuocProductPage({ params }: PageProps) {
    const { id } = await params
    const productId = parseInt(id)

    const [product, productTypes, brands, materials, colors, origins] = await Promise.all([
        prisma.nuoc_products.findUnique({
            where: { id: productId },
            include: {
                nuoc_product_images: { orderBy: { sort_order: 'asc' } },
            },
        }),
        prisma.nuoc_product_types.findMany({
            where: { is_active: true },
            include: {
                nuoc_subtypes: {
                    where: { is_active: true },
                    orderBy: { sort_order: 'asc' },
                },
            },
            orderBy: { sort_order: 'asc' },
        }),
        prisma.nuoc_brands.findMany({
            where: { is_active: true },
            orderBy: { sort_order: 'asc' },
        }),
        prisma.nuoc_materials.findMany({
            orderBy: { sort_order: 'asc' },
        }),
        prisma.colors.findMany({ orderBy: { name: 'asc' } }),
        prisma.origins.findMany({ orderBy: { name: 'asc' } }),
    ])

    if (!product) notFound()

    return (
        <div className="space-y-6">
            <div>
                <Link
                    href="/admin/nuoc/products"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Quay lại danh sách
                </Link>
                <h1 className="text-2xl font-bold">Sửa sản phẩm</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{product.name}</p>
            </div>

            <NuocProductForm
                product={product}
                productTypes={productTypes}
                brands={brands}
                materials={materials}
                colors={colors}
                origins={origins}
            />
        </div>
    )
}
