import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getAdminProductById } from '@/lib/public-api-products'
import { getCategories, getSubcategories, getBrands, getOrigins, getColors, getMaterials } from '@/lib/cache'
import { ProductForm } from '../product-form'

export const dynamic = 'force-dynamic'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: PageProps) {
    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) notFound()

    const [product, categories, subcategories, brands, origins, colors, materials] = await Promise.all([
        getAdminProductById(productId),
        getCategories(),
        getSubcategories(),
        getBrands(),
        getOrigins(),
        getColors(),
        getMaterials(),
    ])

    if (!product) notFound()

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
                    <h1 className="text-2xl font-bold tracking-tight">Chỉnh sửa sản phẩm</h1>
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{product.name}</p>
                </div>
            </div>
            <ProductForm
                product={product}
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
