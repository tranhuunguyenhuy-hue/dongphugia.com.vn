import type { Metadata } from 'next'
import { OrderRequestReceipt } from '@/components/orders/order-request-receipt'

export const metadata: Metadata = {
  title: 'Xác minh yêu cầu đặt hàng',
  description: 'Gửi yêu cầu đặt hàng qua giỏ hàng để nhận xác nhận từ hệ thống.',
  robots: { index: false, follow: false },
}

export default function OrderRequestReceiptPage() {
  return <OrderRequestReceipt />
}
