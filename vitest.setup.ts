import '@testing-library/jest-dom'
import { vi } from 'vitest'
import React from 'react'

// Mock next/image
vi.mock('next/image', () => ({
    default: (props: any) => {
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        return React.createElement('img', props)
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
Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver
})
