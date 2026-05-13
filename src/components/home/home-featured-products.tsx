"use client"

import { ProductCard } from '@/components/ui/product-card'
import { Zap } from 'lucide-react'

interface HomeFeaturedProductsProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    products: any[]
}

export function HomeFeaturedProducts({ products }: HomeFeaturedProductsProps) {
    if (!products || products.length === 0) return null

    return (
        <section className="w-full relative z-0 mt-8 mb-4">
            <div className="w-full h-full relative z-0 rounded-[12px] bg-white px-4 py-8 md:px-6 md:py-10 flex flex-col gap-6 md:gap-8 shadow-sm border border-brand-50">
                {/* Heading */}
                <div className="flex items-center gap-3">
                    <Zap className="w-6 h-6 md:w-8 md:h-8 text-red-500 fill-red-500" />
                    <h2 className="text-display-md md:text-display-lg font-bold text-stone-900 tracking-tight uppercase">
                        Sản phẩm nổi bật
                    </h2>
                </div>

                {/* Horizontal Scroll Snap Grid */}
                <div className="flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] -mx-5 px-5 lg:mx-0 lg:px-0 gap-4 lg:gap-6 pb-4">
                    {products.map((product) => (
                        <div key={product.id} className="snap-start shrink-0 w-[65vw] sm:w-[45vw] md:w-[30vw] lg:w-[22vw] max-w-[280px]">
                            <ProductCard
                                product={product}
                                basePath={`/${product.categories?.slug || 'san-pham'}`}
                                patternSlug={product.subcategories?.slug || 'all'}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
