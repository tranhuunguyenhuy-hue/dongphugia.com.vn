'use client'

import Image from "next/image"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback, useRef, useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

// Hardcoded pattern type assets — fixed design, admin does not update
const PATTERN_TYPE_ASSETS: Record<string, { thumbnail: string; label: string }> = {
    "gach-van-da-marble": { thumbnail: "/images/pattern-types/marble.png", label: "Gạch Vân đá Marble" },
    "gach-van-da-tu-nhien": { thumbnail: "/images/pattern-types/da-tu-nhien.png", label: "Gạch vân đá tự nhiên" },
    "gach-van-go": { thumbnail: "/images/pattern-types/van-go.png", label: "Gạch vân gỗ" },
    "gach-thiet-ke-xi-mang": { thumbnail: "/images/pattern-types/xi-mang.png", label: "Gạch thiết kế xi măng" },
    "gach-trang-tri": { thumbnail: "/images/pattern-types/trang-tri.png", label: "Gạch trang trí" },
}

interface PatternType { id: number; name: string; slug: string }
interface PatternTypeSelectorProps { patternTypes: PatternType[] }

export function PatternTypeSelector({ patternTypes }: PatternTypeSelectorProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const activeSlug = searchParams.get("pattern")
    const scrollRef = useRef<HTMLDivElement>(null)
    const [canLeft, setCanLeft] = useState(false)
    const [canRight, setCanRight] = useState(true)

    // Track scroll position to show/hide arrows
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
        scrollRef.current?.scrollBy({ left: dir === "left" ? -160 : 160, behavior: "smooth" })
    }

    const handleClick = useCallback((slug: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (params.get("pattern") === slug) {
            params.delete("pattern")
        } else {
            params.set("pattern", slug)
                ;["collection", "color", "surface", "size", "origin", "location"].forEach(k => params.delete(k))
        }
        const qs = params.toString()
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, [router, pathname, searchParams])

    return (
        <div className="flex flex-col gap-5">
            {/* Heading */}
            <h2 className="text-[22px] lg:text-[24px] font-semibold text-[#111827] tracking-[-0.48px] leading-[32px]">
                Vui lòng chọn{" "}
                <span className="text-[#15803d] font-bold">loại gạch</span>{" "}
                cần thiết
            </h2>

            {/* Carousel wrapper */}
            <div className="relative">
                {/* Left button — visible on mobile when can scroll, fade-in/out */}
                <button
                    onClick={() => scroll("left")}
                    aria-label="Xem loại gạch trước"
                    className={`lg:hidden absolute left-0 top-[52px] -translate-y-1/2 -translate-x-1 z-20
                        w-9 h-9 rounded-full bg-white border border-[#e5e7eb] shadow-md
                        flex items-center justify-center
                        hover:bg-[#f0fdf4] hover:border-[#22c55e] hover:shadow-lg
                        active:scale-95 transition-all duration-200
                        ${canLeft ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                >
                    <ChevronLeft className="h-4 w-4 text-[#374151]" />
                </button>

                {/* Scroll container */}
                <div
                    ref={scrollRef}
                    className="flex gap-4 lg:gap-[19px] overflow-x-auto scrollbar-hide snap-x snap-mandatory py-2 px-0.5"
                    style={{ scrollbarWidth: "none" }}
                >
                    {patternTypes.map((pt) => {
                        const isActive = activeSlug === pt.slug
                        const asset = PATTERN_TYPE_ASSETS[pt.slug]
                        return (
                            <button
                                key={pt.id}
                                onClick={() => handleClick(pt.slug)}
                                className="flex flex-col items-start gap-3 group text-left w-[108px] lg:w-[120px] shrink-0 snap-start"
                            >
                                {/* Image card */}
                                <div className={`w-full aspect-square rounded-[16px] overflow-hidden relative
                                    border transition-all duration-300
                                    ${isActive
                                        ? "bg-[#f0fdf4] border-[#22c55e] shadow-[0_4px_16px_rgba(21,128,61,0.20)]"
                                        : "bg-white border-[#f3f4f6] shadow-[0_2px_6px_rgba(16,24,40,0.06)] group-hover:bg-[#f0fdf4] group-hover:border-[#86efac] group-hover:shadow-[0_4px_12px_rgba(21,128,61,0.12)]"
                                    }`}
                                >
                                    <Image
                                        src={asset?.thumbnail ?? "/images/pattern-types/marble.png"}
                                        alt={pt.name}
                                        fill
                                        sizes="120px"
                                        className={`object-cover transition-transform duration-500 ${isActive ? "scale-105" : "group-hover:scale-105"}`}
                                    />
                                    {/* Active overlay shimmer */}
                                    {isActive && (
                                        <div className="absolute inset-0 bg-[#15803d]/8 rounded-[14px]" />
                                    )}
                                </div>

                                {/* Label */}
                                <span className={`font-semibold text-[14px] lg:text-[16px] leading-[22px] transition-colors duration-200
                                    ${isActive ? "text-[#15803d]" : "text-[#4b5563] group-hover:text-[#15803d]"}`}
                                >
                                    {asset?.label ?? pt.name}
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* Right button */}
                <button
                    onClick={() => scroll("right")}
                    aria-label="Xem loại gạch tiếp theo"
                    className={`lg:hidden absolute right-0 top-[52px] -translate-y-1/2 translate-x-1 z-20
                        w-9 h-9 rounded-full bg-white border border-[#e5e7eb] shadow-md
                        flex items-center justify-center
                        hover:bg-[#f0fdf4] hover:border-[#22c55e] hover:shadow-lg
                        active:scale-95 transition-all duration-200
                        ${canRight ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                >
                    <ChevronRight className="h-4 w-4 text-[#374151]" />
                </button>

                {/* Edge fade gradients (mobile only) */}
                {canLeft && <div className="lg:hidden pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-white/70 to-transparent z-10" />}
                {canRight && <div className="lg:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white/70 to-transparent z-10" />}
            </div>
        </div>
    )
}
