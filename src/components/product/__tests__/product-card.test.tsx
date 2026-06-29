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

    it('marks inactive products as search-only when they appear outside public listings', () => {
        render(
            <ProductCard
                basePath="/thiet-bi-ve-sinh"
                product={{
                    name: 'Bồn cầu treo tường Viglacera V902',
                    slug: 'bon-cau-treo-tuong-viglacera-v902-23451',
                    sku: 'V902',
                    price: null,
                    original_price: null,
                    online_discount_amount: null,
                    price_display: 'Liên hệ báo giá',
                    image_main_url: 'https://cdn.dongphugia.com.vn/migrated/viglacera/73723e4b8565-v902-avt.jpg',
                    stock_status: 'in_stock',
                    is_active: false,
                    is_featured: false,
                    is_promotion: false,
                    tbvs_product_types: { slug: 'bon-cau' },
                    brands: { name: 'Viglacera', slug: 'viglacera' },
                    variant_options: [],
                }}
            />
        )

        expect(screen.getByText('Có trên tìm kiếm')).toBeInTheDocument()
        expect(screen.getByText('Liên hệ báo giá')).toBeInTheDocument()
    })
})
