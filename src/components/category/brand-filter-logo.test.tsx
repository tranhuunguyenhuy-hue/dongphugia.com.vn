import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BrandTag } from './category-filter-panel'
import { BrandTagChip } from './advanced-sidebar-filter'

const FALLBACK_NAME = 'STG Demo Sanitary Brand'
const UNKNOWN_SLUG = 'stg-demo-sanitary-brand'

describe('category brand filters', () => {
    it.each([
        ['category filter panel', () => (
            <BrandTag
                brand={{ id: 1, name: FALLBACK_NAME, slug: UNKNOWN_SLUG }}
                active={false}
                onToggle={vi.fn()}
            />
        )],
        ['advanced sidebar', () => (
            <BrandTagChip slug={UNKNOWN_SLUG} name={FALLBACK_NAME} active={false} onClick={vi.fn()} />
        )],
    ])('renders direct text fallback for an unknown logo in the %s', (_label, element) => {
        render(element())

        expect(screen.getByText(FALLBACK_NAME)).toBeVisible()
        expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it.each([
        ['category filter panel', () => (
            <BrandTag brand={{ id: 1, name: 'INAX', slug: 'inax' }} active={false} onToggle={vi.fn()} />
        )],
        ['advanced sidebar', () => (
            <BrandTagChip slug="inax" name="INAX" active={false} onClick={vi.fn()} />
        )],
    ])('keeps the valid local logo in the %s', (_label, element) => {
        render(element())

        expect(screen.getByRole('img', { name: 'INAX' })).toHaveAttribute('src', '/images/brands/inax.png')
    })

    it('preserves category filter clicks', () => {
        const onToggle = vi.fn()
        render(<BrandTag brand={{ id: 1, name: FALLBACK_NAME, slug: UNKNOWN_SLUG }} active={false} onToggle={onToggle} />)

        fireEvent.click(screen.getByRole('button', { name: FALLBACK_NAME }))
        expect(onToggle).toHaveBeenCalledOnce()
    })
})
