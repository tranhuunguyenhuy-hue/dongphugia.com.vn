"use client"

import {
    useEffect,
    useMemo,
    useRef,
    useState,
    useTransition,
} from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchFeaturedProductsAction } from '@/app/actions/home-products'
import { BrandLogo } from '@/components/media/brand-logo'
import { ProductCard } from '@/components/ui/product-card'
import { cn } from '@/lib/utils'

interface Brand {
    name: string
    slug: string
}

interface Subcategory {
    name: string
    slug: string
}

interface HomeCategoryBlockAltProps {
    categoryData: {
        id: string
        label: string
        basePath: string
        // ProductCard supports the serialized product payload returned by Prisma.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        products: any[]
        totalCount?: number
        availableBrands?: Brand[]
        availableSubcategories?: Subcategory[]
    }
}

export function HomeCategoryBlockAlt({
    categoryData,
}: HomeCategoryBlockAltProps) {
    const brands = useMemo(
        () => categoryData.availableBrands ?? [],
        [categoryData.availableBrands],
    )
    const subcategories = useMemo(
        () => categoryData.availableSubcategories ?? [],
        [categoryData.availableSubcategories],
    )
    const defaultSubcategory = useMemo(
        () =>
            subcategories.find((subcategory) => subcategory.slug === 'bon-cau')
                ?.slug ??
            subcategories[0]?.slug ??
            null,
        [subcategories],
    )

    const [activeBrandIndex, setActiveBrandIndex] = useState(0)
    const [activeSubcategorySlug, setActiveSubcategorySlug] =
        useState<string | null>(defaultSubcategory)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [displayedProducts, setDisplayedProducts] = useState<any[]>(
        categoryData.products,
    )
    const [isPending, startTransition] = useTransition()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cacheRef = useRef(new Map<string, any[]>())
    const requestIdRef = useRef(0)
    const isInitialRenderRef = useRef(true)

    const activeBrand = brands[activeBrandIndex] ?? null

    const selectAdjacentBrand = (direction: -1 | 1) => {
        if (brands.length === 0) return
        setActiveBrandIndex((current) =>
            (current + direction + brands.length) % brands.length,
        )
    }

    useEffect(() => {
        if (isInitialRenderRef.current) {
            isInitialRenderRef.current = false
            return
        }
        if (!activeBrand) return

        const cacheKey = [
            categoryData.id,
            activeBrand.slug,
            activeSubcategorySlug ?? '',
        ].join(':')
        const cached = cacheRef.current.get(cacheKey)
        if (cached) {
            setDisplayedProducts(cached)
            return
        }

        const requestId = ++requestIdRef.current
        startTransition(async () => {
            try {
                const response = await fetchFeaturedProductsAction(
                    categoryData.id,
                    activeBrand.slug,
                    activeSubcategorySlug,
                    0,
                    10,
                )
                if (requestId !== requestIdRef.current) return

                cacheRef.current.set(cacheKey, response.products)
                setDisplayedProducts(response.products)
            } catch (error) {
                console.error(
                    '[home-category] Không tải được sản phẩm',
                    error,
                )
            }
        })
    }, [activeBrand, activeSubcategorySlug, categoryData.id])

    return (
        <section
            className="relative z-0 my-8 w-full [content-visibility:auto] [contain-intrinsic-size:900px]"
            aria-labelledby={`home-category-${categoryData.id}`}
        >
            <div className="mb-6 flex w-full flex-col items-start gap-2 md:mb-8 md:gap-3">
                <h2
                    id={`home-category-${categoryData.id}`}
                    className="font-display text-[28px] font-semibold leading-tight tracking-tight text-stone-900 md:text-display-lg"
                >
                    Sản phẩm {categoryData.label}
                </h2>
                <div className="h-1 w-12 rounded-full bg-brand-600" />
            </div>

            {(brands.length > 0 || subcategories.length > 0) && (
                <div className="relative mb-6 flex w-full flex-col gap-4 overflow-hidden rounded-xl border border-neutral-200/60 bg-neutral-50 p-4 md:p-6">
                    {brands.length > 0 && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => selectAdjacentBrand(-1)}
                                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition-colors hover:border-brand-300 hover:text-brand-600"
                                aria-label={`Thương hiệu trước trong ${categoryData.label}`}
                            >
                                <ChevronLeft className="size-5" aria-hidden="true" />
                            </button>

                            <div
                                className="flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 [scrollbar-width:none]"
                                aria-label={`Thương hiệu ${categoryData.label}`}
                            >
                                {brands.map((brand, index) => {
                                    const isActive = index === activeBrandIndex
                                    return (
                                        <button
                                            type="button"
                                            key={brand.slug}
                                            onClick={() => setActiveBrandIndex(index)}
                                            className={cn(
                                                'flex h-16 min-w-[116px] shrink-0 items-center justify-center rounded-xl border bg-white px-3 transition-colors',
                                                isActive
                                                    ? 'border-brand-500 shadow-sm'
                                                    : 'border-neutral-200 opacity-70 hover:border-brand-300 hover:opacity-100',
                                            )}
                                            aria-pressed={isActive}
                                        >
                                            <BrandLogo
                                                slug={brand.slug}
                                                name={brand.name}
                                                className="max-h-8 max-w-20"
                                            />
                                        </button>
                                    )
                                })}
                            </div>

                            <button
                                type="button"
                                onClick={() => selectAdjacentBrand(1)}
                                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition-colors hover:border-brand-300 hover:text-brand-600"
                                aria-label={`Thương hiệu tiếp theo trong ${categoryData.label}`}
                            >
                                <ChevronRight className="size-5" aria-hidden="true" />
                            </button>
                        </div>
                    )}

                    {subcategories.length > 0 && (
                        <div
                            className="flex gap-2 overflow-x-auto border-t border-neutral-200 pt-4 [scrollbar-width:none]"
                            aria-label={`Phân loại ${categoryData.label}`}
                        >
                            {subcategories.map((subcategory) => {
                                const isActive =
                                    activeSubcategorySlug === subcategory.slug
                                return (
                                    <button
                                        type="button"
                                        key={subcategory.slug}
                                        onClick={() =>
                                            setActiveSubcategorySlug(subcategory.slug)
                                        }
                                        className={cn(
                                            'min-h-11 shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                                            isActive
                                                ? 'border-brand-600 bg-brand-600 text-white'
                                                : 'border-neutral-200 bg-white text-stone-600 hover:border-brand-300 hover:text-brand-700',
                                        )}
                                        aria-pressed={isActive}
                                    >
                                        {subcategory.name}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            <div
                className={cn(
                    'w-full transition-opacity duration-300',
                    isPending && 'opacity-50',
                )}
                aria-busy={isPending}
            >
                {displayedProducts.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-5">
                        {displayedProducts.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                basePath={categoryData.basePath}
                                patternSlug={
                                    product.subcategories?.slug ?? 'san-pham'
                                }
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex min-h-[240px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 text-center">
                        <p className="text-stone-600">
                            Chưa có sản phẩm cho lựa chọn này.
                        </p>
                    </div>
                )}
            </div>

            <div className="mt-6 flex justify-center">
                <Link
                    href={categoryData.basePath}
                    className="inline-flex min-h-11 items-center rounded-full border border-brand-600 px-5 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                >
                    Xem tất cả {categoryData.totalCount?.toLocaleString('vi-VN') ?? ''}{' '}
                    sản phẩm {categoryData.label.toLowerCase()}
                </Link>
            </div>
        </section>
    )
}
