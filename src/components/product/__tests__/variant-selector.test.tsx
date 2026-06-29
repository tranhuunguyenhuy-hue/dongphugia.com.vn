import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
        expect(screen.getByText('Cấu hình')).toBeInTheDocument()

        rerender(
            <VariantSelector
                {...props}
                selectedSku="VG541"
            />
        )

        expect(getLabels()).toEqual(['Củ, tay sen & thanh trượt', 'Củ & tay sen'])
    })

    it('keeps multi-axis selector working when current variant_options are missing', () => {
        const onPreviewVariant = vi.fn()
        const siblings: VariantSibling[] = [
            {
                id: 2001,
                sku: 'VG598.2-Den',
                name: 'Sen cây nóng lạnh Viglacera VG598.2',
                slug: 'sen-cay-nong-lanh-viglacera-vg598-2-17590-den-vg598-2-den',
                price: 9_550_000,
                original_price: null,
                online_discount_amount: null,
                price_display: null,
                image_main_url: 'https://cdn.dongphugia.com.vn/migrated/viglacera/vg598-2-den.jpg',
                is_active: false,
                variant_type: 'configuration',
                variant_label: 'Đen',
                variant_options: [
                    { axis: 'config', label: 'Cấu hình', value: 'Nóng lạnh - Không vòi xả bồn' },
                    { axis: 'color', label: 'Màu sắc', value: 'Đen' },
                ],
                stock_status: 'in_stock',
                subcategories: { slug: 'sen-tam' },
                categories: { slug: 'thiet-bi-ve-sinh' },
                colors: { name: 'Đen', hex_code: '#111111' },
            },
            {
                id: 2002,
                sku: 'VG598.1',
                name: 'Sen cây tắm đứng nhiệt độ Viglacera VG598.1',
                slug: 'sen-cay-tam-dung-nhiet-do-viglacera-vg598-1-17225',
                price: 11_900_000,
                original_price: null,
                online_discount_amount: null,
                price_display: null,
                image_main_url: 'https://cdn.dongphugia.com.vn/migrated/viglacera/vg598-1.jpg',
                is_active: true,
                variant_type: 'configuration',
                variant_label: 'Nhiệt độ - Có vòi xả bồn',
                variant_options: [
                    { axis: 'config', label: 'Cấu hình', value: 'Nhiệt độ - Có vòi xả bồn' },
                    { axis: 'color', label: 'Màu sắc', value: 'Chrome' },
                ],
                stock_status: 'in_stock',
                subcategories: { slug: 'sen-tam' },
                categories: { slug: 'thiet-bi-ve-sinh' },
                colors: { name: 'Chrome', hex_code: '#E8E9EB' },
            },
        ]

        render(
            <VariantSelector
                currentSku="VG598.2"
                currentSlug="sen-cay-nong-lanh-viglacera-vg598-2-17590"
                currentName="Sen cây nóng lạnh Viglacera VG598.2"
                currentImageMainUrl="https://cdn.dongphugia.com.vn/migrated/viglacera/vg598-2-crom.jpg"
                currentPriceDisplay={null}
                currentPrice={9_550_000}
                currentOriginalPrice={null}
                currentColor={{ name: 'Chrome', hex_code: '#E8E9EB' }}
                currentStockStatus="in_stock"
                currentVariantOptions={[]}
                variantAxes={[
                    { key: 'config', label: 'Cấu hình' },
                    { key: 'color', label: 'Màu sắc' },
                ]}
                selectedSku="VG598.2"
                onPreviewVariant={onPreviewVariant}
                variantType="configuration"
                variantLabel="Nóng lạnh - Không vòi xả bồn"
                variantGroup="VG598"
                siblings={siblings}
                categorySlug="thiet-bi-ve-sinh"
                subcategorySlug="sen-tam"
            />
        )

        expect(screen.getByText('Cấu hình')).toBeInTheDocument()
        expect(screen.getByText('Màu sắc')).toBeInTheDocument()
        expect(screen.getByText('Nóng lạnh - Không vòi xả bồn')).toBeInTheDocument()
        expect(screen.getByText('Nhiệt độ - Có vòi xả bồn')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Đen/i }))

        expect(onPreviewVariant).toHaveBeenCalledWith(
            expect.objectContaining({
                sku: 'VG598.2-Den',
            })
        )
    })
})
