import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandBadge } from './brand-badge'

describe('BrandBadge', () => {
    it('renders the text fallback directly for a brand without a local logo', () => {
        render(<BrandBadge brand={{ name: 'STG Demo Sanitary Brand', slug: 'stg-demo-sanitary-brand' }} />)

        expect(screen.getByText('STG Demo Sanitary Brand')).toBeVisible()
        expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('keeps a valid local logo for a known brand', () => {
        render(<BrandBadge brand={{ name: 'INAX', slug: 'inax' }} />)

        expect(screen.getByRole('img', { name: 'INAX' })).toHaveAttribute('src', '/images/brands/inax.png')
    })
})
