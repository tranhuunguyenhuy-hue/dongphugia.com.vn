import { Metadata } from "next"
import { Suspense } from "react"
import { getCategoryWithSubcategories } from "@/lib/category-helpers"
import { getPublicProducts } from "@/lib/public-api-products"
import { SubcategoryTabs } from "@/components/category/subcategory-tabs"
import { ProductCard } from "@/components/ui/product-card"
import { ProductPagination } from "@/components/ui/product-pagination"

export const revalidate = 3600

export const metadata: Metadata = {
    title: "Thiết Bị Vệ Sinh | Đông Phú Gia",
    description: "Thiết bị vệ sinh cao cấp chính hãng TOTO, INAX, Caesar tại Đông Phú Gia Đà Lạt. Hơn 500 mẫu bồn cầu, lavabo, vòi nước, sen tắm.",
    keywords: ["thiết bị vệ sinh", "bồn cầu", "lavabo", "TOTO", "INAX", "Caesar", "Đà Lạt"],
}

const CATEGORY_SLUG = "thiet-bi-ve-sinh"
const BASE_PATH = "/thiet-bi-ve-sinh"
const PAGE_SIZE = 24

interface PageProps {
    searchParams: Promise<{ sub?: string; page?: string }>
}

export default async function ThietBiVeSinhPage({ searchParams }: PageProps) {
    const params = await searchParams
    const currentPage = Math.max(1, parseInt(params.page || "1"))
    const activeSubSlug = params.sub

    const [category, { products, totalPages }] = await Promise.all([
        getCategoryWithSubcategories(CATEGORY_SLUG),
        getPublicProducts({
            category_slug: CATEGORY_SLUG,
            subcategory_slug: activeSubSlug,
            page: currentPage,
            pageSize: PAGE_SIZE,
            sortBy: "sort_order",
            sortDir: "asc",
        }),
    ])

    const subcategories = category?.subcategories ?? []

    return (
        <main className="max-w-[1280px] mx-auto px-5 py-8 lg:py-12">
            {/* Page Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-[#192125] tracking-tight mb-1">
                    Thiết Bị Vệ Sinh
                </h1>
                <p className="text-neutral-500 text-sm">
                    Sản phẩm chính hãng. Bảo hành đầy đủ. Tư vấn miễn phí.
                </p>
            </div>

            {/* Subcategory Tabs */}
            <Suspense>
                <div className="mb-8">
                    <SubcategoryTabs
                        subcategories={subcategories}
                        activeSlug={activeSubSlug}
                        basePath={BASE_PATH}
                        searchParams={activeSubSlug ? { sub: activeSubSlug } : {}}
                    />
                </div>
            </Suspense>

            {/* Product Grid */}
            {products.length > 0 ? (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {products.map(product => (
                            <ProductCard
                                key={product.id}
                                product={{
                                    ...product,
                                    subcategories: product.subcategories,
                                    brands: product.brands,
                                }}
                                basePath={BASE_PATH}
                                patternSlug={product.subcategories?.slug ?? "san-pham"}
                            />
                        ))}
                    </div>
                    <Suspense>
                        <ProductPagination totalPages={totalPages} currentPage={currentPage} />
                    </Suspense>
                </>
            ) : (
                <div className="py-24 text-center text-neutral-400">
                    <p className="text-lg font-medium">Chưa có sản phẩm trong mục này.</p>
                    <p className="text-sm mt-1">Vui lòng liên hệ để được tư vấn trực tiếp.</p>
                </div>
            )}
        </main>
    )
}
