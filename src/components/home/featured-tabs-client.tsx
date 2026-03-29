'use client'

import { useState } from 'react'
import { ProductCard } from '@/components/ui/product-card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronRight, PackageOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CategoryData {
    id: string
    label: string
    basePath: string
    products: any[]
}

export function FeaturedTabsClient({ categories }: { categories: CategoryData[] }) {
    const [activeTab, setActiveTab] = useState(categories[0].id)
    const activeCategory = categories.find(c => c.id === activeTab) || categories[0]

    return (
        <div className="flex flex-col gap-8">
            {/* Tabs List (Horizontal Scroll on Mobile) */}
            <div className="flex overflow-x-auto scrollbar-hide gap-2 pb-2 -mx-5 px-5 md:mx-0 md:px-0 snap-x">
                {categories.map((cat) => {
                    const isActive = activeTab === cat.id
                    return (
                        <button
                            key={cat.id}
                            onClick={() => setActiveTab(cat.id)}
                            className={cn(
                                "shrink-0 snap-start px-6 py-3 rounded-full text-[15px] font-semibold transition-all duration-300",
                                isActive
                                    ? "bg-[#2E7A96] text-white shadow-[0_4px_12px_rgba(46,122,150,0.2)]"
                                    : "bg-gray-100 text-[#516A74] hover:bg-gray-200 hover:text-[#192125]"
                            )}
                        >
                            {cat.label}
                        </button>
                    )
                })}
            </div>

            {/* Products Grid or Empty State */}
            <div className="w-full">
                {activeCategory.products.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                        {activeCategory.products.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                basePath={activeCategory.basePath}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="w-full flex flex-col items-center justify-center py-20 bg-gray-50/50 rounded-[32px] border border-dashed border-gray-200">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4">
                            <PackageOpen className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-[#192125] mb-2">Chưa có sản phẩm nổi bật</h3>
                        <p className="text-[#6A8A97] text-center max-w-md mb-6">
                            Danh mục {activeCategory.label.toLowerCase()} hiện chưa có sản phẩm nào được đánh dấu nổi bật. Vui lòng quay lại sau!
                        </p>
                        <Button asChild variant="outline" className="rounded-full border-[#2E7A96] text-[#2E7A96] hover:bg-[#2E7A96] hover:text-white transition-colors">
                            <Link href={activeCategory.basePath}>
                                Xem tất cả {activeCategory.label.toLowerCase()}
                            </Link>
                        </Button>
                    </div>
                )}
            </div>

            {/* View All Button (Only show if there are products) */}
            {activeCategory.products.length > 0 && (
                <div className="flex justify-center mt-4">
                    <Button asChild variant="outline" className="rounded-full px-8 h-12 text-[15px] font-medium border-gray-200 text-[#192125] hover:border-[#2E7A96] hover:text-[#2E7A96] transition-colors group">
                        <Link href={activeCategory.basePath}>
                            Xem tất cả {activeCategory.label.toLowerCase()}
                            <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </Button>
                </div>
            )}
        </div>
    )
}
