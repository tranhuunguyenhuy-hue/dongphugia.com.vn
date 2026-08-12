'use client'

import { useEffect, useMemo, useState } from 'react'
import type { VariantSibling } from '@/lib/public-api-products'
import { ProductCTA } from '@/components/product/product-cta'
import { ProductPrice } from '@/components/product/product-price'
import { VariantPreview, VariantSelector } from '@/components/product/variant-selector'; import { resolveProductCommerce } from '@/lib/product-commerce'

interface ProductPurchasePanelProps {
    product: any
    variantSiblings: VariantSibling[]
    variantAxes?: unknown
    currentVariantOptions?: unknown
    categorySlug: string
    subcategorySlug?: string | null
}

export function ProductPurchasePanel({
    product,
    variantSiblings,
    variantAxes,
    currentVariantOptions,
    categorySlug,
    subcategorySlug,
}: ProductPurchasePanelProps) {
    const [selectedVariant, setSelectedVariant] = useState<VariantPreview | null>(null)

    useEffect(() => {
        setSelectedVariant(null)
    }, [product.id, product.sku])

    const displayProduct = useMemo(() => {
        if (!selectedVariant) return product
        return {
            ...product,
            id: selectedVariant.id ?? product.id,
            sku: selectedVariant.sku,
            slug: selectedVariant.slug,
            name: selectedVariant.name,
            price: selectedVariant.price,
            original_price: selectedVariant.original_price,
            sale_price: selectedVariant.sale_price,
            list_price: selectedVariant.list_price,
            online_discount_amount: selectedVariant.online_discount_amount ?? product.online_discount_amount,
            price_display: selectedVariant.price_display,
            image_main_url: selectedVariant.image_main_url,
            stock_status: selectedVariant.stock_status ?? product.stock_status,
            sale_status: selectedVariant.sale_status ?? product.sale_status,
            price_state: selectedVariant.price_state ?? product.price_state,
            is_active: selectedVariant.is_active ?? product.is_active,
        }
    }, [product, selectedVariant])

    const currentCommerce = resolveProductCommerce({
        originalPrice: product.original_price ?? product.list_price,
        salePrice: product.sale_price,
        legacyPrice: product.price,
        stockStatus: product.stock_status,
    })
    const displayLegacyPrice = displayProduct.price
    const displayOriginalPrice = displayProduct.original_price ?? displayProduct.list_price
    const displaySalePrice = displayProduct.sale_price

    return (
        <>
            {product.variant_group && variantSiblings.length > 0 && (
                <VariantSelector
                    currentSku={product.sku}
                    currentSlug={product.slug}
                    currentName={product.name}
                    currentImageMainUrl={product.image_main_url}
                    currentPriceDisplay={product.price_display}
                    currentPrice={currentCommerce.displayPrice}
                    currentOriginalPrice={currentCommerce.originalPrice}
                    currentColor={product.colors}
                    currentStockStatus={product.stock_status}
                    currentVariantOptions={currentVariantOptions}
                    variantAxes={variantAxes}
                    selectedSku={displayProduct.sku}
                    onPreviewVariant={setSelectedVariant}
                    variantType={product.variant_type}
                    variantLabel={product.variant_label}
                    variantGroup={product.variant_group}
                    siblings={variantSiblings}
                    categorySlug={categorySlug}
                    subcategorySlug={subcategorySlug}
                />
            )}

            <ProductPrice
                price={displayLegacyPrice ? Number(displayLegacyPrice) : null}
                originalPrice={displayOriginalPrice ? Number(displayOriginalPrice) : null}
                salePrice={displaySalePrice ? Number(displaySalePrice) : null}
                priceDisplay={displayProduct.price_display}
                onlineDiscountAmount={displayProduct.online_discount_amount ? Number(displayProduct.online_discount_amount) : null}
                stockStatus={displayProduct.stock_status}
                saleStatus={displayProduct.sale_status}
                priceState={displayProduct.price_state}
            >
                <ProductCTA
                    productId={displayProduct.id}
                    productSku={displayProduct.sku}
                    productName={displayProduct.name}
                    price={displayLegacyPrice ? Number(displayLegacyPrice) : null}
                    originalPrice={displayOriginalPrice ? Number(displayOriginalPrice) : null}
                    salePrice={displaySalePrice ? Number(displaySalePrice) : null}
                    priceDisplay={displayProduct.price_display}
                    imageUrl={displayProduct.image_main_url || (product.product_images && product.product_images.length > 0 ? product.product_images[0].image_url : null)}
                    categorySlug={categorySlug}
                    subcategorySlug={subcategorySlug}
                    brandName={product.brands?.name}
                    slug={displayProduct.slug}
                    stockStatus={displayProduct.stock_status}
                    saleStatus={displayProduct.sale_status}
                    priceState={displayProduct.price_state}
                />
            </ProductPrice>
        </>
    )
}
