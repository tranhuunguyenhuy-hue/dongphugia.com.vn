"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { SUBCATEGORY_IMAGES } from "@/config/subcategory-images"

// Subcategory tabs — images sourced from SUBCATEGORY_IMAGES config
// to stay in sync with SubcategoryIconGrid on category landing pages.
const CATEGORY_TABS = [
    {
        id: "thiet-bi-ve-sinh",
        label: "Thiết Bị Vệ Sinh",
        basePath: "/thiet-bi-ve-sinh",
        subcategories: [
            { label: "Bồn Cầu",          slug: "bon-cau" },
            { label: "Chậu Lavabo",       slug: "lavabo" },
            { label: "Sen Tắm",           slug: "sen-tam" },
            { label: "Bồn Tắm",           slug: "bon-tam" },
            { label: "Phụ Kiện P.Tắm",   slug: "phu-kien-phong-tam" },
            { label: "Vòi Chậu",          slug: "voi-chau" },
            { label: "Bồn Tiểu",          slug: "bon-tieu" },
            { label: "Vòi Nước",          slug: "voi-nuoc" },
            { label: "Nắp Bồn Cầu",       slug: "nap-bon-cau" },
            { label: "Phụ Kiện Bồn Cầu", slug: "phu-kien-bon-cau" },
            { label: "Thân Bồn Cầu",      slug: "than-bon-cau" },
        ]
    },
    {
        id: "thiet-bi-bep",
        label: "Thiết Bị Bếp",
        basePath: "/thiet-bi-bep",
        subcategories: [
            { label: "Vòi Rửa Chén", slug: "voi-rua-chen" },
            { label: "Phụ Kiện Bếp", slug: "thiet-bi-bep-khac" },
            { label: "Chậu Rửa Chén", slug: "chau-rua-chen" },
            { label: "Bếp Điện Từ",   slug: "bep-dien-tu" },
            { label: "Máy Hút Mùi",  slug: "may-hut-mui" },
            { label: "Máy Rửa Chén", slug: "may-rua-chen" },
            { label: "Bếp Gas",      slug: "bep-gas" },
            { label: "Lò Nướng",     slug: "lo-nuong" },
        ]
    },
    {
        id: "vat-lieu-nuoc",
        label: "Thiết Bị Nước",
        basePath: "/vat-lieu-nuoc",
        subcategories: [
            { label: "Máy Nước Nóng", slug: "may-nuoc-nong" },
            { label: "Lọc Nước",      slug: "loc-nuoc" },
            { label: "Bồn Chứa Nước", slug: "bon-chua-nuoc" },
            { label: "Máy Bơm Nước",  slug: "may-bom-nuoc" },
        ]
    },
    {
        id: "gach-op-lat",
        label: "Gạch Ốp Lát",
        basePath: "/gach-op-lat",
        subcategories: [
            { label: "Đá Marble",       slug: "gach-van-da-marble" },
            { label: "Đá Tự Nhiên",     slug: "gach-van-da-tu-nhien" },
            { label: "Gạch Vân Gỗ",     slug: "gach-van-go" },
            { label: "Gạch Xi Măng",    slug: "gach-thiet-ke-xi-mang" },
            { label: "Gạch Trang Trí",  slug: "gach-trang-tri" },
        ]
    }
]

export function CategoryTabsSection() {
    const [activeTab, setActiveTab] = useState(CATEGORY_TABS[0].id)
    const activeCategory = CATEGORY_TABS.find(c => c.id === activeTab) || CATEGORY_TABS[0]
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
    }, [activeTab])

    const scroll = (dir: 'left' | 'right') =>
        scrollRef.current?.scrollBy({ left: dir === 'right' ? 320 : -320, behavior: 'smooth' })

    return (
        <section className="w-full py-8 lg:py-10" aria-label="Danh mục chính">
            <div className="u-container flex flex-col gap-6">
                {/* Tabs */}
                <div className="flex overflow-x-auto gap-6 lg:gap-8 border-b border-stone-200 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {CATEGORY_TABS.map((cat) => {
                        const isActive = activeTab === cat.id
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setActiveTab(cat.id)}
                                className={cn(
                                    "relative shrink-0 snap-start pb-4 text-[15px] transition-all duration-300",
                                    isActive
                                        ? "text-stone-900 font-semibold"
                                        : "text-stone-500 font-normal hover:text-stone-900"
                                )}
                            >
                                {cat.label}
                                {isActive && (
                                    <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-stone-900" />
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Subcategory Horizontal Carousel */}
                <div className="relative w-full bg-neutral-50 rounded-xl p-4 lg:p-6 border border-stone-100 shadow-[inset_0_0_20px_rgba(0,0,0,0.01)]">
                    <div
                        ref={scrollRef}
                        className="flex overflow-x-auto gap-2 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] relative z-10 [&:has(a:active)>a:not(:active)]:opacity-50 [&:has(a:active)>a:not(:active)]:transition-opacity"
                        style={{
                            paddingLeft: canScrollLeft ? '40px' : undefined,
                            paddingRight: canScrollRight ? '40px' : undefined,
                        }}
                    >
                        {activeCategory.subcategories.map((sub) => {
                            const imgSrc = SUBCATEGORY_IMAGES[sub.slug] ?? null
                            return (
                                <Link
                                    href={`${activeCategory.basePath}/${sub.slug}`}
                                    key={sub.slug}
                                    className="group/item shrink-0 snap-start flex flex-col items-center gap-1.5 w-[120px] transition-opacity duration-150"
                                >
                                    {/* Transparent container — no bg, no fill color */}
                                    <div className="relative w-full aspect-square">
                                        {imgSrc ? (
                                            <Image
                                                src={imgSrc}
                                                alt={sub.label}
                                                fill
                                                sizes="120px"
                                                className={[
                                                    'object-contain mix-blend-multiply',
                                                    'rounded-md',
                                                    'outline outline-1 outline-neutral-200/70',
                                                    'shadow-xs',
                                                    'group-hover/item:outline-neutral-300/80',
                                                    'group-hover/item:shadow-md',
                                                    'group-hover/item:scale-105',
                                                    'group-active/item:outline-[#2E7A96]/50',
                                                    'group-active/item:shadow-lg',
                                                    'transition-all duration-200',
                                                ].join(' ')}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-neutral-300 rounded-md outline outline-1 outline-neutral-200/70">
                                                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[12px] font-medium text-stone-500 group-hover/item:text-stone-900 text-center leading-snug transition-colors line-clamp-2">
                                        {sub.label}
                                    </span>
                                </Link>
                            )
                        })}
                    </div>

                    {/* Left fade + back button */}
                    {canScrollLeft && (
                        <>
                            <div className="absolute top-0 left-0 bottom-0 w-16 bg-gradient-to-r from-neutral-50 from-40% to-transparent pointer-events-none rounded-l-xl z-20" />
                            <button
                                type="button"
                                onClick={() => scroll('left')}
                                className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-lg bg-white/90 shadow-sm flex items-center justify-center text-stone-400 backdrop-blur-sm border border-stone-100/50 hover:text-[#2E7A96] hover:border-[#2E7A96]/40 hover:shadow-md transition-all duration-200 cursor-pointer"
                                aria-label="Quay lại"
                            >
                                <svg className="w-4 h-4 mr-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m12.75 19.5-7.5-7.5 7.5-7.5m6 15-7.5-7.5 7.5-7.5" />
                                </svg>
                            </button>
                        </>
                    )}

                    {/* Right fade + forward button */}
                    {canScrollRight && (
                        <>
                            <div className="absolute top-0 right-0 bottom-0 w-24 bg-gradient-to-l from-neutral-50 from-40% to-transparent pointer-events-none rounded-r-xl z-20" />
                            <button
                                type="button"
                                onClick={() => scroll('right')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-lg bg-white/90 shadow-sm flex items-center justify-center text-stone-400 backdrop-blur-sm border border-stone-100/50 hover:text-[#2E7A96] hover:border-[#2E7A96]/40 hover:shadow-md transition-all duration-200 cursor-pointer"
                                aria-label="Xem thêm danh mục"
                            >
                                <svg className="w-4 h-4 ml-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 4.5 7.5 7.5-7.5 7.5m-6-15 7.5 7.5-7.5 7.5" />
                                </svg>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </section>
    )
}
