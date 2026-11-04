import { Metadata } from 'next'
import { CheckCircle2, Phone, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
    title: 'Đã nhận yêu cầu đặt hàng',
    description: 'Đông Phú Gia đã nhận yêu cầu và sẽ liên hệ xác nhận giá, tồn kho trước khi chốt.',
    robots: { index: false, follow: false },
}

interface Props {
    searchParams: Promise<{ order?: string }>
}

export default async function OrderSuccessPage({ searchParams }: Props) {
    const { order } = await searchParams
    const orderNumber = order && /^[A-Z0-9-]{3,32}$/.test(order) ? order : null

    return (
        <div className="min-h-[60vh] flex items-center justify-center px-5 py-16">
            <div className="max-w-lg w-full text-center">
                {/* Success Icon */}
                <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 animate-in zoom-in-75 duration-500">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold text-neutral-900 mb-3">
                    Đã nhận yêu cầu đặt hàng
                </h1>
                <p className="text-neutral-600 text-lg mb-8 leading-relaxed">
                    Cảm ơn bạn đã gửi yêu cầu đến Đông Phú Gia. Yêu cầu đang chờ nhân viên kiểm tra và xác nhận; đơn hàng chưa được chốt và bạn chưa phải thanh toán.
                </p>

                {/* Order Number Chip */}
                {orderNumber && (
                    <div className="inline-flex items-center gap-2 bg-[#EAF6FB] border border-[#C5E8F5] rounded-full px-6 py-3 mb-8">
                        <span className="text-sm text-neutral-600">Mã tiếp nhận:</span>
                        <span className="font-bold text-[#2E7A96] text-lg tracking-widest">{orderNumber}</span>
                    </div>
                )}

                {/* Info Card */}
                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 mb-8 text-left space-y-3">
                    <h2 className="font-semibold text-neutral-900 mb-4">Bước tiếp theo</h2>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#2E7A96] text-white text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">1</div>
                        <p className="text-sm text-neutral-700">Nhân viên sẽ liên hệ theo số điện thoại bạn cung cấp để xác nhận giá, tồn kho và thông tin giao nhận.</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#2E7A96] text-white text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">2</div>
                        <p className="text-sm text-neutral-700">Yêu cầu chỉ trở thành đơn hàng sau khi bạn và nhân viên thống nhất các thông tin.</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#2E7A96] text-white text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">3</div>
                        <p className="text-sm text-neutral-700">Bạn cũng có thể liên hệ trực tiếp qua Phòng kinh doanh để được hỗ trợ ngay.</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <a href={`tel:${siteConfig.contact.businessRoom}`}>
                        <Button variant="outline" className="w-full sm:w-auto border-[#2E7A96] text-[#2E7A96] hover:bg-[#2E7A96] hover:text-white gap-2">
                            <Phone className="w-4 h-4" />
                            Phòng KD: {siteConfig.contact.businessRoomLabel}
                        </Button>
                    </a>
                    <Link href="/">
                        <Button className="w-full sm:w-auto bg-[#2E7A96] hover:bg-[#25617a] text-white gap-2">
                            Tiếp tục mua hàng
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    )
}
