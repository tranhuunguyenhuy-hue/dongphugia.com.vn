'use client'

import { useEffect, useRef, useState } from 'react'
import {
    ResponsiveMedia,
    type ResponsiveMediaProps,
} from '@/components/media/responsive-media'

export function DeferredResponsiveMedia(props: ResponsiveMediaProps) {
    const placeholderRef = useRef<HTMLSpanElement>(null)
    const [shouldLoad, setShouldLoad] = useState(false)

    useEffect(() => {
        const placeholder = placeholderRef.current
        if (!placeholder || !('IntersectionObserver' in window)) {
            queueMicrotask(() => setShouldLoad(true))
            return
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return
                setShouldLoad(true)
                observer.disconnect()
            },
            { rootMargin: '100px 0px' },
        )

        observer.observe(placeholder)
        return () => observer.disconnect()
    }, [])

    if (shouldLoad) return <ResponsiveMedia {...props} />

    return (
        <span
            ref={placeholderRef}
            className={props.className}
            style={props.style}
            aria-hidden="true"
        />
    )
}
