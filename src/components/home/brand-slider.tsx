"use client"

import { useEffect, useRef } from "react"

const BRAND_SLUGS = [
    'toto', 'inax', 'caesar', 'american-standard', 'grohe', 'cotto', 'viglacera',
    'hansgrohe', 'duravit', 'moen', 'mowoen', 'kluger', 'atmor',
    'elica', 'kaff', 'samsung', 'panasonic', 'toshiba',
    'ariston', 'ferroli', 'rheem', 'karofi', 'mitsubishi-cleansui', 
    'unilever-pureit', 'dai-thanh', 'coway', 'philips'
]

export function BrandSlider() {
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return

        // Pause on hover
        const pause = () => el.style.animationPlayState = "paused"
        const resume = () => el.style.animationPlayState = "running"

        el.addEventListener("mouseenter", pause)
        el.addEventListener("mouseleave", resume)
        return () => {
            el.removeEventListener("mouseenter", pause)
            el.removeEventListener("mouseleave", resume)
        }
    }, [])

    // Duplicate brands for seamless loop
    const allBrands = [...BRAND_SLUGS, ...BRAND_SLUGS]

    return (
        <section className="w-full py-8 lg:py-10 overflow-hidden" aria-label="Đối tác thương hiệu">
            {/* Section label */}
            <p className="text-center text-[13px] uppercase tracking-widest font-semibold text-stone-400 mb-8 w-full">
                Được hơn 30 đối tác toàn cầu tin tưởng
            </p>

            {/* Marquee container */}
            <div className="relative group/slider">
                {/* Fade edges */}
                <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

                {/* Scrolling track */}
                <div
                    ref={scrollRef}
                    className="flex items-center gap-8 lg:gap-12 animate-marquee"
                    style={{ width: "max-content" }}
                >
                    {allBrands.map((slug, i) => (
                        <div
                            key={`${slug}-${i}`}
                            className="shrink-0 flex items-center justify-center w-[120px] h-[60px] lg:w-[140px] lg:h-[80px] relative transition-all duration-300 transform hover:scale-105 group/brand"
                        >
                            <img
                                src={`/images/brands/${slug}.png`}
                                alt={`Thương hiệu ${slug}`}
                                className="max-w-[80px] max-h-[40px] lg:max-w-[100px] lg:max-h-[50px] object-contain grayscale opacity-40 group-hover/brand:grayscale-0 group-hover/brand:opacity-100 transition-all duration-300"
                                loading="lazy"
                                onError={(e) => {
                                    const target = e.currentTarget;
                                    if (target.src.endsWith('.png')) {
                                        target.src = `/images/brands/${slug}.svg`;
                                    } else {
                                        target.style.display = 'none';
                                    }
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
