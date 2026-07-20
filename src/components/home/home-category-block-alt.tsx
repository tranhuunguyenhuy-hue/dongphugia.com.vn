"use client"

import {
    useEffect,
    useRef,
    useState,
    useTransition,
} from 'react'
import Link from 'next/link'
import {
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    LoaderCircle,
} from 'lucide-react'
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

interface ProductCacheEntry {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    products: any[]
    total: number
}

function createCacheKey(
    categoryId: string,
    brandSlug: string | null,
    subcategorySlug: string | null,
) {
    return [
        categoryId,
        brandSlug ?? 'all-brands',
        subcategorySlug ?? 'all-subcategories',
    ].join(':')
}

export function HomeCategoryBlockAlt({
    categoryData,
}: HomeCategoryBlockAltProps) {
    const brands = categoryData.availableBrands ?? []
    const subcategories = categoryData.availableSubcategories ?? []

    const [activeBrandSlug, setActiveBrandSlug] = useState<string | null>(null)
    const [activeSubcategorySlug, setActiveSubcategorySlug] =
        useState<string | null>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [displayedProducts, setDisplayedProducts] = useState<any[]>(
        categoryData.products,
    )
    const [resultCount, setResultCount] = useState(
        categoryData.totalCount ?? categoryData.products.length,
    )
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const cacheRef = useRef(
        new Map<string, ProductCacheEntry>([
            [
                createCacheKey(categoryData.id, null, null),
                {
                    products: categoryData.products,
                    total:
                        categoryData.totalCount ?? categoryData.products.length,
                },
            ],
        ]),
    )
    const requestIdRef = useRef(0)
    const brandScrollerRef = useRef<HTMLDivElement>(null)

    const activeBrand =
        brands.find((brand) => brand.slug === activeBrandSlug) ?? null
    const activeSubcategory =
        subcategories.find(
            (subcategory) => subcategory.slug === activeSubcategorySlug,
        ) ?? null
    const selections = [
        activeBrand?.name,
        activeSubcategory?.name,
    ].filter(Boolean)
    const filterDescription =
        selections.length > 0 ? selections.join(' · ') : 'Tất cả lựa chọn'

    const resetFilters = () => {
        setActiveBrandSlug(null)
        setActiveSubcategorySlug(null)
    }

    const scrollBrands = (direction: -1 | 1) => {
        const scroller = brandScrollerRef.current
        if (!scroller) return
        scroller.scrollBy({
            left: direction * Math.max(scroller.clientWidth * 0.75, 200),
            behavior: 'smooth',
        })
    }

    useEffect(() => {
        const requestId = ++requestIdRef.current
        const cacheKey = createCacheKey(
            categoryData.id,
            activeBrandSlug,
            activeSubcategorySlug,
        )
        const cached = cacheRef.current.get(cacheKey)
        if (cached) {
            setDisplayedProducts(cached.products)
            setResultCount(cached.total)
            setLoadError(null)
            return
        }

        setLoadError(null)
        startTransition(async () => {
            try {
                const response = await fetchFeaturedProductsAction(
                    categoryData.id,
                    activeBrandSlug,
                    activeSubcategorySlug,
                    0,
                    10,
                )
                if (requestId !== requestIdRef.current) return

                const entry = {
                    products: response.products,
                    total: response.total,
                }
                cacheRef.current.set(cacheKey, entry)
                setDisplayedProducts(entry.products)
                setResultCount(entry.total)
            } catch (error) {
                if (requestId !== requestIdRef.current) return
                console.error(
                    '[home-category] Không tải được sản phẩm',
                    error,
                )
                setLoadError(
                    'Không thể cập nhật sản phẩm. Hãy thử lựa chọn khác.',
                )
            }
        })
    }, [
        activeBrandSlug,
        activeSubcategorySlug,
        categoryData.id,
    ])

    return (
        <section
            className="relative z-0 my-8 w-full [content-visibility:auto] [contain-intrinsic-size:720px]"
            aria-labelledby={`home-category-${categoryData.id}`}
        >
            <div className="mb-6 flex items-end justify-between gap-6 border-b border-stone-200 pb-5 md:mb-8 md:pb-6">
                <div className="min-w-0">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                        Sản phẩm nổi bật
                    </p>
                    <h2
                        id={`home-category-${categoryData.id}`}
                        className="font-display text-[28px] font-semibold leading-tight tracking-tight text-stone-900 md:text-display-lg"
                    >
                        {categoryData.label}
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
                        Chọn nhanh theo thương hiệu và nhu cầu của bạn.
                    </p>
                </div>

                <Link
                    href={categoryData.basePath}
                    className="hidden min-h-11 shrink-0 items-center gap-2 rounded-full border border-stone-300 bg-white px-5 text-sm font-semibold text-stone-800 transition-colors hover:border-brand-500 hover:text-brand-700 sm:inline-flex"
                >
                    Xem toàn bộ danh mục
                    <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
            </div>

            {(brands.length > 0 || subcategories.length > 0) && (
                <div className="mb-6 space-y-5 rounded-2xl border border-stone-200 bg-stone-50/80 p-4 md:p-5">
                    {brands.length > 0 && (
                        <div>
                            <p
                                id={`brand-filter-${categoryData.id}`}
                                className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-600"
                            >
                                Thương hiệu
                            </p>
                            <div
                                className="flex items-center gap-2"
                                role="group"
                                aria-labelledby={`brand-filter-${categoryData.id}`}
                            >
                                {brands.length > 2 && (
                                    <button
                                        type="button"
                                        onClick={() => scrollBrands(-1)}
                                        className="flex size-11 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
                                        aria-label={`Cuộn thương hiệu ${categoryData.label} sang trái`}
                                        aria-controls={`brand-options-${categoryData.id}`}
                                    >
                                        <ChevronLeft
                                            className="size-5"
                                            aria-hidden="true"
                                        />
                                    </button>
                                )}

                                <div
                                    ref={brandScrollerRef}
                                    id={`brand-options-${categoryData.id}`}
                                    className="flex min-w-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto px-0.5 [scrollbar-width:none]"
                                >
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setActiveBrandSlug(null)
                                        }
                                        className={cn(
                                            'flex h-14 min-w-24 shrink-0 snap-start items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-colors',
                                            activeBrandSlug === null
                                                ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                                                : 'border-stone-200 bg-white text-stone-700 hover:border-brand-300 hover:text-brand-700',
                                        )}
                                        aria-pressed={
                                            activeBrandSlug === null
                                        }
                                    >
                                        Tất cả
                                    </button>

                                    {brands.map((brand) => {
                                        const isActive =
                                            brand.slug === activeBrandSlug
                                        return (
                                            <button
                                                type="button"
                                                key={brand.slug}
                                                onClick={() =>
                                                    setActiveBrandSlug(
                                                        brand.slug,
                                                    )
                                                }
                                                className={cn(
                                                    'flex h-14 min-w-[108px] shrink-0 snap-start items-center justify-center rounded-xl border bg-white px-3 transition-colors',
                                                    isActive
                                                        ? 'border-brand-600 shadow-sm ring-1 ring-brand-600'
                                                        : 'border-stone-200 opacity-75 hover:border-brand-300 hover:opacity-100',
                                                )}
                                                aria-label={`Lọc theo thương hiệu ${brand.name}`}
                                                aria-pressed={isActive}
                                            >
                                                <BrandLogo
                                                    slug={brand.slug}
                                                    name={brand.name}
                                                    className="max-h-7 max-w-20"
                                                    decorative
                                                />
                                            </button>
                                        )
                                    })}
                                </div>

                                {brands.length > 2 && (
                                    <button
                                        type="button"
                                        onClick={() => scrollBrands(1)}
                                        className="flex size-11 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
                                        aria-label={`Cuộn thương hiệu ${categoryData.label} sang phải`}
                                        aria-controls={`brand-options-${categoryData.id}`}
                                    >
                                        <ChevronRight
                                            className="size-5"
                                            aria-hidden="true"
                                        />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {subcategories.length > 0 && (
                        <div>
                            <p
                                id={`subcategory-filter-${categoryData.id}`}
                                className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-600"
                            >
                                Loại sản phẩm
                            </p>
                            <div
                                className="flex snap-x gap-2 overflow-x-auto [scrollbar-width:none]"
                                role="group"
                                aria-labelledby={`subcategory-filter-${categoryData.id}`}
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        setActiveSubcategorySlug(null)
                                    }
                                    className={cn(
                                        'min-h-11 shrink-0 snap-start rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                                        activeSubcategorySlug === null
                                            ? 'border-brand-600 bg-brand-600 text-white'
                                            : 'border-stone-200 bg-white text-stone-700 hover:border-brand-300 hover:text-brand-700',
                                    )}
                                    aria-pressed={
                                        activeSubcategorySlug === null
                                    }
                                >
                                    Tất cả
                                </button>

                                {subcategories.map((subcategory) => {
                                    const isActive =
                                        activeSubcategorySlug ===
                                        subcategory.slug
                                    return (
                                        <button
                                            type="button"
                                            key={subcategory.slug}
                                            onClick={() =>
                                                setActiveSubcategorySlug(
                                                    subcategory.slug,
                                                )
                                            }
                                            className={cn(
                                                'min-h-11 shrink-0 snap-start rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                                                isActive
                                                    ? 'border-brand-600 bg-brand-600 text-white'
                                                    : 'border-stone-200 bg-white text-stone-700 hover:border-brand-300 hover:text-brand-700',
                                            )}
                                            aria-pressed={isActive}
                                        >
                                            {subcategory.name}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div
                className="mb-4 flex min-h-6 items-center justify-between gap-4 text-sm"
                aria-live="polite"
                aria-atomic="true"
            >
                <p
                    className={cn(
                        'text-stone-600',
                        loadError && 'font-medium text-rose-700',
                    )}
                >
                    {loadError ??
                        `${resultCount.toLocaleString('vi-VN')} sản phẩm nổi bật · ${filterDescription}`}
                </p>
                {isPending && (
                    <span className="flex shrink-0 items-center gap-2 font-medium text-brand-700">
                        <LoaderCircle
                            className="size-4 animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                        />
                        Đang tải
                    </span>
                )}
            </div>

            <div
                className={cn(
                    'w-full transition-opacity duration-200 motion-reduce:transition-none',
                    isPending && 'opacity-50',
                )}
                aria-busy={isPending}
            >
                {displayedProducts.length > 0 ? (
                    <>
                        <div className="grid grid-flow-col auto-cols-[78%] snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-3 sm:overflow-visible sm:pb-0 md:gap-5 lg:grid-cols-5">
                            {displayedProducts.map((product) => (
                                <div
                                    key={product.id}
                                    className="min-w-0 snap-start"
                                    data-home-product-brand={
                                        product.brands?.slug ?? ''
                                    }
                                >
                                    <ProductCard
                                        product={product}
                                        basePath={categoryData.basePath}
                                        reserveFeaturedLabelSpace={false}
                                        patternSlug={
                                            product.subcategories?.slug ??
                                            'san-pham'
                                        }
                                        href={product.url}
                                    />
                                </div>
                            ))}
                        </div>
                        {displayedProducts.length > 1 && (
                            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-stone-500 sm:hidden">
                                Vuốt ngang để xem thêm
                                <ArrowRight
                                    className="size-3.5"
                                    aria-hidden="true"
                                />
                            </p>
                        )}
                    </>
                ) : (
                    <div className="flex min-h-60 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-5 text-center">
                        <p className="font-medium text-stone-800">
                            Chưa có sản phẩm phù hợp
                        </p>
                        <p className="mt-1 text-sm text-stone-600">
                            Xóa bộ lọc để xem các sản phẩm nổi bật khác.
                        </p>
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="mt-4 inline-flex min-h-11 items-center rounded-full border border-brand-600 px-5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                        >
                            Xóa bộ lọc
                        </button>
                    </div>
                )}
            </div>

            <div className="mt-6 sm:hidden">
                <Link
                    href={categoryData.basePath}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-brand-600 px-5 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                >
                    Xem toàn bộ danh mục
                    <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
            </div>
        </section>
    )
}
