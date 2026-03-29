"use client"

import { useEffect, useRef } from "react"
import Image from "next/image"

// Partner brand data - will be replaced by DB images in the future
const BRANDS = [
    { name: "TOTO", logoText: "TOTO", logoUrl: "/images/brands/toto.png" },
    { name: "INAX", logoText: "INAX", logoUrl: "/images/brands/inax.png" },
    { name: "Caesar", logoText: "CAESAR", logoUrl: "/images/brands/caesar.png" },
    { name: "Viglacera", logoText: "VIGLACERA", logoUrl: "/images/brands/viglacera.png" },
    { name: "Hafele", logoText: "HÄFELE", logoUrl: "/images/brands/hafele.png" },
    { name: "Bosch", logoText: "BOSCH", logoUrl: "/images/brands/bosch.png" },
    { name: "Cotto", logoText: "COTTO", logoUrl: "/images/brands/cotto.png" },
    { name: "Jomoo", logoText: "JOMOO" },
    { name: "American Standard", logoText: "AMERICAN STD", logoUrl: "/images/brands/american-standard.png" },
    { name: "Kohler", logoText: "KOHLER" },
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
    const allBrands = [...BRANDS, ...BRANDS]

    return (
        <section className="w-full py-6 lg:py-8 overflow-hidden" aria-label="Đối tác thương hiệu">
            {/* Section label */}
            <p className="text-center text-[13px] font-medium text-[#88A3AE] uppercase tracking-[0.2em] mb-6">
                Đối tác thương hiệu hàng đầu
            </p>

            {/* Marquee container */}
            <div className="relative">
                {/* Fade edges */}
                <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-r from-[#F5F9FB] to-transparent z-10 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-l from-[#F5F9FB] to-transparent z-10 pointer-events-none" />

                {/* Scrolling track */}
                <div
                    ref={scrollRef}
                    className="flex items-center gap-12 lg:gap-16 animate-marquee"
                    style={{ width: "max-content" }}
                >
                    {allBrands.map((brand, i) => (
                        <div
                            key={`${brand.name}-${i}`}
                            className="shrink-0 flex items-center justify-center h-12 px-4 opacity-40 hover:opacity-100 transition-opacity duration-300 cursor-default select-none"
                        >
                            {brand.logoUrl ? (
                                <Image
                                    src={brand.logoUrl}
                                    alt={`${brand.name} logo`}
                                    width={212}
                                    height={116}
                                    className="object-contain h-8 lg:h-10 w-auto"
                                />
                            ) : (
                                <span className="text-[17px] lg:text-[19px] font-bold text-[#3C4E56] tracking-[0.15em] whitespace-nowrap">
                                    {brand.logoText}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
