"use client"

import dynamic from "next/dynamic"

const HeroBannerControls = dynamic(
    () => import("@/components/home/hero-banner-controls").then((mod) => mod.HeroBannerControls),
    { ssr: false },
)

export { HeroBannerControls }
