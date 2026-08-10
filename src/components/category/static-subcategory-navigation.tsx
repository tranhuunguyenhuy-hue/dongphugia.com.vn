import Image from 'next/image'
import Link from 'next/link'
import { SUBCATEGORY_IMAGES } from '@/config/subcategory-images'

interface StaticSubcategory {
    id: number | null
    name: string
    slug: string
    thumbnail_url: string | null
}

interface StaticSubcategoryNavigationProps {
    subcategories: StaticSubcategory[]
    basePath: string
    activeSlug?: string
}

export function StaticSubcategoryNavigation({
    subcategories,
    basePath,
    activeSlug,
}: StaticSubcategoryNavigationProps) {
    return (
        <div className="w-full overflow-hidden">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-400">
                Danh mục sản phẩm
            </p>

            <div className="overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50">
                <nav
                    aria-label="Danh mục sản phẩm"
                    className="flex touch-pan-x gap-2 overflow-x-auto px-2.5 py-2 sm:gap-3 sm:px-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                >
                    {subcategories.map((subcategory) => {
                        const imageSource =
                            SUBCATEGORY_IMAGES[subcategory.slug] ??
                            subcategory.thumbnail_url ??
                            null
                        const isActive = activeSlug === subcategory.slug

                        return (
                            <Link
                                key={subcategory.id}
                                href={`${basePath}/${subcategory.slug}`}
                                aria-label={subcategory.name}
                                aria-current={isActive ? 'page' : undefined}
                                className={`group/item flex w-[56px] shrink-0 flex-col items-center gap-1 sm:w-[68px] lg:w-[76px] ${
                                    activeSlug && !isActive ? 'opacity-50 hover:opacity-100' : ''
                                }`}
                            >
                                <div className="relative aspect-square w-full">
                                    {imageSource ? (
                                        <Image
                                            src={imageSource}
                                            alt={subcategory.name}
                                            fill
                                            sizes="76px"
                                            className={`rounded-md object-contain mix-blend-multiply ${
                                                isActive
                                                    ? 'outline outline-[2.5px] outline-[#2E7A96]/90 shadow-[0_4px_16px_rgba(46,122,150,0.22)]'
                                                    : 'outline outline-1 outline-neutral-200/70 shadow-xs'
                                            }`}
                                        />
                                    ) : (
                                        <div
                                            aria-hidden="true"
                                            className={`flex h-full w-full items-center justify-center rounded-md ${
                                                isActive
                                                    ? 'text-[#2E7A96] outline outline-[2.5px] outline-[#2E7A96]/90 shadow-[0_4px_16px_rgba(46,122,150,0.22)]'
                                                    : 'text-neutral-300 outline outline-1 outline-neutral-200/70 shadow-xs'
                                            }`}
                                        >
                                            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
                                            </svg>
                                        </div>
                                    )}
                                </div>

                                <span className={`line-clamp-2 text-center text-[9px] font-medium leading-tight sm:text-[10px] ${
                                    isActive ? 'text-[#2E7A96]' : 'text-neutral-500 group-hover/item:text-[#2E7A96]'
                                }`}>
                                    {subcategory.name}
                                </span>
                            </Link>
                        )
                    })}
                </nav>
            </div>
        </div>
    )
}
