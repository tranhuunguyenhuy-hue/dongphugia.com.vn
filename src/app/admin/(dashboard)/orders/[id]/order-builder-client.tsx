'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useReactToPrint } from 'react-to-print'
import { toast } from 'sonner'
import { OrderTemplateA4 } from './order-template-a4'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Printer, Save, CreditCard, Truck } from 'lucide-react'
import { updateOrderData } from '@/lib/order-actions'
import { OrderStatusSelect } from '../order-status-select'
import { OrderPaymentSelect } from '../order-payment-select'

export function OrderBuilderClient({ order }: { order: any }) {
    const router = useRouter()
    const printRef = useRef<HTMLDivElement>(null)

    const [items, setItems] = useState(order.order_items)
    const [vatRate, setVatRate] = useState(order.vat_rate || 0)
    const [discount, setDiscount] = useState(Number(order.discount) || 0)
    const [shippingFee, setShippingFee] = useState(Number(order.shipping_fee) || 0)
    const [note, setNote] = useState(order.note || '')
    const [isSaving, setIsSaving] = useState(false)

    // Data package for PDF and Save
    const formData = {
        ...order,
        items,
        vat_rate: vatRate,
        discount,
        shipping_fee: shippingFee,
        note,
    }

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `DonHang_${order.order_number}`,
    })

    const handleItemChange = (idx: number, field: string, value: number) => {
        const newItems = [...items]
        newItems[idx] = { ...newItems[idx], [field]: value }
        setItems(newItems)
    }

    const handleSave = async () => {
        setIsSaving(true)
        const res = await updateOrderData(order.id, formData)
        if (res.success) {
            toast.success("Đã cập nhật đơn hàng thành công")
            router.refresh()
        } else {
            toast.error(res.error || "Có lỗi xảy ra khi lưu")
        }
        setIsSaving(false)
    }

    return (
        <div className="flex h-full min-h-[calc(100vh-64px)] bg-slate-100 overflow-hidden -mx-6 -my-6">
            {/* LEFT PANE: Builder Workspace */}
            <div className="w-1/2 min-w-[500px] h-full overflow-y-auto p-6 border-r border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" asChild>
                            <Link href="/admin/orders">
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold">Chi tiết Đơn Hàng</h1>
                            <p className="text-sm text-muted-foreground">Mã: {order.order_number}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleSave} disabled={isSaving} className="bg-[#2E7A96] hover:bg-[#25637a]">
                            <Save className="h-4 w-4 mr-2" />
                            Lưu thay đổi
                        </Button>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Status Update Block */}
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="border-stone-200/60 shadow-sm">
                            <CardHeader className="py-3 border-b border-stone-100">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Truck className="w-4 h-4 text-stone-500" />
                                    Trạng thái đơn
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3">
                                <OrderStatusSelect id={order.id} currentStatus={order.status} />
                            </CardContent>
                        </Card>
                        <Card className="border-stone-200/60 shadow-sm">
                            <CardHeader className="py-3 border-b border-stone-100">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <CreditCard className="w-4 h-4 text-stone-500" />
                                    Thanh toán
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3">
                                <OrderPaymentSelect id={order.id} currentPaymentStatus={order.payment_status} />
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader className="py-4">
                            <CardTitle className="text-base">Thông tin khách hàng</CardTitle>
                        </CardHeader>
                        <CardContent className="py-0 pb-4 text-sm space-y-2">
                            <p><span className="text-muted-foreground w-24 inline-block">Họ tên:</span> {order.customer_name}</p>
                            <p><span className="text-muted-foreground w-24 inline-block">SĐT:</span> {order.customer_phone}</p>
                            {order.customer_email && <p><span className="text-muted-foreground w-24 inline-block">Email:</span> {order.customer_email}</p>}
                            {order.customer_address && <p><span className="text-muted-foreground w-24 inline-block">Địa chỉ:</span> {order.customer_address}</p>}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="py-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-base">Sản phẩm & Đơn giá</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {items.map((item: any, idx: number) => (
                                <div key={item.id} className="p-4 border rounded-lg bg-slate-50 space-y-3">
                                    <div>
                                        <p className="font-medium text-sm line-clamp-1" title={item.product_name}>{item.product_name}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Mã: {item.product_sku !== 'N/A' && item.product_sku ? item.product_sku : '—'}</p>
                                    </div>
                                    <div className="flex gap-4 items-end">
                                        <div className="w-20">
                                            <Label className="text-xs text-stone-500">Số lượng</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                className="h-8 text-sm"
                                                value={item.quantity}
                                                onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <Label className="text-xs text-stone-500">Đơn giá (đã chiết khấu)</Label>
                                            <Input
                                                type="number"
                                                className="h-8 text-sm"
                                                value={item.unit_price}
                                                onChange={(e) => handleItemChange(idx, 'unit_price', parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div className="flex-1 text-right text-sm font-bold pt-2 text-[#2E7A96]">
                                            {new Intl.NumberFormat('vi-VN').format(item.quantity * item.unit_price)} đ
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="py-4">
                            <CardTitle className="text-base">Chi phí & Ghi chú</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label className="text-xs text-stone-500">Chiết khấu chung (đ)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        className="h-8 text-sm text-red-600 font-medium"
                                        value={discount}
                                        onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs text-stone-500">Phí vận chuyển (đ)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        className="h-8 text-sm text-emerald-600 font-medium"
                                        value={shippingFee}
                                        onChange={(e) => setShippingFee(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs text-stone-500">Thuế VAT (%)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        className="h-8 text-sm"
                                        value={vatRate}
                                        onChange={(e) => setVatRate(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs text-stone-500">Ghi chú in trên hóa đơn</Label>
                                <Textarea
                                    rows={3}
                                    className="text-sm mt-1"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Ghi chú về bảo hành, thời gian giao hàng, lắp đặt..."
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* RIGHT PANE: PDF Preview */}
            <div className="flex-1 h-full overflow-y-auto bg-[#525659] p-8 flex flex-col items-center">
                <div className="w-full max-w-[210mm] flex justify-end mb-4">
                    <Button onClick={handlePrint} className="bg-white text-black hover:bg-slate-200 shadow-sm border border-stone-200">
                        <Printer className="mr-2 h-4 w-4" />
                        In / Lưu PDF
                    </Button>
                </div>
                {/* A4 Container */}
                <div className="shadow-2xl print:shadow-none">
                    <OrderTemplateA4 ref={printRef} data={formData} />
                </div>
            </div>
        </div>
    )
}
