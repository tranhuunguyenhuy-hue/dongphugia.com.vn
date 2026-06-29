import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProductVariantMetaPills } from '../product-variant-meta-pills'

describe('ProductVariantMetaPills', () => {
    it('prefers color from variant_options over legacy product.colors on first render', () => {
        render(
            <ProductVariantMetaPills
                initialSku="VG598.2"
                initialColor={{ name: 'Đen Bóng', hex_code: '#000000' }}
                initialVariantOptions={[
                    { axis: 'config', value: 'Nóng lạnh - Không vòi xả bồn' },
                    { axis: 'color', value: 'Chrome' },
                ]}
            />
        )

        expect(screen.getByText('Chrome')).toBeInTheDocument()
        expect(screen.queryByText('Đen Bóng')).not.toBeInTheDocument()
        expect(screen.getByText('VG598.2')).toBeInTheDocument()
    })

    it('updates SKU and keeps variant_options color as the source of truth after selection events', () => {
        render(
            <ProductVariantMetaPills
                initialSku="VG598.2"
                initialColor={{ name: 'Đen Bóng', hex_code: '#000000' }}
                initialVariantOptions={[
                    { axis: 'config', value: 'Nóng lạnh - Không vòi xả bồn' },
                    { axis: 'color', value: 'Chrome' },
                ]}
            />
        )

        act(() => {
            window.dispatchEvent(new CustomEvent('product-variant-selection', {
                detail: {
                    sku: 'VG598.2-Den',
                    color: 'Đen Bóng',
                    variantOptions: [
                        { axis: 'config', value: 'Nóng lạnh - Không vòi xả bồn' },
                        { axis: 'color', value: 'Đen' },
                    ],
                },
            }))
        })

        expect(screen.getByText('VG598.2-Den')).toBeInTheDocument()
        expect(screen.getByText('Đen')).toBeInTheDocument()
        expect(screen.queryByText('Đen Bóng')).not.toBeInTheDocument()
    })
})
