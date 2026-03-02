import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import prisma from '@/lib/prisma'
import { BepProductForm } from '../bep-product-form'

export default async function NewBepProductPage() {
    const [productTypes, brands, colors, origins] = await Promise.all([
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
                <h1 className="text-2xl font-bold">Thêm sản phẩm Bếp</h1>
            </div>

            <BepProductForm
                productTypes={productTypes}
                brands={brands}
                colors={colors}
                origins={origins}
            />
        </div>
    )
}
