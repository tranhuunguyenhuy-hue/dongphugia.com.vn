import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProductCard } from '@/components/ui/product-card'

describe('ProductCard', () => {
    it('prefers variant_options color over legacy product.colors on listing cards', () => {
        render(
            <ProductCard
                basePath="/thiet-bi-ve-sinh"
                product={{
                    name: 'Sen cây nóng lạnh Viglacera VG598.2',
                    slug: 'sen-cay-nong-lanh-viglacera-vg598-2-17590',
                    sku: 'VG598.2',
                    price: 9550000,
                    original_price: null,
                    online_discount_amount: null,
                    price_display: null,
                    image_main_url: 'https://cdn.dongphugia.com.vn/migrated/viglacera/23612d09723a-vg598-2-crom.jpg',
                    stock_status: 'in_stock',
                    is_featured: false,
                    is_promotion: false,
                    tbvs_product_types: { slug: 'sen-tam' },
                    brands: { name: 'Viglacera', slug: 'viglacera' },
                    colors: { name: 'Đen Bóng', hex_code: '#000000' },
                    variant_options: [
                        { axis: 'config', label: 'Cấu hình', value: 'Nóng lạnh - Không vòi xả bồn' },
                        { axis: 'color', label: 'Màu sắc', value: 'Chrome' },
                    ],
                }}
            />
        )

        expect(screen.getByText('Chrome')).toBeInTheDocument()
        expect(screen.queryByText('Đen Bóng')).not.toBeInTheDocument()
    })
})
