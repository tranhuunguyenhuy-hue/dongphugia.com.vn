'use client'

import Image from 'next/image'
import { SUBCATEGORY_IMAGES } from '@/config/subcategory-images'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

interface Subcategory {
    id: number
    name: string
    slug: string
    thumbnail_url: string | null
    _count: { products: number }
}

interface SubcategoryIconGridProps {
    subcategories: Subcategory[]
    basePath: string
    activeSlug?: string
    emojiDefault?: string
}

function ChevronIcon({ dir = 'right' }: { dir?: 'left' | 'right' }) {
    return (
        <svg
            className={`w-3.5 h-3.5 ${dir === 'right' ? 'ml-0.5' : 'mr-0.5'}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
        >
            {dir === 'right'
                ? <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 4.5 7.5 7.5-7.5 7.5m-6-15 7.5 7.5-7.5 7.5" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="m12.75 19.5-7.5-7.5 7.5-7.5m6 15-7.5-7.5 7.5-7.5" />
            }
        </svg>
    )
}

export function SubcategoryIconGrid({
    subcategories,
    basePath,
    activeSlug,
}: SubcategoryIconGridProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(false)

    const updateScrollState = () => {
        const el = scrollRef.current
        if (!el) return
        setCanScrollLeft(el.scrollLeft > 4)
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    }

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        updateScrollState()
        el.addEventListener('scroll', updateScrollState, { passive: true })
        const ro = new ResizeObserver(updateScrollState)
        ro.observe(el)
        return () => {
            el.removeEventListener('scroll', updateScrollState)
            ro.disconnect()
        }
    }, [subcategories])

    const scroll = (dir: 'left' | 'right') =>
        scrollRef.current?.scrollBy({ left: dir === 'right' ? 300 : -300, behavior: 'smooth' })

    return (
        <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400 mb-3">
                Danh mục sản phẩm
            </p>

            <div className="relative bg-neutral-50 rounded-xl border border-neutral-100 p-4">
                <div
                    ref={scrollRef}
                    className={`flex gap-1.5 overflow-x-auto snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${
                        !activeSlug ? '[&:has(a:active)>a:not(:active)]:opacity-50 [&:has(a:active)>a:not(:active)]:transition-opacity' : ''
                    }`}
                    style={{
                        paddingLeft: canScrollLeft ? '36px' : undefined,
                        paddingRight: canScrollRight ? '36px' : undefined,
                    }}
                >
                    {subcategories.map((sub) => {
                        const imgSrc = SUBCATEGORY_IMAGES[sub.slug] ?? sub.thumbnail_url ?? null
                        const isActive = activeSlug === sub.slug
                        return (
                            <Link
                                key={sub.id}
                                href={`${basePath}/${sub.slug}`}
                                className={`group/item shrink-0 snap-start flex flex-col items-center gap-1.5 w-[96px] transition-opacity duration-150 ${activeSlug && !isActive ? 'opacity-50 hover:opacity-100' : ''}`}
                            >
                                <div className="relative w-full aspect-square">
                                    {imgSrc ? (
                                        <Image
                                            src={imgSrc}
                                            alt={sub.name}
                                            fill
                                            sizes="96px"
                                            className={[
                                                'object-contain mix-blend-multiply rounded-md',
                                                isActive ? 'outline outline-2 outline-[#2E7A96]/80 shadow-md scale-105' : 'outline outline-1 outline-neutral-200/70 shadow-xs',
                                                !isActive && 'group-hover/item:outline-neutral-300/80 group-hover/item:shadow-md group-hover/item:scale-105',
                                                !isActive && 'group-active/item:outline-[#2E7A96]/50 group-active/item:shadow-lg',
                                                'transition-all duration-200',
                                            ].filter(Boolean).join(' ')}
                                        />
                                    ) : (
                                        <div className={`w-full h-full flex items-center justify-center rounded-md ${isActive ? 'text-[#2E7A96] outline outline-2 outline-[#2E7A96]/80 shadow-md scale-105' : 'text-neutral-300 outline outline-1 outline-neutral-200/70 shadow-xs'}`}>
                                            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
                                            </svg>
                                        </div>
                                    )}
                                </div>

                                <span className={`text-[11px] font-medium text-center leading-tight transition-colors line-clamp-2 ${isActive ? 'text-[#2E7A96]' : 'text-neutral-500 group-hover/item:text-[#2E7A96]'}`}>
                                    {sub.name}
                                </span>
                            </Link>
                        )
                    })}
                </div>

                {/* Left fade + back button */}
                {canScrollLeft && (
                    <>
                        <div className="absolute top-0 left-0 bottom-0 w-14 bg-gradient-to-r from-neutral-50/95 to-transparent pointer-events-none rounded-l-xl" />
                        <button
                            type="button"
                            onClick={() => scroll('left')}
                            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-neutral-400 border border-neutral-100 hover:text-[#2E7A96] hover:border-[#2E7A96]/30 hover:shadow-md transition-all duration-200 cursor-pointer"
                            aria-label="Quay lại"
                        >
                            <ChevronIcon dir="left" />
                        </button>
                    </>
                )}

                {/* Right fade + forward button */}
                {canScrollRight && (
                    <>
                        <div className="absolute top-0 right-0 bottom-0 w-14 bg-gradient-to-l from-neutral-50/95 to-transparent pointer-events-none rounded-r-xl" />
                        <button
                            type="button"
                            onClick={() => scroll('right')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-neutral-400 border border-neutral-100 hover:text-[#2E7A96] hover:border-[#2E7A96]/30 hover:shadow-md transition-all duration-200 cursor-pointer"
                            aria-label="Xem thêm danh mục"
                        >
                            <ChevronIcon dir="right" />
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
