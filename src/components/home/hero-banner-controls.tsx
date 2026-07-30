"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
    createResponsiveMediaUrl,
    createResponsiveSrcSet,
} from "@/lib/media/media-profiles"

type HeroBannerControlsProps = {
    carouselId: string
    banners: Array<{
        id: number
        title?: string | null
        image_url: string
        link_url?: string | null
    }>
}

export function HeroBannerControls({
    carouselId,
    banners,
}: HeroBannerControlsProps) {
    const itemCount = banners.length
    const [current, setCurrent] = useState(0)
    const [isPaused, setIsPaused] = useState(false)

    const goTo = useCallback((index: number) => {
        setCurrent((index + itemCount) % itemCount)
    }, [itemCount])

    useEffect(() => {
        const carousel = document.getElementById(carouselId)
        if (!carousel) return

        const initialSlide = carousel.querySelector<HTMLElement>(
            "[data-hero-initial-slide]",
        )
        if (!initialSlide) return

        initialSlide.hidden = current !== 0
        initialSlide.setAttribute("aria-hidden", String(current !== 0))
    }, [carouselId, current])

    useEffect(() => {
        const carousel = document.getElementById(carouselId)
        if (!carousel) return

        const pause = () => setIsPaused(true)
        const resume = () => setIsPaused(false)
        carousel.addEventListener("mouseenter", pause)
        carousel.addEventListener("mouseleave", resume)
        carousel.addEventListener("focusin", pause)
        carousel.addEventListener("focusout", resume)

        return () => {
            carousel.removeEventListener("mouseenter", pause)
            carousel.removeEventListener("mouseleave", resume)
            carousel.removeEventListener("focusin", pause)
            carousel.removeEventListener("focusout", resume)
        }
    }, [carouselId])

    useEffect(() => {
        if (
            isPaused ||
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) return

        const timer = window.setInterval(() => {
            setCurrent((index) => (index + 1) % itemCount)
        }, 5000)

        return () => window.clearInterval(timer)
    }, [isPaused, itemCount])

    const item = banners[current]
    const responsiveSrcSet = current > 0
        ? createResponsiveSrcSet(item.image_url, "hero")
        : null
    const replacementImage = current > 0 ? (
        <picture className="block h-full w-full">
            {responsiveSrcSet ? (
                <>
                    <source
                        media="(max-width: 767px)"
                        type="image/webp"
                        srcSet={createResponsiveMediaUrl(item.image_url, 720)}
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
                width={1600}
                height={900}
                className="h-full w-full object-cover"
                loading="eager"
                decoding="async"
            />
        </picture>
    ) : null

    return (
        <>
            {current > 0 ? (
                <div
                    className="absolute inset-0 h-full w-full"
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${current + 1} trên ${itemCount}`}
                >
                    {item.link_url ? (
                        <Link href={item.link_url} className="block h-full w-full">
                            {replacementImage}
                        </Link>
                    ) : replacementImage}
                </div>
            ) : null}

            <button
                type="button"
                onClick={() => goTo(current - 1)}
                className="absolute left-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/50 shadow-sm transition-colors hover:bg-white lg:left-6"
                aria-label="Banner trước"
            >
                <ChevronLeft className="h-6 w-6 text-stone-900" strokeWidth={1.5} />
            </button>
            <button
                type="button"
                onClick={() => goTo(current + 1)}
                className="absolute right-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/50 shadow-sm transition-colors hover:bg-white lg:right-6"
                aria-label="Banner tiếp"
            >
                <ChevronRight className="h-6 w-6 text-stone-900" strokeWidth={1.5} />
            </button>

            <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 sm:bottom-4 sm:gap-2">
                {Array.from({ length: itemCount }, (_, index) => (
                    <button
                        type="button"
                        key={index}
                        onClick={() => goTo(index)}
                        aria-label={`Xem banner ${index + 1}`}
                        aria-current={index === current ? "true" : undefined}
                        className="flex size-11 items-center justify-center rounded-full"
                    >
                        <span
                            aria-hidden="true"
                            className={`h-2 rounded-full transition-all duration-300 ease-out ${
                                index === current
                                    ? "w-10 bg-white shadow"
                                    : "w-2 bg-white/60"
                            }`}
                        />
                    </button>
                ))}
            </div>
        </>
    )
}
