import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandLogo } from './brand-logo'

describe('BrandLogo', () => {
    it('uses a text fallback when a local logo is unavailable', () => {
        render(<BrandLogo slug="inax" name="INAX" />)

        fireEvent.error(screen.getByRole('img', { name: 'INAX' }))

        expect(screen.getByText('INAX')).toBeVisible()
        expect(screen.queryByRole('img', { name: 'INAX' })).not.toBeInTheDocument()
    })

    it('does not request an asset for an unknown brand', () => {
        render(<BrandLogo slug="missing-brand" name="Nhãn hiệu thử nghiệm" />)
        expect(screen.getByText('Nhãn hiệu thử nghiệm')).toBeVisible()
        expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })
})
