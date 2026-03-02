"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

type Banner = {
    id: number
    title?: string | null
    image_url: string
    link_url?: string | null
}

type HeroBannerProps = { banners: Banner[] }

export function HeroBanner({ banners }: HeroBannerProps) {
    const items = banners.length > 0 ? banners : []
    const [current, setCurrent] = useState(0)
    const [prev, setPrev] = useState<number | null>(null)
    const [isHovered, setIsHovered] = useState(false)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const goTo = useCallback((idx: number) => {
        setPrev(current)
        setCurrent(idx)
    }, [current])

    const next = useCallback(() => goTo((current + 1) % items.length), [goTo, current, items.length])
    const prevSlide = useCallback(() => goTo((current - 1 + items.length) % items.length), [goTo, current, items.length])

    // Auto-advance — pause on hover
    useEffect(() => {
        if (items.length <= 1 || isHovered) return
        timerRef.current = setInterval(next, 5000)
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [next, items.length, isHovered])

    // Empty state
    if (items.length === 0) {
        return (
            <div
                className="relative flex-1 min-w-0 aspect-[954/477] rounded-[24px] overflow-hidden shadow-[0_4px_24px_rgba(16,24,40,0.10)]"
                style={{ background: "linear-gradient(135deg, #14532d 0%, #15803d 40%, #22c55e 100%)" }}
            >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8 text-center">
                    <p className="text-white/70 text-[15px] font-medium tracking-wide uppercase">
                        Vật liệu xây dựng cao cấp tại Lâm Đồng
                    </p>
                    <h2 className="text-white font-bold text-4xl md:text-5xl leading-tight max-w-xl">
                        Không gian đẹp bắt đầu từ{" "}
                        <span className="text-[#bbf7d0]">vật liệu chất lượng</span>
                    </h2>
                    <a
                        href="/gach-op-lat"
                        className="inline-flex items-center gap-2 bg-white text-[#15803d] font-semibold px-7 py-3 rounded-full text-[15px] hover:bg-[#f0fdf4] transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                    >
                        Xem sản phẩm →
                    </a>
                </div>
                {/* Decorative blobs */}
                <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/5 blur-2xl" />
                <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-white/5 blur-xl" />
            </div>
        )
    }

    const banner = items[current]

    return (
        <div
            className="relative flex-1 min-w-0 aspect-[954/477] rounded-[24px] overflow-hidden shadow-[0_4px_24px_rgba(16,24,40,0.10)]"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Slides — cross-fade */}
            {items.map((item, i) => {
                const isActive = i === current
                return (
                    <div
                        key={item.id}
                        className="absolute inset-0 transition-opacity duration-700 ease-in-out"
                        style={{ opacity: isActive ? 1 : 0, zIndex: isActive ? 1 : 0 }}
                        aria-hidden={!isActive}
                    >
                        {item.link_url ? (
                            <Link href={item.link_url} className="block absolute inset-0">
                                <Image
                                    src={item.image_url}
                                    alt={item.title || "Banner"}
                                    fill
                                    className="object-cover"
                                    priority={i === 0}
                                    sizes="(max-width: 1024px) 100vw, 954px"
                                />
                            </Link>
                        ) : (
                            <div className="absolute inset-0">
                                <Image
                                    src={item.image_url}
                                    alt={item.title || "Banner"}
                                    fill
                                    className="object-cover"
                                    priority={i === 0}
                                    sizes="(max-width: 1024px) 100vw, 954px"
                                />
                            </div>
                        )}
                    </div>
                )
            })}

            {/* Prev / Next — 44px touch targets */}
            {items.length > 1 && (
                <>
                    <button
                        onClick={prevSlide}
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/80 hover:bg-white backdrop-blur-sm flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-1/2 active:scale-90"
                        aria-label="Banner trước"
                    >
                        <ChevronLeft className="h-5 w-5 text-[#111827]" />
                    </button>
                    <button
                        onClick={next}
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/80 hover:bg-white backdrop-blur-sm flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200 hover:translate-x-0.5 hover:-translate-y-1/2 active:scale-90"
                        aria-label="Banner tiếp"
                    >
                        <ChevronRight className="h-5 w-5 text-[#111827]" />
                    </button>
                </>
            )}

            {/* Pill dots indicator */}
            {items.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
                    {items.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => goTo(i)}
                            aria-label={`Slide ${i + 1}`}
                            className={`h-2 rounded-full transition-all duration-400 ease-out
                                ${i === current
                                    ? "w-10 bg-white shadow"
                                    : "w-2 bg-white/50 hover:bg-white/80"
                                }`}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
