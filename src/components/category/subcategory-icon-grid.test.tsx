import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SubcategoryIconGrid } from './subcategory-icon-grid'

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe('SubcategoryIconGrid', () => {
    it('uses stable slug keys when snapshot entries have no database id', () => {
        vi.stubGlobal('ResizeObserver', class {
            observe() {}
            disconnect() {}
        })
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        render(
            <SubcategoryIconGrid
                basePath="/thiet-bi-bep"
                subcategories={[
                    { id: null, name: 'Vòi rửa chén', slug: 'voi-rua-chen', thumbnail_url: null, _count: { products: 4 } },
                    { id: null, name: 'Bếp từ', slug: 'bep-tu', thumbnail_url: null, _count: { products: 2 } },
                ]}
            />,
        )

        expect(screen.getAllByRole('link')).toHaveLength(2)
        const reactKeyWarnings = consoleError.mock.calls
            .flat()
            .filter((entry): entry is string => typeof entry === 'string')
            .filter((message) => /Each child in a list should have a unique|Encountered two children with the same key/.test(message))
        expect(reactKeyWarnings).toEqual([])
    })
})
