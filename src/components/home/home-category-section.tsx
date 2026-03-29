import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { ProductCard } from "@/components/ui/product-card"

interface HomeCategorySectionProps {
    title: string
    subtitle?: string
    products: any[]
    basePath: string
    viewAllHref: string
    viewAllText?: string
}

export function HomeCategorySection({
    title,
    subtitle,
    products,
    basePath,
    viewAllHref,
    viewAllText = "Xem tất cả"
}: HomeCategorySectionProps) {
    if (!products || products.length === 0) return null

    return (
        <section className="py-16 lg:py-24 border-b border-neutral-100 last:border-0">
            <div className="max-w-[1280px] mx-auto px-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 lg:mb-12 gap-4">
                    <div>
                        <div className="h-1 w-8 bg-[#2E7A96] mb-4" />
                        {subtitle && (
                            <h2 className="text-[13px] font-medium tracking-[0.15em] uppercase text-neutral-500 mb-2">
                                {subtitle}
                            </h2>
                        )}
                        <h3 className="text-[28px] sm:text-[32px] font-medium text-neutral-900 leading-tight">
                            {title}
                        </h3>
                    </div>
                    
                    <Link 
                        href={viewAllHref}
                        className="inline-flex items-center gap-1.5 text-[14px] font-medium text-neutral-600 hover:text-[#2E7A96] transition-colors group"
                    >
                        <span>{viewAllText}</span>
                        <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                </div>

                {/* Grid Products */}
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 xl:gap-8">
                    {products.map((product) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            basePath={basePath}
                        />
                    ))}
                </div>
                
                {/* Mobile View All (Optional - already at top, but nice to have at bottom for mobile) */}
                <div className="mt-8 flex justify-center sm:hidden">
                    <Link 
                        href={viewAllHref}
                        className="inline-flex w-full justify-center items-center py-3.5 px-6 rounded-xl bg-neutral-50 text-neutral-900 font-medium text-[14px] hover:bg-neutral-100 transition-colors"
                    >
                        <span>{viewAllText}</span>
                    </Link>
                </div>
            </div>
        </section>
    )
}
