import { notFound } from 'next/navigation'
import { DesignSystemPage } from './design-system-client'

// Only accessible in development environment
export default function DesignSystemGate() {
    if (process.env.NODE_ENV === 'production') {
        notFound()
    }

    return <DesignSystemPage />
}
