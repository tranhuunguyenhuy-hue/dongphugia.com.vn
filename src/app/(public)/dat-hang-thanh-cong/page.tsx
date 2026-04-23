import { Metadata } from 'next'
import { CheckCircle2, Phone, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
    title: 'Đặt hàng thành công',
    description: 'Đơn hàng của bạn đã được ghi nhận. Đông Phú Gia sẽ liên hệ xác nhận sớm nhất.',
    robots: { index: false, follow: false },
}

interface Props {
    searchParams: Promise<{ order?: string }>
}

export default async function OrderSuccessPage({ searchParams }: Props) {
    const { order } = await searchParams
    const orderNumber = order ?? 'DPG-XXXXXXXX-XXXX'

    return (
        <div className="min-h-[60vh] flex items-center justify-center px-5 py-16">
            <div className="max-w-lg w-full text-center">
                {/* Success Icon */}
                <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 animate-in zoom-in-75 duration-500">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold text-neutral-900 mb-3">
                    Đặt hàng thành công!
                </h1>
                <p className="text-neutral-600 text-lg mb-8 leading-relaxed">
                    Cảm ơn bạn đã tin tưởng Đông Phú Gia. Chúng tôi đã ghi nhận đơn hàng của bạn.
                </p>

                {/* Order Number Chip */}
                <div className="inline-flex items-center gap-2 bg-[#EAF6FB] border border-[#C5E8F5] rounded-full px-6 py-3 mb-8">
                    <span className="text-sm text-neutral-600">Mã đơn hàng:</span>
                    <span className="font-bold text-[#2E7A96] text-lg tracking-widest">{orderNumber}</span>
                </div>

                {/* Info Card */}
                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 mb-8 text-left space-y-3">
                    <h2 className="font-semibold text-neutral-900 mb-4">Bước tiếp theo</h2>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#2E7A96] text-white text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">1</div>
                        <p className="text-sm text-neutral-700">Nhân viên CSKH sẽ gọi điện xác nhận đơn hàng trong vòng <strong>30 phút</strong> (giờ hành chính).</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#2E7A96] text-white text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">2</div>
                        <p className="text-sm text-neutral-700">Sau khi xác nhận, đơn hàng sẽ được <strong>tư vấn giá, thương thảo</strong> và sắp xếp giao hàng.</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#2E7A96] text-white text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">3</div>
                        <p className="text-sm text-neutral-700">Bạn cũng có thể liên hệ trực tiếp qua hotline để được hỗ trợ ngay.</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <a href={`tel:${siteConfig.contact.phone}`}>
                        <Button variant="outline" className="w-full sm:w-auto border-[#2E7A96] text-[#2E7A96] hover:bg-[#2E7A96] hover:text-white gap-2">
                            <Phone className="w-4 h-4" />
                            Gọi {siteConfig.contact.phoneLabel}
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
