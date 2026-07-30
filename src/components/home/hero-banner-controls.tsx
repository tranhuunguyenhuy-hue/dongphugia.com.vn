"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

type HeroBannerControlsProps = {
    carouselId: string
    itemCount: number
}

export function HeroBannerControls({
    carouselId,
    itemCount,
}: HeroBannerControlsProps) {
    const [current, setCurrent] = useState(0)
    const [isPaused, setIsPaused] = useState(false)

    const goTo = useCallback((index: number) => {
        setCurrent((index + itemCount) % itemCount)
    }, [itemCount])

    useEffect(() => {
        const carousel = document.getElementById(carouselId)
        if (!carousel) return

        carousel.querySelectorAll<HTMLElement>("[data-hero-slide]")
            .forEach((slide, index) => {
                const isCurrent = index === current
                slide.hidden = !isCurrent
                slide.setAttribute("aria-hidden", String(!isCurrent))
            })
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

    return (
        <>
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
