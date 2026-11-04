import Link from 'next/link'
import { ArrowRight, CheckCircle2, Phone } from 'lucide-react'
import { siteConfig } from '@/config/site'

export function OrderRequestConfirmation({ orderNumber }: { orderNumber: string }) {
  return (
    <div role="status" className="min-h-[60vh] flex items-center justify-center px-5 py-16">
      <div className="max-w-lg w-full text-center">
        <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </div>
        <h1 className="text-3xl font-bold text-neutral-900 mb-3">Đã nhận yêu cầu đặt hàng</h1>
        <p className="text-neutral-600 text-lg mb-6 leading-relaxed">
          Yêu cầu của bạn đang chờ nhân viên kiểm tra và xác nhận. Đây chưa phải đơn hàng đã chốt và bạn chưa phải thanh toán.
        </p>
        <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-full px-6 py-3 mb-8">
          <span className="text-sm text-neutral-600">Mã tiếp nhận:</span>
          <span className="font-bold text-brand-700 text-lg tracking-widest">{orderNumber}</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={`tel:${siteConfig.contact.businessRoom}`}
            className="inline-flex h-10 items-center justify-center rounded-md border border-brand-600 px-4 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-700 hover:text-white"
          >
            <Phone className="mr-2 w-4 h-4" />
            Phòng KD: {siteConfig.contact.businessRoomLabel}
          </a>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-md bg-brand-700 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-800"
          >
            Tiếp tục mua hàng
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
