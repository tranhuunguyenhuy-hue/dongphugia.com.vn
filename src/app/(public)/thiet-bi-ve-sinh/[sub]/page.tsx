import { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { getPublicProducts, getAvailableFilters, getSubcategorySpecFilters } from "@/lib/public-api-products"
import prisma from "@/lib/prisma"
import { ProductCard } from "@/components/ui/product-card"
import { ProductPagination } from "@/components/ui/product-pagination"
import { AdvancedSidebarFilter } from "@/components/category/advanced-sidebar-filter"
import { ActiveFilters, ActiveFilterDict } from "@/components/category/active-filters"
import { CategoryMobileFilter } from "@/components/category/category-mobile-filter"
import { CategorySort } from "@/components/category/category-sort"
import { ProductTypeFilter } from "@/components/category/product-type-filter"
import { ActiveSpecFilterChips, SpecFilterDef } from "@/components/category/subcategory-spec-filter"
import { SubcategoryIconGrid } from "@/components/category/subcategory-icon-grid"
import { ChevronRight, Home } from "lucide-react"
import Link from "next/link"

export const revalidate = 10800

const CATEGORY_SLUG = "thiet-bi-ve-sinh"
const CATEGORY_NAME = "Thiết Bị Vệ Sinh"
const BASE_PATH = "/thiet-bi-ve-sinh"
const PAGE_SIZE = 24

interface PageProps {
    params: Promise<{ sub: string }>
    searchParams: Promise<{ [key: string]: string | undefined }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { sub } = await params
    const subcategory = await prisma.subcategories.findFirst({
        where: { slug: sub, is_active: true },
    })
    if (!subcategory) return { title: `${CATEGORY_NAME} | Đông Phú Gia` }
    return {
        title: `${subcategory.name} | ${CATEGORY_NAME} | Đông Phú Gia`,
        description: subcategory.description || `${subcategory.name} chính hãng tại Đông Phú Gia Đà Lạt. Đa dạng mẫu mã, giá tốt.`,
    }
}

export default async function ThietBiVeSinhSubPage({ params, searchParams }: PageProps) {
    const { sub } = await params
    const sp = await searchParams

    // Validate subcategory exists
    const subcategory = await prisma.subcategories.findFirst({
        where: { slug: sub, is_active: true },
    })
    if (!subcategory) notFound()

    const currentPage = Math.max(1, parseInt(sp.page || "1"))
    const activeBrandSlugs = sp.brand
    const activeFeatureSlugs = sp.features
    const activeMaterialSlugs = sp.material
    const activeOriginSlugs = sp.origin
    const activeProductType = sp.type
    const activeProductSubType = sp.subtype
    const isNew = sp.is_new === 'true'
    const isFeatured = sp.is_featured === 'true'

    let price_min: number | undefined
    let price_max: number | undefined
    if (sp.price) {
        const [a, b] = sp.price.split('-').map(Number)
        if (!isNaN(a)) price_min = a
        if (!isNaN(b)) price_max = b
    }

    const sortParam = sp.sort
    let sortBy: 'sort_order' | 'created_at' | 'name' | 'price' = 'sort_order'
    let sortDir: 'asc' | 'desc' = 'asc'
    if (sortParam === 'price-asc') { sortBy = 'price'; sortDir = 'asc' }
    else if (sortParam === 'price-desc') { sortBy = 'price'; sortDir = 'desc' }
    else if (sortParam === 'newest') { sortBy = 'created_at'; sortDir = 'desc' }

    // Spec filters (sf_* prefix)
    const SF_PREFIX = 'sf_'
    const spec_filters: Record<string, string> = {}
    Object.entries(sp).forEach(([k, v]) => {
        if (k.startsWith(SF_PREFIX) && v) spec_filters[k.slice(SF_PREFIX.length)] = v
    })

    const [availableFilters, specFilterDefs, allSubcategories, { products, totalPages, total }] = await Promise.all([
        getAvailableFilters(CATEGORY_SLUG),
        getSubcategorySpecFilters(subcategory.id),
        prisma.subcategories.findMany({
            where: { categories: { slug: CATEGORY_SLUG }, is_active: true },
            orderBy: { sort_order: "asc" },
            include: {
                _count: {
                    select: {
                        products: { where: { is_active: true } },
                        secondary_product_subcategories: { where: { products: { is_active: true } } },
                    }
                }
            },
        }),
        getPublicProducts({
            category_slug: CATEGORY_SLUG,
            subcategory_slugs: sub,
            product_type: activeProductType,
            product_sub_type: activeProductSubType,
            brand_slug: activeBrandSlugs,
            feature_slugs: activeFeatureSlugs,
            material_slug: activeMaterialSlugs,
            origin_slug: activeOriginSlugs,
            is_new: isNew ? true : undefined,
            is_featured: isFeatured ? true : undefined,
            spec_filters: Object.keys(spec_filters).length > 0 ? spec_filters : undefined,
            price_min,
            price_max,
            page: currentPage,
            pageSize: PAGE_SIZE,
            sortBy,
            sortDir,
        }),
    ])

    const filterDict: ActiveFilterDict = {}
    availableFilters.brands.forEach(f => filterDict[f.slug] = f.name)
    availableFilters.features.forEach(f => filterDict[f.slug] = f.name)
    availableFilters.materials.forEach(f => filterDict[f.slug] = f.name)
    availableFilters.origins.forEach(f => filterDict[f.slug] = f.name)

    return (
        <main className="max-w-[1380px] mx-auto px-4 sm:px-5 lg:px-8">
            {/* Breadcrumb */}
            <nav className="hidden lg:flex items-center gap-1.5 text-[11px] text-neutral-400 pt-5 pb-0" aria-label="Breadcrumb">
                <Home className="h-3 w-3 flex-shrink-0" />
                <ChevronRight className="h-3 w-3 text-neutral-300" />
                <Link href="/" className="hover:text-neutral-700 transition-colors">Trang chủ</Link>
                <ChevronRight className="h-3 w-3 text-neutral-300" />
                <Link href={BASE_PATH} className="hover:text-neutral-700 transition-colors">{CATEGORY_NAME}</Link>
                <ChevronRight className="h-3 w-3 text-neutral-300" />
                <span className="text-neutral-600 font-medium">{subcategory.name}</span>
            </nav>

            <div className="flex flex-col lg:flex-row gap-5 lg:gap-10 items-start pt-3 pb-8 lg:pt-6 lg:pb-12">
                {/* ── Sidebar: Desktop only. Mobile uses Sheet via CategoryMobileFilter ── */}
                <aside className="hidden lg:flex w-[290px] flex-shrink-0 sticky top-24 scroll-sidebar flex-col gap-4">
                    <Suspense fallback={<div className="h-96 bg-neutral-100 animate-pulse rounded-lg" />}>
                        <AdvancedSidebarFilter
                            availableFilters={availableFilters}
                            hideSubcategoryFilter
                            specFilters={specFilterDefs as SpecFilterDef[]}
                        />
                    </Suspense>
                </aside>

                {/* ── Main 70% ── */}
                <div className="w-full flex-1 min-w-0 space-y-8">
                    {/* Subcategory icon grid */}
                    <SubcategoryIconGrid
                        subcategories={allSubcategories}
                        basePath={BASE_PATH}
                        activeSlug={sub}
                    />

                    {/* Product Type filter tabs — directly below icon grid */}
                    <Suspense>
                        <ProductTypeFilter activeSubSlug={sub} />
                    </Suspense>



                    <div className="mb-4 flex flex-col gap-3">
                        <div className="flex justify-between items-center gap-2 py-2 lg:py-0">
                            <span className="text-sm font-medium text-neutral-500">
                                <strong className="text-neutral-900">{total.toLocaleString('vi-VN')}</strong> sản phẩm
                            </span>
                            <div className="flex items-center gap-2">
                                <CategoryMobileFilter availableFilters={availableFilters} specFilters={specFilterDefs as SpecFilterDef[]} />
                                <CategorySort />
                            </div>
                        </div>

                        {/* Spec filter chips */}
                        {specFilterDefs.length > 0 && (
                            <Suspense>
                                <ActiveSpecFilterChips filters={specFilterDefs as SpecFilterDef[]} />
                            </Suspense>
                        )}

                        <Suspense>
                            <ActiveFilters filterDict={filterDict} excludeKeys={["sub"]} />
                        </Suspense>
                    </div>

                    {products.length > 0 ? (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                                {products.map(product => (
                                    <ProductCard
                                        key={product.id}
                                        product={{ ...product, subcategories: product.subcategories, brands: product.brands }}
                                        basePath={BASE_PATH}
                                        patternSlug={product.subcategories?.slug ?? "san-pham"}
                                    />
                                ))}
                            </div>
                            <div className="mt-12">
                                <Suspense><ProductPagination totalPages={totalPages} currentPage={currentPage} /></Suspense>
                            </div>
                        </>
                    ) : (
                        <div className="py-24 text-center bg-neutral-50 rounded-lg border border-neutral-200 border-dashed">
                            <div className="w-16 h-16 mx-auto bg-white rounded-full flex items-center justify-center shadow-sm border border-neutral-100 mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <p className="text-lg font-medium text-neutral-900 mb-1">Không tìm thấy sản phẩm nào</p>
                            <p className="text-sm text-neutral-500 mb-6">Vui lòng thử xóa bớt bộ lọc hoặc chọn tiêu chí khác.</p>
                            <Link href={`${BASE_PATH}/${sub}`} className="inline-flex h-9 items-center justify-center rounded-md bg-white border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors">
                                Xóa tất cả bộ lọc
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </main>
    )
}
