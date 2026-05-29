'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useReactToPrint } from 'react-to-print'
import { toast } from 'sonner'
import { QuoteTemplateA4 } from './quote-template-a4'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Printer, Save, CheckCircle } from 'lucide-react'
import { updateQuoteData, completeQuote } from './actions'

export function QuoteBuilderClient({ quote }: { quote: any }) {
    const router = useRouter()
    const printRef = useRef<HTMLDivElement>(null)

    // Format initial items to match our schema needs
    const initialItems = quote.quote_items.map((qi: any) => ({
        id: qi.id,
        name: qi.products.name,
        sku: qi.products.sku,
        price: Number(qi.products.price || qi.products.original_price || 0),
        quantity: qi.quantity,
        admin_unit_price: qi.admin_unit_price ? Number(qi.admin_unit_price) : Number(qi.products.price || qi.products.original_price || 0),
        admin_quantity: qi.admin_quantity || qi.quantity,
    }))

    const [items, setItems] = useState(initialItems)
    const [vatRate, setVatRate] = useState(quote.vat_rate || 10)
    const [shippingFee, setShippingFee] = useState(Number(quote.shipping_fee) || 0)
    const [adminNotes, setAdminNotes] = useState(quote.admin_notes || '')
    const [isSaving, setIsSaving] = useState(false)

    // Data package for PDF and Save
    const formData = {
        ...quote,
        items,
        vat_rate: vatRate,
        shipping_fee: shippingFee,
        admin_notes: adminNotes,
    }

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `BaoGia_${quote.quote_number || quote.id}`,
    })

    const handleItemChange = (idx: number, field: string, value: number) => {
        const newItems = [...items]
        newItems[idx] = { ...newItems[idx], [field]: value }
        setItems(newItems)
    }

    const handleSave = async () => {
        setIsSaving(true)
        const res = await updateQuoteData(quote.id, formData)
        if (res.success) {
            toast.success("Đã lưu bản nháp báo giá")
            router.refresh()
        } else {
            toast.error("Có lỗi xảy ra khi lưu")
        }
        setIsSaving(false)
    }

    const handleComplete = async () => {
        if (!confirm("Báo giá này sẽ được đánh dấu Hoàn Thành và thông tin khách hàng sẽ được đồng bộ vào CSKH. Tiếp tục?")) return
        setIsSaving(true)
        const res = await completeQuote(quote.id, formData)
        if (res.success) {
            toast.success("Đã hoàn thành báo giá và đồng bộ CSKH!")
            router.push('/admin/quote-requests')
        } else {
            toast.error(res.error || "Có lỗi xảy ra")
        }
        setIsSaving(false)
    }

    return (
        <div className="flex h-full bg-slate-100 overflow-hidden">
            {/* LEFT PANE: Builder Workspace */}
            <div className="w-1/2 min-w-[500px] h-full overflow-y-auto p-6 border-r border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" asChild>
                            <Link href="/admin/quote-requests">
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold">Soạn Báo Giá</h1>
                            <p className="text-sm text-muted-foreground">Mã: {quote.quote_number || `#${quote.id}`}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleSave} disabled={isSaving}>
                            <Save className="h-4 w-4 mr-2" />
                            Lưu nháp
                        </Button>
                        <Button onClick={handleComplete} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Hoàn thành
                        </Button>
                    </div>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader className="py-4">
                            <CardTitle className="text-base">Thông tin khách hàng</CardTitle>
                        </CardHeader>
                        <CardContent className="py-0 pb-4 text-sm space-y-2">
                            <p><span className="text-muted-foreground w-20 inline-block">Họ tên:</span> {quote.name}</p>
                            <p><span className="text-muted-foreground w-20 inline-block">SĐT:</span> {quote.phone}</p>
                            <p><span className="text-muted-foreground w-20 inline-block">Email:</span> {quote.email || '—'}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="py-4">
                            <CardTitle className="text-base">Danh sách sản phẩm</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {items.map((item: any, idx: number) => (
                                <div key={item.id} className="p-4 border rounded-lg bg-slate-50 space-y-3">
                                    <div>
                                        <p className="font-medium text-sm line-clamp-1" title={item.name}>{item.name}</p>
                                        <p className="text-xs text-muted-foreground">Mã: {item.sku || '—'}</p>
                                    </div>
                                    <div className="flex gap-4 items-end">
                                        <div className="w-20">
                                            <Label className="text-xs">Số lượng</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                className="h-8 text-sm"
                                                value={item.admin_quantity}
                                                onChange={(e) => handleItemChange(idx, 'admin_quantity', parseInt(e.target.value) || 1)}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <Label className="text-xs">Đơn giá (chiết khấu)</Label>
                                            <Input
                                                type="number"
                                                className="h-8 text-sm"
                                                value={item.admin_unit_price}
                                                onChange={(e) => handleItemChange(idx, 'admin_unit_price', parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div className="flex-1 text-right text-sm font-medium pt-2">
                                            {new Intl.NumberFormat('vi-VN').format(item.admin_quantity * item.admin_unit_price)} đ
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
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs">Thuế VAT (%)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        className="h-8 text-sm"
                                        value={vatRate}
                                        onChange={(e) => setVatRate(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Phí vận chuyển (đ)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        className="h-8 text-sm"
                                        value={shippingFee}
                                        onChange={(e) => setShippingFee(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs">Ghi chú in trên báo giá</Label>
                                <Textarea
                                    rows={3}
                                    className="text-sm mt-1"
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                    placeholder="Ví dụ: Báo giá có hiệu lực trong vòng 7 ngày. Thời gian giao hàng: 3 ngày."
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* RIGHT PANE: PDF Preview */}
            <div className="flex-1 h-full overflow-y-auto bg-[#525659] p-8 flex flex-col items-center">
                <div className="w-full max-w-[210mm] flex justify-end mb-4">
                    <Button onClick={handlePrint} className="bg-white text-black hover:bg-slate-200">
                        <Printer className="mr-2 h-4 w-4" />
                        In / Lưu PDF
                    </Button>
                </div>
                {/* A4 Container */}
                <div className="shadow-2xl print:shadow-none">
                    <QuoteTemplateA4 ref={printRef} data={formData} />
                </div>
            </div>
        </div>
    )
}
