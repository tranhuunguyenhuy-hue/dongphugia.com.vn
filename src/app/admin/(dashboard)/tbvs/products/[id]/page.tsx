import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { TBVSProductForm } from '../tbvs-product-form'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function EditTBVSProductPage({ params }: PageProps) {
    const { id } = await params
    const productId = parseInt(id)

    const [product, productTypes, brands, materials, colors, origins, technologies] = await Promise.all([
        prisma.tbvs_products.findUnique({
            where: { id: productId },
            include: {
                tbvs_product_images: { orderBy: { sort_order: 'asc' } },
                tbvs_product_technologies: true,
            },
        }),
        prisma.tbvs_product_types.findMany({
            where: { is_active: true },
            include: {
                tbvs_subtypes: {
                    where: { is_active: true },
                    orderBy: { sort_order: 'asc' },
                },
            },
            orderBy: { sort_order: 'asc' },
        }),
        prisma.tbvs_brands.findMany({
            where: { is_active: true },
            orderBy: { sort_order: 'asc' },
        }),
        prisma.tbvs_materials.findMany({
            orderBy: { sort_order: 'asc' },
        }),
        prisma.colors.findMany({ orderBy: { name: 'asc' } }),
        prisma.origins.findMany({ orderBy: { name: 'asc' } }),
        prisma.tbvs_technologies.findMany({
            include: { tbvs_brands: true },
            orderBy: { sort_order: 'asc' },
        }),
    ])

    if (!product) notFound()

    return (
        <div className="space-y-6">
            <div>
                <Link
                    href="/admin/tbvs/products"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Quay lại danh sách
                </Link>
                <h1 className="text-2xl font-bold">Sửa sản phẩm</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{product.name}</p>
            </div>

            <TBVSProductForm
                product={product}
                productTypes={productTypes}
                brands={brands}
                materials={materials}
                colors={colors}
                origins={origins}
                technologies={technologies}
            />
        </div>
    )
}
