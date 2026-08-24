import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCategories, getSubcategories, getBrands, getOrigins, getColors, getMaterials, getFilterDefinitions, getProductTypes, getCatalogTaxons, getNormalizedProductTypes, getSpecDefinitions } from '@/lib/cache'
import { ProductForm } from '../product-form'

export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
    const [categories, subcategories, brands, origins, colors, materials, filterDefinitions, productTypes, catalogTaxons, normalizedProductTypes, specDefinitions] = await Promise.all([
        getCategories(),
        getSubcategories(),
        getBrands(),
        getOrigins(),
        getColors(),
        getMaterials(),
        getFilterDefinitions(),
        getProductTypes(),
        getCatalogTaxons(),
        getNormalizedProductTypes(),
        getSpecDefinitions(),
    ])

    return (
        <div className="space-y-6">
            <ProductForm
                pageTitle="Thêm sản phẩm mới"
                pageSubtitle="Điền thông tin sản phẩm"
                categories={categories}
                subcategories={subcategories}
                brands={brands}
                origins={origins}
                colors={colors}
                materials={materials}
                filterDefinitions={filterDefinitions}
                productTypes={productTypes}
                catalogTaxons={catalogTaxons}
                normalizedProductTypes={normalizedProductTypes}
                specDefinitions={specDefinitions}
            />
        </div>
    )
}
