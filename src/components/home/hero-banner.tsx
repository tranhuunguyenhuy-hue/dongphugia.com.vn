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

// Standard banner aspect ratio: 1024:479 ≈ 2.14:1
// All banner images should follow this proportion for consistency
const BANNER_WIDTH = 1920
const BANNER_HEIGHT = 898 // 1920 / (1024/479) ≈ 898

/**
 * Hero banner carousel — preserves original image aspect ratio.
 * Container scales responsively while keeping the full image visible (no crop).
 */
export function HeroBanner({ banners }: HeroBannerProps) {
    const items = banners.length > 0 ? banners : []
    const [current, setCurrent] = useState(0)
    const [isHovered, setIsHovered] = useState(false)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const goTo = useCallback((idx: number) => {
        setCurrent(idx)
    }, [])

    const next = useCallback(() => setCurrent(c => (c + 1) % items.length), [items.length])
    const prevSlide = useCallback(() => setCurrent(c => (c - 1 + items.length) % items.length), [items.length])

    // Auto-advance — pause on hover
    useEffect(() => {
        if (items.length <= 1 || isHovered) return
        timerRef.current = setInterval(next, 5000)
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [next, items.length, isHovered])

    // Empty state — fallback banner
    if (items.length === 0) {
        return (
            <div className="relative w-full rounded-[var(--radius-hero)] overflow-hidden bg-neutral-100">
                <Image
                    src="/images/hero-banner-inax.jpg"
                    alt="Đông Phú Gia - Thiết bị vệ sinh INAX cao cấp"
                    width={BANNER_WIDTH}
                    height={BANNER_HEIGHT}
                    className="w-full h-auto"
                    priority
                    quality={100}
                    sizes="100vw"
                    unoptimized
                />
            </div>
        )
    }

    return (
        <div
            className="relative w-full rounded-[var(--radius-hero)] overflow-hidden bg-neutral-100"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Slides — cross-fade, each slide preserves image ratio */}
            {items.map((item, i) => {
                const isActive = i === current
                const imageEl = (
                    <Image
                        src={item.image_url}
                        alt={item.title || "Banner Đông Phú Gia"}
                        width={BANNER_WIDTH}
                        height={BANNER_HEIGHT}
                        className={`w-full h-auto transition-opacity duration-700 ease-in-out ${isActive ? "opacity-100" : "opacity-0"}`}
                        priority={i === 0}
                        quality={100}
                        sizes="100vw"
                        unoptimized
                    />
                )

                return (
                    <div
                        key={item.id}
                        className={i === 0 ? "relative" : "absolute inset-0"}
                        style={{ zIndex: isActive ? 1 : 0 }}
                        aria-hidden={!isActive}
                    >
                        {item.link_url ? (
                            <Link href={item.link_url} className="block">
                                {imageEl}
                            </Link>
                        ) : (
                            imageEl
                        )}
                    </div>
                )
            })}

            {/* Prev / Next — 44px touch targets */}
            {items.length > 1 && (
                <>
                    <button
                        onClick={prevSlide}
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/80 hover:bg-white backdrop-blur-sm flex items-center justify-center transition-all duration-200 active:scale-90"
                        aria-label="Banner trước"
                    >
                        <ChevronLeft className="h-5 w-5 text-[#192125]" />
                    </button>
                    <button
                        onClick={next}
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/80 hover:bg-white backdrop-blur-sm flex items-center justify-center transition-all duration-200 active:scale-90"
                        aria-label="Banner tiếp"
                    >
                        <ChevronRight className="h-5 w-5 text-[#192125]" />
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
