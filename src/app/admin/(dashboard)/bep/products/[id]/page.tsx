import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { BepProductForm } from '../bep-product-form'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function EditBepProductPage({ params }: PageProps) {
    const { id } = await params
    const productId = parseInt(id)

    const [product, productTypes, brands, colors, origins] = await Promise.all([
        prisma.bep_products.findUnique({
            where: { id: productId },
            include: {
                bep_product_images: { orderBy: { sort_order: 'asc' } },
            },
        }),
        prisma.bep_product_types.findMany({
            where: { is_active: true },
            include: {
                bep_subtypes: {
                    where: { is_active: true },
                    orderBy: { sort_order: 'asc' },
                },
            },
            orderBy: { sort_order: 'asc' },
        }),
        prisma.bep_brands.findMany({
            where: { is_active: true },
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
                    href="/admin/bep/products"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Quay lại danh sách
                </Link>
                <h1 className="text-2xl font-bold">Sửa sản phẩm</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{product.name}</p>
            </div>

            <BepProductForm
                product={product}
                productTypes={productTypes}
                brands={brands}
                colors={colors}
                origins={origins}
            />
        </div>
    )
}
