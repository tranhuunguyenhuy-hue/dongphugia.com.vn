'use client'

import { useState } from 'react'
import { MessageSquareText, Minus, Phone, Plus, ShoppingBag } from 'lucide-react'
import { useCartStore } from '@/lib/cart-store'
import { resolveFinalOnlinePrice, resolveProductCommerce } from '@/lib/product-commerce'
import { useProductOptions } from '@/components/product/product-options-context'
import { siteConfig, siteLinks } from '@/config/site'
import Link from 'next/link'

interface ProductCTAProps {
  productId: number
  productSku: string
  productName: string
  price: number | null
  priceDisplay?: string | null
  originalPrice?: number | null
  listPrice?: number | null
  salePrice?: number | null
  imageUrl?: string | null
  categorySlug: string
  subcategorySlug?: string | null
  brandName?: string | null
  slug: string
  stockStatus?: string | null
}

const money = (amount: number) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(amount)

export function ProductCTA({
  productId,
  productSku,
  productName,
  price,
  priceDisplay,
  originalPrice,
  listPrice,
  salePrice,
  imageUrl,
  categorySlug,
  subcategorySlug,
  brandName,
  slug,
  stockStatus,
}: ProductCTAProps) {
  const addItem = useCartStore((state) => state.addItem)
  const options = useProductOptions()
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  const commerce = resolveProductCommerce({
    listPrice,
    originalPrice,
    salePrice,
    compatibilityPrice: price,
    stockStatus,
  })
  const basePrice = commerce.displayPrice
  const discount = options?.onlineDiscountAmount ?? 0
  const finalOnlinePrice = basePrice === null
    ? null
    : resolveFinalOnlinePrice(basePrice, discount) ?? basePrice
  const canRequestOrder = commerce.canRequestOrder && finalOnlinePrice !== null && finalOnlinePrice > 0

  const handleAddToCart = () => {
    if (!canRequestOrder || finalOnlinePrice === null) return

    addItem({
      productId,
      sku: productSku,
      name: productName,
      slug,
      categorySlug,
      subcategorySlug: subcategorySlug ?? null,
      price: basePrice,
      priceDisplay: priceDisplay ?? null,
      imageUrl: imageUrl ?? null,
      brandName: brandName ?? null,
      quantity,
      installOption: options?.installOption ?? 'none',
      installationFee: options?.installationFee ?? 0,
      onlineDiscountAmount: basePrice !== null && finalOnlinePrice < basePrice ? discount : 0,
      finalPrice: finalOnlinePrice + (options?.installationFee ?? 0),
    })
    setAdded(true)
  }

  return (
    <div className="space-y-3 border-t border-stone-100 pt-4">
      {canRequestOrder ? (
        <>
          <p className="text-sm text-stone-600">
            Giá đặt online: <strong className="text-brand-700">{money(finalOnlinePrice!)}</strong>
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex h-10 items-center rounded-lg border border-stone-200" aria-label="Số lượng sản phẩm">
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                className="flex h-10 w-10 items-center justify-center text-stone-600 hover:bg-stone-50"
                aria-label="Giảm số lượng"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-9 text-center text-sm font-semibold" aria-live="polite">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.min(99, value + 1))}
                className="flex h-10 w-10 items-center justify-center text-stone-600 hover:bg-stone-50"
                aria-label="Tăng số lượng"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleAddToCart}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 font-semibold text-white transition-colors hover:bg-brand-800"
            >
              <ShoppingBag className="h-5 w-5" />
              Thêm vào giỏ hàng
            </button>
          </div>
          <p className="text-xs text-stone-500">Nhân viên sẽ xác nhận giá và khả năng cung ứng trước khi chốt yêu cầu.</p>
          <p role="status" aria-live="polite" className="min-h-5 text-sm font-medium text-emerald-700">
            {added ? (
              <>
                Đã thêm sản phẩm vào giỏ hàng.{' '}
                <Link href="/gio-hang" className="font-semibold underline underline-offset-2">Xem giỏ hàng</Link>
              </>
            ) : ''}
          </p>
        </>
      ) : (
        <p className="text-sm text-stone-500">Vui lòng liên hệ để được tư vấn giá và khả năng cung ứng.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <a
          className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 font-semibold text-white"
          href={`tel:${siteConfig.contact.hotline}`}
        >
          <Phone className="h-4 w-4" /> Gọi tư vấn
        </a>
        <a
          className="inline-flex items-center gap-2 rounded-xl border border-brand-700 px-4 py-2.5 font-semibold text-brand-700"
          href={siteLinks.zalo}
          rel="noopener noreferrer"
          target="_blank"
        >
          <MessageSquareText className="h-4 w-4" /> Nhận báo giá qua Zalo
        </a>
      </div>
    </div>
  )
}
