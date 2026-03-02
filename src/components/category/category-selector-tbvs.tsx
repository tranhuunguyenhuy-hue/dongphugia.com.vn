'use client'

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback, useRef, useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface TBVSType { id: number; name: string; slug: string }
interface CategorySelectorTBVSProps { types: TBVSType[] }

export function CategorySelectorTBVS({ types }: CategorySelectorTBVSProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const activeSlug = searchParams.get("type")
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
        scrollRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" })
    }

    const handleClick = useCallback((slug: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (params.get("type") === slug) {
            params.delete("type")
        } else {
            params.set("type", slug)
                // Reset other filters
                ;["subtype", "brand", "page"].forEach(k => params.delete(k))
        }
        const qs = params.toString()
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, [router, pathname, searchParams])

    if (!types || types.length === 0) return null

    return (
        <div className="flex flex-col gap-5">
            {/* Heading */}
            <h2 className="text-[22px] lg:text-[24px] font-semibold text-[#111827] tracking-[-0.48px] leading-[32px]">
                Vui lòng chọn{' '}
                <span className="text-[#15803d] font-bold">thiết bị</span>
                {' '}vệ sinh
            </h2>

            {/* Carousel wrapper */}
            <div className="relative">
                {/* Left button */}
                <button
                    onClick={() => scroll("left")}
                    aria-label="Xem thiết bị trước"
                    className={`absolute left-0 top-[40px] -translate-y-1/2 -translate-x-1 z-20
                        w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-white border border-[#e5e7eb] shadow-md
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
                    className="flex gap-3 lg:gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory py-2 px-0.5"
                    style={{ scrollbarWidth: "none" }}
                >
                    {types.map((type) => {
                        const isActive = activeSlug === type.slug
                        return (
                            <button
                                key={type.id}
                                onClick={() => handleClick(type.slug)}
                                className="group flex shrink-0 snap-start"
                            >
                                <div className={`px-5 py-[10px] rounded-full flex items-center justify-center transition-all duration-200 border
                                    ${isActive
                                        ? "bg-[#111827] border-[#111827] text-white shadow-md"
                                        : "bg-white border-[#e5e7eb] text-[#4b5563] hover:border-[#111827] hover:text-[#111827]"
                                    }`}
                                >
                                    <span className="font-semibold text-[14px]">
                                        {type.name}
                                    </span>
                                </div>
                            </button>
                        )
                    })}
                </div>

                {/* Right button */}
                <button
                    onClick={() => scroll("right")}
                    aria-label="Xem thiết bị tiếp theo"
                    className={`absolute right-0 top-[40px] -translate-y-1/2 translate-x-1 z-20
                        w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-white border border-[#e5e7eb] shadow-md
                        flex items-center justify-center
                        hover:bg-[#f0fdf4] hover:border-[#22c55e] hover:shadow-lg
                        active:scale-95 transition-all duration-200
                        ${canRight ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                >
                    <ChevronRight className="h-4 w-4 text-[#374151]" />
                </button>

                {/* Edge fade gradients (mobile only) */}
                {canLeft && <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white/80 to-transparent z-10" />}
                {canRight && <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/80 to-transparent z-10" />}
            </div>
        </div>
    )
}
