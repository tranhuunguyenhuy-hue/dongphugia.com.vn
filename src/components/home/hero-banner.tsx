"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
    createResponsiveMediaUrl,
    createResponsiveSrcSet,
} from "@/lib/media/media-profiles"

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
        if (
            items.length <= 1 ||
            isPaused ||
            prefersReducedMotion
        ) return
        timerRef.current = setInterval(next, 5000)
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [next, items.length, isPaused])

    if (items.length === 0) {
        return (
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md bg-stone-50 shadow-md">
                <img
                    src="/images/banner-1.jpg"
                    alt="Đông Phú Gia - Vật liệu xây dựng"
                    width={BANNER_WIDTH}
                    height={BANNER_HEIGHT}
                    className="h-full w-full object-cover"
                    loading="eager"
                    fetchPriority="high"
                />
            </div>
        )
    }

    return (
        <div
            className="relative aspect-[16/9] w-full overflow-hidden rounded-md bg-stone-50 shadow-md"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onFocusCapture={() => setIsPaused(true)}
            onBlurCapture={() => setIsPaused(false)}
            aria-roledescription="carousel"
            aria-label="Banner nổi bật"
        >
            {(() => {
                const item = items[current]
                const responsiveSrcSet = createResponsiveSrcSet(
                    item.image_url,
                    'hero',
                )
                const image = (
                    <picture className="block h-full w-full">
                        {responsiveSrcSet ? (
                            <>
                                <source
                                    media="(max-width: 767px)"
                                    type="image/webp"
                                    srcSet={createResponsiveMediaUrl(
                                        item.image_url,
                                        720,
                                    )}
                                />
                                <source
                                    media="(min-width: 768px)"
                                    type="image/webp"
                                    srcSet={responsiveSrcSet}
                                    sizes="1280px"
                                />
                            </>
                        ) : null}
                        <img
                            src={item.image_url}
                            alt={item.title || "Không gian vật liệu cao cấp Đông Phú Gia"}
                            width={BANNER_WIDTH}
                            height={BANNER_HEIGHT}
                            className="h-full w-full object-cover"
                            loading={current === 0 ? 'eager' : 'lazy'}
                            fetchPriority={current === 0 ? 'high' : 'auto'}
                            decoding={current === 0 ? 'sync' : 'async'}
                        />
                    </picture>
                )

                return (
                    <div
                        key={item.id}
                        className="absolute inset-0 h-full w-full"
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
                        className="absolute left-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/50 shadow-sm transition-colors hover:bg-white lg:left-6"
                        aria-label="Banner trước"
                    >
                        <ChevronLeft className="h-6 w-6 text-stone-900" strokeWidth={1.5} />
                    </button>
                    <button
                        onClick={next}
                        className="absolute right-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/50 shadow-sm transition-colors hover:bg-white lg:right-6"
                        aria-label="Banner tiếp"
                    >
                        <ChevronRight className="h-6 w-6 text-stone-900" strokeWidth={1.5} />
                    </button>
                </>
            )}

            {/* Pill dots indicator */}
            {items.length > 1 && (
                <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 sm:bottom-4 sm:gap-2">
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
