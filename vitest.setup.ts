import '@testing-library/jest-dom'
import { vi } from 'vitest'
import React from 'react'

// Mock next/image
vi.mock('next/image', () => ({
    default: (props: any) => {
        const { fill, unoptimized, priority, loader, blurDataURL, placeholder, ...rest } = props
        const normalizedProps = {
            ...rest,
            ...(placeholder ? { 'data-placeholder': placeholder } : {}),
            ...(fill ? { 'data-fill': 'true' } : {}),
            ...(unoptimized ? { 'data-unoptimized': 'true' } : {}),
            ...(priority ? { 'data-priority': 'true' } : {}),
            ...(blurDataURL ? { 'data-blur': blurDataURL } : {}),
        }

        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        return React.createElement('img', normalizedProps)
    },
}))

// Mock next/link
vi.mock('next/link', () => ({
    default: ({ children, href }: any) => {
        return React.createElement('a', { href }, children)
    },
}))

// Mock IntersectionObserver
class MockIntersectionObserver {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
}
if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'IntersectionObserver', {
        writable: true,
        configurable: true,
        value: MockIntersectionObserver
    })
}
