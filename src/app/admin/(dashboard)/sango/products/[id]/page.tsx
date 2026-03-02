import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { SangoProductForm } from '../sango-product-form'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function EditSangoProductPage({ params }: PageProps) {
    const { id } = await params
    const productId = parseInt(id)

    const [product, productTypes, colors, origins] = await Promise.all([
        prisma.sango_products.findUnique({
            where: { id: productId },
            include: {
                sango_product_images: { orderBy: { sort_order: 'asc' } },
            },
        }),
        prisma.sango_product_types.findMany({
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
                    href="/admin/sango/products"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Quay lại danh sách
                </Link>
                <h1 className="text-2xl font-bold">Sửa sản phẩm</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{product.name}</p>
            </div>

            <SangoProductForm
                product={product}
                productTypes={productTypes}
                colors={colors}
                origins={origins}
            />
        </div>
    )
}
