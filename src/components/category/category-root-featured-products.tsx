'use client'

import { useSearchParams } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import { Star } from 'lucide-react'
import { ProductCard, type ProductCardProps } from '@/components/ui/product-card'
import { useLiveSearchParams } from '@/components/category/use-live-search-params'
import { resolveProductCommerce } from '@/lib/product-commerce'

const subscribeToHydration = () => () => undefined
const getClientHydrationSnapshot = () => true
const getServerHydrationSnapshot = () => false

function useHasHydrated() {
    return useSyncExternalStore(
        subscribeToHydration,
        getClientHydrationSnapshot,
        getServerHydrationSnapshot,
    )
}

type CategoryRootFeaturedSectionProps = {
    basePath: string
    featuredProducts: ProductCardProps['product'][]
    isFiltered: boolean
    featuredGridClassName: string
}

export function CategoryRootFeaturedSection({
    basePath,
    featuredProducts,
    isFiltered,
    featuredGridClassName,
}: CategoryRootFeaturedSectionProps) {
    return (
        <section>
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                    <h2 className="text-[15px] font-semibold text-neutral-900">Sản phẩm nổi bật</h2>
                    {isFiltered && (
                        <span className="text-[11px] text-[#2E7A96] bg-[#2E7A96]/10 px-2 py-0.5 rounded-full">Đang lọc</span>
                    )}
                </div>
                <span className="text-[12px] text-neutral-400">{featuredProducts.length} sản phẩm</span>
            </div>
            {featuredProducts.length > 0 ? (
                <div className={featuredGridClassName}>
                    {featuredProducts.map((product, index) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            basePath={basePath}
                            patternSlug={product.subcategories?.slug}
                            priority={index === 0}
                            href={product.url}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
                        <Star className="h-6 w-6 text-neutral-300" />
                    </div>
                    <p className="text-[14px] font-medium text-neutral-600">Không có sản phẩm phù hợp</p>
                    <p className="text-[12px] text-neutral-400 mt-1">Thử thay đổi bộ lọc để xem thêm</p>
                </div>
            )}
        </section>
    )
}

type CategoryRootFeaturedProductsProps = Omit<CategoryRootFeaturedSectionProps, 'featuredProducts' | 'isFiltered'> & {
    featuredProducts: ProductCardProps['product'][]
    filterableFeaturedProducts: ProductCardProps['product'][]
}

export function CategoryRootFeaturedNeutralSection({featuredGridClassName}:Pick<CategoryRootFeaturedSectionProps,'featuredGridClassName'>) {
    return (
        <section aria-label="Sản phẩm nổi bật">
            <div className="flex items-center gap-2 mb-5">
                <Star className="h-4 w-4 text-amber-400 fill-amber-400" aria-hidden="true" />
                <h2 className="text-[15px] font-semibold text-neutral-900">Sản phẩm nổi bật</h2>
            </div>
            <noscript>
                <p className="mb-4 text-sm text-neutral-500">Bật JavaScript để xem sản phẩm nổi bật và lọc theo thương hiệu.</p>
            </noscript>
            <div className={featuredGridClassName} aria-hidden="true">
                {Array.from({length:4},(_,index)=>(
                    <div key={index}>
                        <div className="aspect-square rounded-xl bg-neutral-100" />
                        <div className="mt-3 h-3 w-3/4 rounded bg-neutral-100" />
                        <div className="mt-2 h-3 w-1/2 rounded bg-neutral-100" />
                        <div className="mt-4 h-4 w-2/3 rounded bg-neutral-100" />
                    </div>
                ))}
            </div>
        </section>
    )
}

export function CategoryRootFeaturedProducts({
    basePath,
    featuredProducts,
    filterableFeaturedProducts,
    featuredGridClassName,
}: CategoryRootFeaturedProductsProps) {
    const hydrated = useHasHydrated()
    const routerSearchParams = useSearchParams()
    const searchParams = useLiveSearchParams(routerSearchParams.toString())
    const selectedBrands = searchParams.get('brands')?.split(',').filter(Boolean) ?? []
    const priceMatch = /^(\d{1,9})-(\d{1,9})$/.exec(searchParams.get('price') ?? '')
    const priceRange = priceMatch && Number(priceMatch[1]) <= Number(priceMatch[2])
        ? [Number(priceMatch[1]), Number(priceMatch[2])] as const : null
    if (!hydrated) return <CategoryRootFeaturedNeutralSection featuredGridClassName={featuredGridClassName} />

    const visibleProducts = (selectedBrands.length || priceRange ? filterableFeaturedProducts : featuredProducts)
        .filter((product) => !selectedBrands.length || Boolean(product.brands?.slug && selectedBrands.includes(product.brands.slug)))
        .filter((product) => {
            if (!priceRange) return true
            const price = resolveProductCommerce({
                listPrice: product.list_price, originalPrice: product.original_price,
                salePrice: product.sale_price, compatibilityPrice: product.price,
                stockStatus: product.stock_status,
            }).displayPrice
            return price !== null && price >= priceRange[0]
                && (priceRange[1] >= 50_000_000 || price <= priceRange[1])
        })
        .slice(0, 8)

    return (
        <CategoryRootFeaturedSection
            basePath={basePath}
            featuredProducts={visibleProducts}
            isFiltered={selectedBrands.length > 0 || priceRange !== null}
            featuredGridClassName={featuredGridClassName}
        />
    )
}
