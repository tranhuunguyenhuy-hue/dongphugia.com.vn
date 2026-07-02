'use client'

import { useEffect, useMemo, useState } from 'react'
import type { VariantSibling } from '@/lib/public-api-products'
import { ProductCTA } from '@/components/product/product-cta'
import { ProductPrice } from '@/components/product/product-price'
import { VariantPreview, VariantSelector } from '@/components/product/variant-selector'

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
        const selectedSalePrice = selectedVariant.sale_price ?? selectedVariant.price
        const selectedListPrice = selectedVariant.list_price ?? selectedVariant.original_price
        return {
            ...product,
            id: selectedVariant.id ?? product.id,
            sku: selectedVariant.sku,
            slug: selectedVariant.slug,
            name: selectedVariant.name,
            price: selectedSalePrice,
            original_price: selectedListPrice,
            sale_price: selectedSalePrice,
            list_price: selectedListPrice,
            online_discount_amount: selectedVariant.online_discount_amount ?? product.online_discount_amount,
            price_display: selectedVariant.price_display,
            image_main_url: selectedVariant.image_main_url,
            stock_status: selectedVariant.stock_status ?? product.stock_status,
            sale_status: selectedVariant.sale_status ?? product.sale_status,
            price_state: selectedVariant.price_state ?? product.price_state,
            is_active: selectedVariant.is_active ?? product.is_active,
        }
    }, [product, selectedVariant])

    const currentSalePrice = product.sale_price ?? product.price
    const currentListPrice = product.list_price ?? product.original_price
    const displaySalePrice = displayProduct.sale_price ?? displayProduct.price
    const displayListPrice = displayProduct.list_price ?? displayProduct.original_price

    return (
        <>
            {product.variant_group && variantSiblings.length > 0 && (
                <VariantSelector
                    currentSku={product.sku}
                    currentSlug={product.slug}
                    currentName={product.name}
                    currentImageMainUrl={product.image_main_url}
                    currentPriceDisplay={product.price_display}
                    currentPrice={currentSalePrice ? Number(currentSalePrice) : null}
                    currentOriginalPrice={currentListPrice ? Number(currentListPrice) : null}
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
                price={displaySalePrice ? Number(displaySalePrice) : null}
                originalPrice={displayListPrice ? Number(displayListPrice) : null}
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
                    price={displaySalePrice ? Number(displaySalePrice) : null}
                    originalPrice={displayListPrice ? Number(displayListPrice) : null}
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
