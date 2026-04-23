import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCategories, getSubcategories, getBrands, getOrigins, getColors, getMaterials } from '@/lib/cache'
import { ProductForm } from '../product-form'

export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
    const [categories, subcategories, brands, origins, colors, materials] = await Promise.all([
        getCategories(),
        getSubcategories(),
        getBrands(),
        getOrigins(),
        getColors(),
        getMaterials(),
    ])

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link
                    href="/admin/products"
                    className="h-9 w-9 flex items-center justify-center rounded-lg border border-[#E4EEF2] text-muted-foreground hover:bg-muted transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Thêm sản phẩm mới</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Điền thông tin sản phẩm</p>
                </div>
            </div>
            <ProductForm
                categories={categories}
                subcategories={subcategories}
                brands={brands}
                origins={origins}
                colors={colors}
                materials={materials}
            />
        </div>
    )
}
