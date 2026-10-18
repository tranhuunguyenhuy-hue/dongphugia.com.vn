import Link from "next/link"
import type { PublicHomeBanner } from "@dpg/app-contracts"
import { HeroBannerControls } from "@/components/home/hero-banner-controls-lazy"

type HeroBannerProps = { banners: readonly PublicHomeBanner[] }

// Standard banner aspect ratio: 16:9
const BANNER_WIDTH = 1600
const BANNER_HEIGHT = 900
const CAROUSEL_ID = "homepage-hero-carousel"

/**
 * Server-render the hero media so its first paint does not depend on hydrating
 * the carousel. A small client control enhances these static slides afterward.
 */
export function HeroBanner({ banners }: HeroBannerProps) {
    const items = banners.length > 0 ? banners : []

    if (items.length === 0) {
        return (
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md bg-stone-50 shadow-md">
                <link
                    rel="preload"
                    as="image"
                    href="/images/banner-1.editorial.w960.webp"
                    type="image/webp"
                    fetchPriority="high"
                />
                <picture>
                    <source
                        type="image/webp"
                        srcSet="/images/banner-1.editorial.w640.webp 640w, /images/banner-1.editorial.w960.webp 960w"
                        sizes="(max-width: 767px) 100vw, 1280px"
                    />
                    <img
                        src="/images/banner-1.editorial.w960.webp"
                        alt="Đông Phú Gia - Vật liệu xây dựng"
                        width={BANNER_WIDTH}
                        height={BANNER_HEIGHT}
                        className="h-full w-full object-cover"
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                    />
                </picture>
            </div>
        )
    }

    return (
        <div
            id={CAROUSEL_ID}
            className="relative aspect-[16/9] w-full overflow-hidden rounded-md bg-stone-50 shadow-md"
            aria-roledescription="carousel"
            aria-label="Banner nổi bật"
        >
            {(() => {
                const item = items[0]
                const mobileImage =
                    item.mobileImageUrl ??
                    "/api/homepage-hero?width=720"
                const desktopImage =
                    item.desktopImageUrl ??
                    "/api/homepage-hero?width=1280"
                const desktopImage1600 =
                    item.desktopLargeImageUrl ??
                    "/api/homepage-hero?width=1600"
                const image = (
                    <>
                        <link
                            rel="preload"
                            as="image"
                            href={mobileImage}
                            type="image/webp"
                            media="(max-width: 767px)"
                            fetchPriority="high"
                        />
                        <link
                            rel="preload"
                            as="image"
                            href={desktopImage}
                            type="image/webp"
                            media="(min-width: 768px)"
                            fetchPriority="high"
                        />
                        <picture className="block h-full w-full">
                            <source
                                media="(max-width: 767px)"
                                type="image/webp"
                                srcSet={mobileImage}
                            />
                            <source
                                media="(min-width: 768px)"
                                type="image/webp"
                                srcSet={`${desktopImage} 1280w, ${desktopImage1600} 1600w`}
                                sizes="1280px"
                            />
                            <img
                                src={desktopImage}
                                alt={item.title || "Không gian vật liệu cao cấp Đông Phú Gia"}
                                width={BANNER_WIDTH}
                                height={BANNER_HEIGHT}
                                className="h-full w-full object-cover"
                                loading="eager"
                                fetchPriority="high"
                                decoding="async"
                            />
                        </picture>
                    </>
                )

                return (
                    <div
                        data-hero-initial-slide
                        className="absolute inset-0 h-full w-full"
                        role="group"
                        aria-roledescription="slide"
                        aria-label={`1 trên ${items.length}`}
                    >
                        {item.linkUrl ? (
                            <Link href={item.linkUrl} className="block h-full w-full">
                                {image}
                            </Link>
                        ) : image}
                    </div>
                )
            })()}

            {items.length > 1 ? (
                <HeroBannerControls
                    carouselId={CAROUSEL_ID}
                    banners={items}
                />
            ) : null}
        </div>
    )
}
