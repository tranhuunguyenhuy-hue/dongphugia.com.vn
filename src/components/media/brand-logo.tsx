import { cn } from '@/lib/utils'

const STATIC_BRAND_SLUGS = new Set([
    'american-standard',
    'ariston',
    'atmor',
    'caesar',
    'cotto',
    'coway',
    'dai-thanh',
    'duravit',
    'elica',
    'ferroli',
    'grohe',
    'hansgrohe',
    'inax',
    'kaff',
    'karofi',
    'kluger',
    'mitsubishi-cleansui',
    'moen',
    'mowoen',
    'panasonic',
    'philips',
    'rheem',
    'samsung',
    'toshiba',
    'toto',
    'unilever-pureit',
    'viglacera',
])

type BrandLogoProps = {
    slug: string
    name: string
    className?: string
    decorative?: boolean
}

export function BrandLogo({
    slug,
    name,
    className,
    decorative = false,
}: BrandLogoProps) {
    if (!STATIC_BRAND_SLUGS.has(slug)) {
        return (
            <span
                className={cn(
                    'line-clamp-2 text-center text-xs font-semibold text-stone-600',
                    className,
                )}
                aria-hidden={decorative || undefined}
            >
                {name}
            </span>
        )
    }

    return (
        // Brand assets are small, local and already compressed.
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={`/images/brands/${slug}.png`}
            alt={decorative ? '' : name}
            className={cn('object-contain', className)}
            loading="lazy"
            width={100}
            height={50}
        />
    )
}
