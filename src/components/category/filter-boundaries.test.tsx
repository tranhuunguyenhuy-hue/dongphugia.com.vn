import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(),
}))

vi.mock('./advanced-sidebar-filter', () => ({
    AdvancedSidebarFilter: () => <div data-testid="advanced-filter">Advanced filter loaded</div>,
}))

import { CategoryMobileFilter } from './category-mobile-filter'
import { DesktopAdvancedSidebarFilter } from './desktop-advanced-sidebar-filter'

const availableFilters = {
    subcategories: [],
    brands: [],
    materials: [],
    origins: [],
    features: [],
    colors: [],
}

function setViewport(matches: boolean) {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(() => ({
            matches,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        })),
    })
}

describe('advanced filter client boundaries', () => {
    beforeEach(() => setViewport(false))

    it('does not load the desktop filter implementation on mobile', () => {
        render(<DesktopAdvancedSidebarFilter availableFilters={availableFilters} />)

        expect(screen.queryByTestId('advanced-filter')).not.toBeInTheDocument()
    })

    it('loads the desktop filter implementation after desktop media query matches', async () => {
        setViewport(true)
        render(<DesktopAdvancedSidebarFilter availableFilters={availableFilters} />)

        expect(await screen.findByTestId('advanced-filter')).toBeVisible()
    })

    it('loads the mobile filter implementation only after opening the sheet', async () => {
        render(<CategoryMobileFilter availableFilters={availableFilters} />)

        expect(screen.queryByTestId('advanced-filter')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /bộ lọc/i }))
        expect(await screen.findByTestId('advanced-filter')).toBeVisible()
    })
})
