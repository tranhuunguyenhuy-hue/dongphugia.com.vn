'use client'

import { lazy, Suspense, useEffect, useState } from 'react'
import type { ComponentProps } from 'react'
import type { AdvancedSidebarFilter } from './advanced-sidebar-filter'

const LazyAdvancedSidebarFilter = lazy(() =>
    import('./advanced-sidebar-filter').then((module) => ({
        default: module.AdvancedSidebarFilter,
    })),
)

type DesktopAdvancedSidebarFilterProps = ComponentProps<typeof AdvancedSidebarFilter>

function useDesktopMediaQuery() {
    const [isDesktop, setIsDesktop] = useState(false)

    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 1024px)')
        const update = () => setIsDesktop(mediaQuery.matches)

        update()
        mediaQuery.addEventListener('change', update)
        return () => mediaQuery.removeEventListener('change', update)
    }, [])

    return isDesktop
}

export function DesktopAdvancedSidebarFilter(props: DesktopAdvancedSidebarFilterProps) {
    const isDesktop = useDesktopMediaQuery()

    if (!isDesktop) return null

    return (
        <Suspense fallback={<div className="h-96 bg-neutral-100 animate-pulse rounded-lg" aria-hidden="true" />}>
            <LazyAdvancedSidebarFilter {...props} />
        </Suspense>
    )
}
