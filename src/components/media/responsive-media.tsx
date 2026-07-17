import type { ImgHTMLAttributes } from 'react'
import {
    createResponsiveSrcSet,
    type MediaProfile,
} from '@/lib/media/media-profiles'

export interface ResponsiveMediaProps
    extends Omit<
        ImgHTMLAttributes<HTMLImageElement>,
        'src' | 'srcSet' | 'width' | 'height'
    > {
    src: string
    alt: string
    profile?: MediaProfile
    width?: number
    height?: number
    fill?: boolean
    priority?: boolean
}

export function ResponsiveMedia({
    src,
    alt,
    profile,
    width,
    height,
    fill = false,
    priority = false,
    sizes = '100vw',
    className,
    style,
    loading,
    ...props
}: ResponsiveMediaProps) {
    const srcSet = createResponsiveSrcSet(src, profile)
    const imageStyle = fill
        ? { ...style, position: 'absolute' as const, inset: 0 }
        : style

    return (
        <picture>
            {srcSet ? (
                <source type="image/webp" srcSet={srcSet} sizes={sizes} />
            ) : null}
            <img
                {...props}
                src={src}
                srcSet={srcSet}
                sizes={sizes}
                alt={alt}
                width={fill ? undefined : width}
                height={fill ? undefined : height}
                className={className}
                style={imageStyle}
                loading={priority ? 'eager' : (loading ?? 'lazy')}
                fetchPriority={priority ? 'high' : props.fetchPriority}
                decoding={priority ? 'sync' : (props.decoding ?? 'async')}
            />
        </picture>
    )
}
