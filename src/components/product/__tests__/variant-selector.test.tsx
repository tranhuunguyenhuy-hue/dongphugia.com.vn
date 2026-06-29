import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { VariantSibling } from '@/lib/public-api-products'
import { VariantSelector } from '../variant-selector'

describe('VariantSelector', () => {
    it('keeps card order stable when selected variant changes in single-axis groups', () => {
        const siblings: VariantSibling[] = [
            {
                id: 1001,
                sku: 'VG541',
                name: 'Sen tắm nóng lạnh Viglacera VG541',
                slug: 'sen-tam-nong-lanh-viglacera-vg541-7274',
                price: 2_625_000,
                original_price: null,
                online_discount_amount: null,
                price_display: null,
                image_main_url: 'https://cdn.dongphugia.com.vn/migrated/viglacera/749dd4cae73e-vg541-3.jpg',
                is_active: true,
                variant_type: 'configuration',
                variant_label: 'Củ & tay sen',
                variant_options: [
                    { axis: 'config', label: 'Cấu hình', value: 'Củ & tay sen' },
                ],
                stock_status: 'in_stock',
                subcategories: { slug: 'sen-tam' },
                categories: { slug: 'thiet-bi-ve-sinh' },
                colors: { name: 'Vàng', hex_code: '#FFD700' },
            },
        ]

        const props = {
            currentSku: 'VG541.1',
            currentSlug: 'sen-cay-nong-lanh-viglacera-vg541-1-7270',
            currentName: 'Bộ sen tắm nóng lạnh Viglacera VG541.1 kèm thanh trượt',
            currentImageMainUrl: 'https://cdn.dongphugia.com.vn/migrated/viglacera/0e411045f4ad-vg541-1-avt.jpg',
            currentPriceDisplay: null,
            currentPrice: 3_885_000,
            currentOriginalPrice: null,
            currentColor: { name: 'Crom / Niken', hex_code: '#E8E9EB' },
            currentStockStatus: 'in_stock',
            currentVariantOptions: [
                { axis: 'config', label: 'Cấu hình', value: 'Củ, tay sen & thanh trượt' },
            ],
            variantAxes: [{ key: 'config', label: 'Cấu hình' }],
            variantType: 'configuration',
            variantLabel: 'Củ, tay sen & thanh trượt',
            variantGroup: 'VG541',
            siblings,
            categorySlug: 'thiet-bi-ve-sinh',
            subcategorySlug: 'sen-tam',
        }

        const { container, rerender } = render(
            <VariantSelector
                {...props}
                selectedSku="VG541.1"
            />
        )

        const getLabels = () =>
            Array.from(container.querySelectorAll('a span.line-clamp-1'))
                .map((node) => node.textContent?.trim())
                .filter(Boolean)

        expect(getLabels()).toEqual(['Củ, tay sen & thanh trượt', 'Củ & tay sen'])

        rerender(
            <VariantSelector
                {...props}
                selectedSku="VG541"
            />
        )

        expect(getLabels()).toEqual(['Củ, tay sen & thanh trượt', 'Củ & tay sen'])
    })
})
