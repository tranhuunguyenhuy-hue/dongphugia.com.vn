import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import prisma from '@/lib/prisma'
import { SangoProductForm } from '../sango-product-form'

export default async function NewSangoProductPage() {
    const [productTypes, colors, origins] = await Promise.all([
        prisma.sango_product_types.findMany({
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
                    href="/admin/sango/products"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Quay lại danh sách
                </Link>
                <h1 className="text-2xl font-bold">Thêm sản phẩm Sàn gỗ</h1>
            </div>

            <SangoProductForm
                productTypes={productTypes}
                colors={colors}
                origins={origins}
            />
        </div>
    )
}
