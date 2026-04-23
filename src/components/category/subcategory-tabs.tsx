import Link from 'next/link'

interface Subcategory {
    id: number
    name: string
    slug: string
    _count: { products: number }
}

interface SubcategoryTabsProps {
    subcategories: Subcategory[]
    activeSlug?: string
    basePath: string // e.g. '/thiet-bi-ve-sinh'
    searchParams?: Record<string, string>
}

export function SubcategoryTabs({ subcategories, activeSlug, basePath, searchParams = {} }: SubcategoryTabsProps) {
    if (!subcategories.length) return null

    const buildHref = (slug: string | null) => {
        const params = new URLSearchParams({ ...searchParams, page: '1' })
        if (slug) params.set('sub', slug)
        else params.delete('sub')
        return `${basePath}?${params.toString()}`
    }

    return (
        <div className="w-full overflow-x-auto scrollbar-hide -mx-5 px-5">
            <div className="flex gap-2 min-w-max pb-2">
                {/* "All" tab */}
                <Link
                    href={buildHref(null)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap border ${
                        !activeSlug
                            ? 'bg-[#192125] text-white border-[#192125]'
                            : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                    }`}
                >
                    Tất cả
                </Link>

                {subcategories.map(sub => {
                    const isActive = sub.slug === activeSlug
                    return (
                        <Link
                            key={sub.id}
                            href={buildHref(sub.slug)}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap border ${
                                isActive
                                    ? 'bg-[#192125] text-white border-[#192125]'
                                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                            }`}
                        >
                            {sub.name}
                            <span className={`text-xs ${isActive ? 'text-white/70' : 'text-neutral-400'}`}>
                                {sub._count.products}
                            </span>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
