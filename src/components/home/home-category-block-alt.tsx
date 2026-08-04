import Link from 'next/link'
import { BrandLogo } from '@/components/media/brand-logo'
import { ProductCard } from '@/components/ui/product-card'

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

/**
 * Keep the homepage catalogue server-rendered.
 *
 * The category pages already own interactive filtering. Linking to those pages
 * preserves a usable no-JavaScript path while avoiding hydration of every
 * below-fold product card on the homepage.
 */
export function HomeCategoryBlockAlt({
    categoryData,
}: HomeCategoryBlockAltProps) {
    const brands = categoryData.availableBrands ?? []
    const subcategories = categoryData.availableSubcategories ?? []

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
                <nav
                    className="relative mb-6 flex w-full flex-col gap-4 overflow-hidden rounded-xl border border-neutral-200/60 bg-neutral-50 p-4 md:p-6"
                    aria-label={`Khám phá ${categoryData.label}`}
                >
                    {brands.length > 0 && (
                        <div
                            className="flex min-w-0 gap-2 overflow-x-auto px-1 [scrollbar-width:none]"
                            aria-label={`Thương hiệu ${categoryData.label}`}
                        >
                            {brands.map((brand) => (
                                <Link
                                    key={brand.slug}
                                    href={`${categoryData.basePath}?brands=${encodeURIComponent(brand.name)}`}
                                    className="flex h-16 min-w-[116px] shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 opacity-70 transition-colors hover:border-brand-300 hover:opacity-100"
                                    aria-label={`Xem ${categoryData.label} thương hiệu ${brand.name}`}
                                >
                                    <BrandLogo
                                        slug={brand.slug}
                                        name={brand.name}
                                        className="max-h-8 max-w-20"
                                    />
                                </Link>
                            ))}
                        </div>
                    )}

                    {subcategories.length > 0 && (
                        <div
                            className="flex gap-2 overflow-x-auto border-t border-neutral-200 pt-4 [scrollbar-width:none]"
                            aria-label={`Phân loại ${categoryData.label}`}
                        >
                            {subcategories.map((subcategory) => (
                                <Link
                                    key={subcategory.slug}
                                    href={`${categoryData.basePath}/${subcategory.slug}`}
                                    className="min-h-11 shrink-0 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:border-brand-300 hover:text-brand-700"
                                >
                                    {subcategory.name}
                                </Link>
                            ))}
                        </div>
                    )}
                </nav>
            )}

            {categoryData.products.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-5">
                    {categoryData.products.map((product) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            basePath={categoryData.basePath}
                            patternSlug={
                                product.subcategories?.slug ?? 'san-pham'
                            }
                            href={product.url}
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
