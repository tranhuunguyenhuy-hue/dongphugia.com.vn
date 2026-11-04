import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Xác minh yêu cầu đặt hàng',
  description: 'Gửi yêu cầu đặt hàng qua giỏ hàng để nhận xác nhận từ hệ thống.',
  robots: { index: false, follow: false },
}

export default function UnverifiedOrderRequestPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-5 py-16">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-3xl font-bold text-neutral-900 mb-3">Chưa thể xác minh yêu cầu</h1>
        <p className="text-neutral-600 text-lg mb-8 leading-relaxed">
          Trang này không xác nhận yêu cầu chỉ dựa trên mã có trong đường dẫn. Hãy gửi yêu cầu từ giỏ hàng; mã tiếp nhận sẽ hiện sau khi hệ thống xác nhận đã lưu yêu cầu.
        </p>
        <Link
          href="/gio-hang"
          className="inline-flex h-10 items-center justify-center rounded-md bg-[#2E7A96] px-4 text-sm font-medium text-white transition-colors hover:bg-[#25617a]"
        >
          <ArrowLeft className="mr-2 w-4 h-4" />
          Quay lại giỏ hàng
        </Link>
      </div>
    </div>
  )
}
