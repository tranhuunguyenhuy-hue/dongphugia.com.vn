'use client'

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback, useRef, useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

// ────────── Types ──────────

interface Brand {
    name: string;
    slug: string;
}

interface BrandCarouselProps {
    /** Heading text, default: "Thương hiệu" */
    heading?: string;
    /** List of brands to display */
    brands: Brand[];
    /** Currently active brand slug (from URL or parent) */
    activeSlug?: string;
}

// ────────── BrandCarousel (unified) ──────────

export function BrandCarousel({ heading = "Thương hiệu", brands, activeSlug }: BrandCarouselProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const scrollRef = useRef<HTMLDivElement>(null)
    const [canLeft, setCanLeft] = useState(false)
    const [canRight, setCanRight] = useState(true)

    const updateArrows = useCallback(() => {
        const el = scrollRef.current
        if (!el) return
        setCanLeft(el.scrollLeft > 8)
        setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8)
    }, [])

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        updateArrows()
        el.addEventListener("scroll", updateArrows, { passive: true })
        return () => el.removeEventListener("scroll", updateArrows)
    }, [updateArrows])

    const scroll = (dir: "left" | "right") => {
        scrollRef.current?.scrollBy({ left: dir === "left" ? -250 : 250, behavior: "smooth" })
    }

    const handleClick = useCallback((slug: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (params.get("brand") === slug) {
            params.delete("brand")
        } else {
            params.set("brand", slug)
        }
        params.delete("page") // Reset page when filtering
        const qs = params.toString()
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, [router, pathname, searchParams])

    if (!brands || brands.length === 0) return null

    return (
        <div className="flex flex-col gap-4">
            {/* Heading */}
            <h2 className="text-[22px] lg:text-[24px] font-semibold text-[#192125] tracking-[-0.48px] leading-[32px] pl-1">
                {heading}
            </h2>

            {/* Carousel */}
            <div className="relative group/carousel">
                {/* Left Arrow */}
                <button
                    onClick={() => scroll("left")}
                    aria-label="Xem thương hiệu trước"
                    className={`absolute left-0 top-[40px] -translate-y-1/2 -translate-x-1 z-20
                        w-8 h-8 lg:w-9 lg:h-9 rounded-[var(--radius)]
                        bg-white border border-neutral-200
                        flex items-center justify-center
                        hover:bg-neutral-50 hover:border-neutral-400
                        active:scale-95 transition-all duration-200
                        ${canLeft ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                >
                    <ChevronLeft className="h-4 w-4 text-[#3C4E56]" />
                </button>

                {/* Scroll container */}
                <div
                    ref={scrollRef}
                    className="flex gap-3 lg:gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory py-2 px-0.5"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {brands.map((brand) => {
                        const isActive = activeSlug === brand.slug
                        return (
                            <button
                                key={brand.slug}
                                onClick={() => handleClick(brand.slug)}
                                className="group flex flex-col gap-3 shrink-0 w-[110px] lg:w-[130px] snap-start"
                            >
                                {/* Square Card for image */}
                                <div className={`w-full aspect-square rounded-[var(--radius-card)] flex flex-col items-center justify-center relative
                                    border transition-all duration-300 p-3 lg:p-4
                                    ${isActive
                                        ? "border-neutral-900 bg-white"
                                        : "bg-neutral-50 border-neutral-200 group-hover:bg-white group-hover:border-neutral-400"
                                    }`}
                                >
                                    <img
                                        src={`/images/brands/${brand.slug}.png`}
                                        alt={brand.name}
                                        className={`w-full h-full object-contain transition-all duration-300 ${isActive ? "opacity-100 grayscale-0" : "grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100"}`}
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            if (target.src.endsWith('.png')) {
                                                target.src = `/images/brands/${brand.slug}.svg`;
                                            } else {
                                                target.style.display = 'none';
                                                target.parentElement?.setAttribute('data-error', 'true');
                                            }
                                        }}
                                    />
                                    <style jsx>{`
                                        div[data-error="true"]::after {
                                            content: '🏢';
                                            font-size: 2rem;
                                            opacity: 0.3;
                                        }
                                        @media (min-width: 1024px) {
                                            div[data-error="true"]::after {
                                                font-size: 2.5rem;
                                            }
                                        }
                                    `}</style>
                                </div>
                                <div className="flex flex-col items-center gap-0.5 w-full px-1">
                                    <span className={`font-semibold text-center text-[13px] lg:text-[14px] leading-tight truncate w-full transition-colors duration-200 ${isActive ? "text-[#192125]" : "text-[#516A74] group-hover:text-[#192125]"}`}>
                                        {brand.name}
                                    </span>
                                </div>
                            </button>
                        )
                    })}
                </div>

                {/* Right Arrow */}
                <button
                    onClick={() => scroll("right")}
                    aria-label="Xem thương hiệu tiếp theo"
                    className={`absolute right-0 top-[40px] -translate-y-1/2 translate-x-1 z-20
                        w-8 h-8 lg:w-9 lg:h-9 rounded-[var(--radius)]
                        bg-white border border-neutral-200
                        flex items-center justify-center
                        hover:bg-neutral-50 hover:border-neutral-400
                        active:scale-95 transition-all duration-200
                        ${canRight ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                >
                    <ChevronRight className="h-4 w-4 text-[#3C4E56]" />
                </button>

                {/* Edge fade gradients */}
                {canLeft && <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white/80 to-transparent z-10" />}
                {canRight && <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/80 to-transparent z-10" />}
            </div>
        </div>
    )
}
