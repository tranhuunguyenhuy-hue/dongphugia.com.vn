'use client'

import { useEffect, useRef, useState } from 'react'
import { BrandLogo } from '@/components/media/brand-logo'

type DeferredBrandLogoProps = {
    slug: string
    name: string
    className?: string
}

export function DeferredBrandLogo({
    slug,
    name,
    className,
}: DeferredBrandLogoProps) {
    const boundaryRef = useRef<HTMLSpanElement>(null)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const boundary = boundaryRef.current
        if (!boundary || !('IntersectionObserver' in window)) {
            queueMicrotask(() => setIsVisible(true))
            return
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return
                setIsVisible(true)
                observer.disconnect()
            },
            { rootMargin: '50px' },
        )

        observer.observe(boundary)
        return () => observer.disconnect()
    }, [])

    return (
        <span ref={boundaryRef} className="flex h-full w-full items-center justify-center">
            {isVisible ? (
                <BrandLogo slug={slug} name={name} className={className} />
            ) : null}
        </span>
    )
}
