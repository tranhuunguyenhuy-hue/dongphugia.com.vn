import { forwardRef } from 'react'

export const QuoteTemplateA4 = forwardRef<HTMLDivElement, { data: any }>(
    ({ data }, ref) => {
        // Calculate totals
        const items = data.items || []
        const subtotal = items.reduce((acc: number, item: any) => {
            const price = item.admin_unit_price ?? item.price ?? 0
            const qty = item.admin_quantity ?? item.quantity ?? 1
            return acc + (price * qty)
        }, 0)

        const vatRate = data.vat_rate || 0
        const vatAmount = subtotal * (vatRate / 100)
        const shippingFee = Number(data.shipping_fee) || 0
        const total = subtotal + vatAmount + shippingFee

        const formatPrice = (p: number) => new Intl.NumberFormat('vi-VN').format(p) + ' đ'
        const today = new Date()

        return (
            <div className="w-[210mm] min-h-[297mm] bg-white p-[20mm] mx-auto text-[14px] text-black shadow-lg" ref={ref}>
                {/* Header */}
                <div className="flex justify-between items-start mb-8 border-b-2 border-black pb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-red-600 mb-1">ĐÔNG PHÚ GIA</h1>
                        <p className="font-semibold text-sm">Công ty TNHH Đầu tư Thương Mại Đông Phú Gia</p>
                        <p className="text-sm">Hotline: 090 295 2468</p>
                        <p className="text-sm">Địa chỉ: 271-273 Đường Cách Mạng Tháng 8, P.Khuê Trung, Q.Cẩm Lệ, Đà Nẵng</p>
                        <p className="text-sm">Website: dongphugia.com</p>
                    </div>
                </div>

                {/* Title */}
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold uppercase">Bảng Báo Giá</h2>
                    <p className="text-sm mt-1 italic">
                        Ngày {today.getDate()} tháng {today.getMonth() + 1} năm {today.getFullYear()}
                    </p>
                </div>

                {/* Customer Info */}
                <div className="mb-6 grid grid-cols-2 gap-4">
                    <div>
                        <p><strong>Khách hàng:</strong> {data.name}</p>
                        <p><strong>Số điện thoại:</strong> {data.phone}</p>
                    </div>
                    <div>
                        <p><strong>Email:</strong> {data.email || '—'}</p>
                        <p><strong>Mã báo giá:</strong> {data.quote_number}</p>
                    </div>
                </div>

                {/* Table */}
                <table className="w-full mb-6 border-collapse">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-black p-2 text-center w-12">STT</th>
                            <th className="border border-black p-2 text-left">Tên sản phẩm</th>
                            <th className="border border-black p-2 text-center w-16">SL</th>
                            <th className="border border-black p-2 text-right w-32">Đơn giá</th>
                            <th className="border border-black p-2 text-right w-32">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item: any, idx: number) => {
                            const price = item.admin_unit_price ?? item.price ?? 0
                            const qty = item.admin_quantity ?? item.quantity ?? 1
                            return (
                                <tr key={item.id} style={{ pageBreakInside: 'avoid' }}>
                                    <td className="border border-black p-2 text-center">{idx + 1}</td>
                                    <td className="border border-black p-2">
                                        <div className="font-medium">{item.name}</div>
                                        {item.sku && <div className="text-xs text-gray-500">Mã: {item.sku}</div>}
                                    </td>
                                    <td className="border border-black p-2 text-center">{qty}</td>
                                    <td className="border border-black p-2 text-right">{formatPrice(price)}</td>
                                    <td className="border border-black p-2 text-right">{formatPrice(price * qty)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="flex justify-end mb-8" style={{ pageBreakInside: 'avoid' }}>
                    <div className="w-1/2">
                        <div className="flex justify-between py-1">
                            <span>Tạm tính:</span>
                            <span className="font-medium">{formatPrice(subtotal)}</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span>Thuế VAT ({vatRate}%):</span>
                            <span>{formatPrice(vatAmount)}</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span>Phí vận chuyển:</span>
                            <span>{formatPrice(shippingFee)}</span>
                        </div>
                        <div className="flex justify-between py-2 border-t-2 border-black mt-2">
                            <span className="font-bold">Tổng cộng:</span>
                            <span className="font-bold text-lg text-red-600">{formatPrice(total)}</span>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                {data.admin_notes && (
                    <div className="mb-8" style={{ pageBreakInside: 'avoid' }}>
                        <p className="font-bold mb-1">Ghi chú:</p>
                        <p className="whitespace-pre-wrap text-sm">{data.admin_notes}</p>
                    </div>
                )}

                {/* Signature */}
                <div className="flex justify-between text-center mt-12" style={{ pageBreakInside: 'avoid' }}>
                    <div className="w-1/2">
                        <p className="font-bold">Khách hàng</p>
                        <p className="text-sm italic">(Ký, ghi rõ họ tên)</p>
                    </div>
                    <div className="w-1/2">
                        <p className="font-bold">Đại diện kinh doanh</p>
                        <p className="text-sm italic">(Ký, ghi rõ họ tên)</p>
                        <div className="h-24"></div>
                        <p className="font-medium">Đông Phú Gia</p>
                    </div>
                </div>

                {/* Print Styles */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        @page {
                            size: A4;
                            margin: 0;
                        }
                        body {
                            margin: 0;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                    }
                `}} />
            </div>
        )
    }
)
QuoteTemplateA4.displayName = 'QuoteTemplateA4'
