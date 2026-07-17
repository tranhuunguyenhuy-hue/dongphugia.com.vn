'use client'

import { usePathname } from 'next/navigation'
import { useReportWebVitals } from 'next/web-vitals'

export function WebVitalsReporter() {
    const pathname = usePathname()

    useReportWebVitals((metric) => {
        const dataLayer = (
            window as Window & {
                dataLayer?: Array<Record<string, string | number>>
            }
        ).dataLayer
        if (!dataLayer) return

        dataLayer.push({
            event: 'web_vital',
            metric_name: metric.name,
            metric_id: metric.id,
            metric_value: metric.value,
            metric_rating: metric.rating,
            page_path: pathname,
            navigation_type: metric.navigationType,
        })
    })

    return null
}
