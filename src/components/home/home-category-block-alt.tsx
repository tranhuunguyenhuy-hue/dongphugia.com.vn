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
import { ProductCard } from '@/components/ui/product-card'
import { cn } from '@/lib/utils'

interface Brand {
    name: string
    slug: string
}

interface HomeCategoryBlockAltProps {
    categoryData: {
        id: string
        label: string
        description: string
        basePath: string
        // ProductCard supports the serialized product payload returned by Prisma.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        products: any[]
        totalCount?: number
        availableBrands?: Brand[]
    }
    sectionIndex: number
}

interface ProductCacheEntry {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    products: any[]
    total: number
}

function createCacheKey(categoryId: string, brandSlug: string | null) {
    return [categoryId, brandSlug ?? 'all-brands'].join(':')
}

export function HomeCategoryBlockAlt({
    categoryData,
    sectionIndex,
}: HomeCategoryBlockAltProps) {
    const brands = categoryData.availableBrands ?? []
    const [activeBrandSlug, setActiveBrandSlug] = useState<string | null>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [displayedProducts, setDisplayedProducts] = useState<any[]>(
        categoryData.products,
    )
    const [resultCount, setResultCount] = useState(
        categoryData.totalCount ?? categoryData.products.length,
    )
    const [mobileProductIndex, setMobileProductIndex] = useState(0)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const cacheRef = useRef(
        new Map<string, ProductCacheEntry>([
            [
                createCacheKey(categoryData.id, null),
                {
                    products: categoryData.products,
                    total:
                        categoryData.totalCount ?? categoryData.products.length,
                },
            ],
        ]),
    )
    const requestIdRef = useRef(0)

    const activeBrand =
        brands.find((brand) => brand.slug === activeBrandSlug) ?? null
    const catalogHref = activeBrand
        ? `${categoryData.basePath}?brands=${encodeURIComponent(activeBrand.name)}`
        : categoryData.basePath
    const resultDescription = activeBrand?.name ?? 'Tất cả hãng'

    const selectBrand = (brandSlug: string | null) => {
        const cached = cacheRef.current.get(
            createCacheKey(categoryData.id, brandSlug),
        )

        setMobileProductIndex(0)
        setLoadError(null)
        if (cached) {
            setDisplayedProducts(cached.products)
            setResultCount(cached.total)
        }
        setActiveBrandSlug(brandSlug)
    }

    useEffect(() => {
        const requestId = ++requestIdRef.current
        const cacheKey = createCacheKey(categoryData.id, activeBrandSlug)
        const cached = cacheRef.current.get(cacheKey)

        if (cached) return

        startTransition(async () => {
            try {
                const response = await fetchFeaturedProductsAction(
                    categoryData.id,
                    activeBrandSlug,
                    null,
                    0,
                    4,
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
                    'Không thể cập nhật sản phẩm. Vui lòng thử lại.',
                )
            }
        })
    }, [activeBrandSlug, categoryData.id])

    const showPreviousProduct = () => {
        setMobileProductIndex((index) => Math.max(0, index - 1))
    }

    const showNextProduct = () => {
        setMobileProductIndex((index) =>
            Math.min(displayedProducts.length - 1, index + 1),
        )
    }

    const renderProduct = (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        product: any,
    ) => (
        <div
            key={product.id}
            className="min-w-0"
            data-home-product-brand={product.brands?.slug ?? ''}
        >
            <ProductCard
                product={product}
                basePath={categoryData.basePath}
                displayMode="shelf"
                reserveFeaturedLabelSpace={false}
                patternSlug={product.subcategories?.slug ?? 'san-pham'}
                href={product.url}
            />
        </div>
    )

    return (
        <section
            className="relative z-0 w-full border-t border-stone-200 py-10 [content-visibility:auto] [contain-intrinsic-size:620px] md:py-12 lg:grid lg:grid-cols-[minmax(210px,0.28fr)_minmax(0,0.72fr)] lg:gap-10 lg:py-16"
            aria-labelledby={`home-category-${categoryData.id}`}
        >
            <header className="mb-8 flex items-start justify-between gap-5 lg:mb-0 lg:block">
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                        {String(sectionIndex).padStart(2, '0')} / 04
                    </p>
                    <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                        Sản phẩm nổi bật
                    </p>
                    <h2
                        id={`home-category-${categoryData.id}`}
                        className="mt-2 font-display text-[28px] font-semibold leading-tight tracking-tight text-stone-950 md:text-4xl lg:max-w-[9ch]"
                    >
                        {categoryData.label}
                    </h2>
                    <p className="mt-4 max-w-sm text-sm leading-6 text-stone-600">
                        {categoryData.description}
                    </p>
                </div>

                <Link
                    href={catalogHref}
                    className="mt-14 inline-flex min-h-11 shrink-0 items-center gap-2 border-b border-stone-400 text-sm font-semibold text-stone-800 transition-colors hover:border-brand-700 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4 lg:mt-7"
                >
                    Xem danh mục
                    {activeBrand ? ` ${activeBrand.name}` : ''}
                    <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
            </header>

            <div className="min-w-0">
                {brands.length > 0 && (
                    <div className="flex min-w-0 items-center gap-5 border-b border-stone-200">
                        <span
                            className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500"
                        >
                            Hãng
                        </span>
                        <div
                            className="flex min-w-0 flex-1 gap-6 overflow-x-auto [scrollbar-width:none]"
                            role="group"
                            aria-label={`Lọc ${categoryData.label} theo hãng`}
                        >
                            <button
                                type="button"
                                onClick={() => selectBrand(null)}
                                className={cn(
                                    'relative min-h-11 shrink-0 py-3 text-sm font-semibold transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:transition-transform',
                                    activeBrandSlug === null
                                        ? 'text-brand-700 after:scale-x-100 after:bg-brand-700'
                                        : 'text-stone-600 after:scale-x-0 after:bg-stone-400 hover:text-stone-950 hover:after:scale-x-100',
                                )}
                                aria-pressed={activeBrandSlug === null}
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
                                            selectBrand(brand.slug)
                                        }
                                        className={cn(
                                            'relative min-h-11 shrink-0 py-3 text-sm font-semibold transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:transition-transform',
                                            isActive
                                                ? 'text-brand-700 after:scale-x-100 after:bg-brand-700'
                                                : 'text-stone-600 after:scale-x-0 after:bg-stone-400 hover:text-stone-950 hover:after:scale-x-100',
                                        )}
                                        aria-pressed={isActive}
                                    >
                                        {brand.name}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                <div
                    className="flex min-h-12 items-center justify-between gap-4 py-3 text-xs"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    <p
                        className={cn(
                            'text-stone-500',
                            loadError && 'font-medium text-rose-700',
                        )}
                    >
                        {loadError ??
                            `${resultCount.toLocaleString('vi-VN')} sản phẩm nổi bật · ${resultDescription}`}
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
                            <div className="md:hidden">
                                {renderProduct(
                                    displayedProducts[mobileProductIndex],
                                )}
                                {displayedProducts.length > 1 && (
                                    <div className="mt-5 flex items-center justify-between border-t border-stone-200 pt-4">
                                        <p className="text-xs font-semibold tabular-nums text-stone-500">
                                            {String(
                                                mobileProductIndex + 1,
                                            ).padStart(2, '0')}{' '}
                                            /{' '}
                                            {String(
                                                displayedProducts.length,
                                            ).padStart(2, '0')}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={showPreviousProduct}
                                                disabled={
                                                    mobileProductIndex === 0
                                                }
                                                className="flex size-11 items-center justify-center rounded-full border border-stone-300 text-stone-700 transition-colors hover:border-brand-500 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-35"
                                                aria-label={`Xem sản phẩm ${categoryData.label} trước`}
                                            >
                                                <ChevronLeft
                                                    className="size-5"
                                                    aria-hidden="true"
                                                />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={showNextProduct}
                                                disabled={
                                                    mobileProductIndex ===
                                                    displayedProducts.length -
                                                        1
                                                }
                                                className="flex size-11 items-center justify-center rounded-full border border-stone-300 text-stone-700 transition-colors hover:border-brand-500 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-35"
                                                aria-label={`Xem sản phẩm ${categoryData.label} tiếp theo`}
                                            >
                                                <ChevronRight
                                                    className="size-5"
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="hidden grid-cols-2 gap-x-5 gap-y-8 md:grid lg:grid-cols-4">
                                {displayedProducts.map(renderProduct)}
                            </div>
                        </>
                    ) : (
                        <div className="flex min-h-60 w-full flex-col items-start justify-center border-y border-dashed border-stone-300 py-8">
                            <p className="font-medium text-stone-900">
                                Chưa có sản phẩm nổi bật của hãng này
                            </p>
                            <p className="mt-1 text-sm text-stone-600">
                                Chọn “Tất cả” để tiếp tục khám phá danh mục.
                            </p>
                            <button
                                type="button"
                                onClick={() => selectBrand(null)}
                                className="mt-4 inline-flex min-h-11 items-center border-b border-brand-700 text-sm font-semibold text-brand-700"
                            >
                                Xem tất cả hãng
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
