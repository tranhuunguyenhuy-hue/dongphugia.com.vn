"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { ResponsiveMedia } from "@/components/media/responsive-media"

type Banner = {
    id: number
    title?: string | null
    image_url: string
    link_url?: string | null
}

type HeroBannerProps = { banners: Banner[] }

// Standard banner aspect ratio: 16:9
const BANNER_WIDTH = 1600
const BANNER_HEIGHT = 900

/**
 * Hero banner carousel
 */
export function HeroBanner({ banners }: HeroBannerProps) {
    const items = banners.length > 0 ? banners : []
    const [current, setCurrent] = useState(0)
    const [isPaused, setIsPaused] = useState(false)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const goTo = useCallback((idx: number) => {
        setCurrent(idx)
    }, [])

    const next = useCallback(() => setCurrent(c => (c + 1) % items.length), [items.length])
    const prevSlide = useCallback(() => setCurrent(c => (c - 1 + items.length) % items.length), [items.length])

    // Auto-advance — pause on hover
    useEffect(() => {
        const prefersReducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches
        if (items.length <= 1 || isPaused || prefersReducedMotion) return
        timerRef.current = setInterval(next, 5000)
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [next, items.length, isPaused])

    if (items.length === 0) {
        return (
            <div className="relative w-full rounded-md shadow-md overflow-hidden bg-stone-50" style={{ aspectRatio: '16 / 9' }}>
                <ResponsiveMedia
                    src="/images/banner-1.jpg"
                    alt="Đông Phú Gia - Vật liệu xây dựng"
                    width={BANNER_WIDTH}
                    height={BANNER_HEIGHT}
                    className="w-full h-auto"
                    priority
                    sizes="100vw"
                />
            </div>
        )
    }

    return (
        <div
            className="relative w-full rounded-md shadow-md overflow-hidden bg-stone-50"
            style={{ aspectRatio: '16 / 9' }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onFocusCapture={() => setIsPaused(true)}
            onBlurCapture={() => setIsPaused(false)}
            aria-roledescription="carousel"
            aria-label="Banner nổi bật"
        >
            {(() => {
                const item = items[current]
                const image = (
                    <ResponsiveMedia
                        src={item.image_url}
                        alt={item.title || "Không gian vật liệu cao cấp Đông Phú Gia"}
                        width={BANNER_WIDTH}
                        height={BANNER_HEIGHT}
                        profile="hero"
                        className="h-full w-full object-cover"
                        priority={current === 0}
                        mobileWidth={720}
                        sizes="(max-width: 768px) 100vw, 1280px"
                    />
                )

                return (
                    <div
                        key={item.id}
                        className="relative h-full w-full"
                        role="group"
                        aria-roledescription="slide"
                        aria-label={`${current + 1} trên ${items.length}`}
                    >
                        {item.link_url ? (
                            <Link href={item.link_url} className="block h-full w-full">
                                {image}
                            </Link>
                        ) : image}
                    </div>
                )
            })()}

            {/* Prev / Next — 48px outline circular nav buttons */}
            {items.length > 1 && (
                <>
                    <button
                        onClick={prevSlide}
                        className="absolute left-3 lg:left-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full border border-border bg-white/50 hover:bg-white flex items-center justify-center transition-colors shadow-sm"
                        aria-label="Banner trước"
                    >
                        <ChevronLeft className="h-6 w-6 text-stone-900" strokeWidth={1.5} />
                    </button>
                    <button
                        onClick={next}
                        className="absolute right-3 lg:right-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full border border-border bg-white/50 hover:bg-white flex items-center justify-center transition-colors shadow-sm"
                        aria-label="Banner tiếp"
                    >
                        <ChevronRight className="h-6 w-6 text-stone-900" strokeWidth={1.5} />
                    </button>
                </>
            )}

            {/* Pill dots indicator */}
            {items.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
                    {items.map((item, i) => (
                        <button
                            key={item.id}
                            onClick={() => goTo(i)}
                            aria-label={`Xem banner ${i + 1}`}
                            aria-current={i === current ? 'true' : undefined}
                            className="flex size-11 items-center justify-center rounded-full"
                        >
                            <span
                                aria-hidden="true"
                                className={`h-2 rounded-full transition-all duration-300 ease-out ${
                                    i === current
                                        ? 'w-10 bg-white shadow'
                                        : 'w-2 bg-white/60'
                                }`}
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
