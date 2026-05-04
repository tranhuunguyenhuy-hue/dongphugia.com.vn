import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getAdminProductById } from '@/lib/public-api-products'
import { getCategories, getSubcategories, getBrands, getOrigins, getColors, getMaterials, getFilterDefinitions, getProductTypes } from '@/lib/cache'
import { ProductForm } from '../product-form'

export const dynamic = 'force-dynamic'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: PageProps) {
    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) notFound()

    const [product, categories, subcategories, brands, origins, colors, materials, filterDefinitions, productTypes] = await Promise.all([
        getAdminProductById(productId),
        getCategories(),
        getSubcategories(),
        getBrands(),
        getOrigins(),
        getColors(),
        getMaterials(),
        getFilterDefinitions(),
        getProductTypes(),
    ])

    if (!product) notFound()

    return (
        <div className="space-y-6">
            <ProductForm
                pageTitle="Chỉnh sửa sản phẩm"
                pageSubtitle={product.name}
                product={product}
                categories={categories}
                subcategories={subcategories}
                brands={brands}
                origins={origins}
                colors={colors}
                materials={materials}
                filterDefinitions={filterDefinitions}
                productTypes={productTypes}
            />
        </div>
    )
}
