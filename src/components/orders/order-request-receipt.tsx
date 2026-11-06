'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import {
  getStoredOrderRequestReceiptKey,
  lookupOrderRequestReceipt,
  markOrderRequestReceiptVerified,
} from '@/lib/guest-order-client'
import { OrderRequestConfirmation } from './order-request-confirmation'

export function OrderRequestReceipt() {
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [retryVersion, setRetryVersion] = useState(0)

  useEffect(() => {
    let active = true
    void Promise.resolve().then(async () => {
      const key = getStoredOrderRequestReceiptKey()
      if (!key) {
        if (active) setChecking(false)
        return
      }
      const receipt = await lookupOrderRequestReceipt(key)
      if (!active) return
      if (receipt) markOrderRequestReceiptVerified(key)
      setOrderNumber(receipt)
      setChecking(false)
    })
    return () => { active = false }
  }, [retryVersion])

  if (orderNumber) return <OrderRequestConfirmation orderNumber={orderNumber} />

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-5 py-16">
      <div className="max-w-lg w-full text-center">
        {checking ? (
          <Loader2 className="w-10 h-10 text-brand-600 animate-spin mx-auto mb-5" aria-hidden="true" />
        ) : null}
        <h1 className="text-3xl font-bold text-neutral-900 mb-3">
          {checking ? 'Đang xác minh yêu cầu' : 'Chưa thể xác minh yêu cầu'}
        </h1>
        <p className="text-neutral-600 text-lg mb-8 leading-relaxed">
          {checking
            ? 'Hệ thống đang kiểm tra biên nhận đã lưu. Vui lòng đợi trong giây lát.'
            : 'Trang này chỉ hiển thị xác nhận sau khi hệ thống đối chiếu được biên nhận đã lưu. Nếu bạn vừa gửi yêu cầu, hãy thử kiểm tra lại.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!checking && (
            <button
              type="button"
              onClick={() => {
                setChecking(true)
                setRetryVersion((version) => version + 1)
              }}
              className="inline-flex h-10 items-center justify-center rounded-md border border-brand-600 px-4 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
            >
              Kiểm tra lại
            </button>
          )}
          <Link
            href="/gio-hang"
            className="inline-flex h-10 items-center justify-center rounded-md bg-brand-700 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-800"
          >
            <ArrowLeft className="mr-2 w-4 h-4" />
            Quay lại giỏ hàng
          </Link>
        </div>
      </div>
    </div>
  )
}
