'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPartner, updatePartner } from '@/lib/partner-actions'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImageUploader } from '@/components/ui/image-uploader'

const TIER_OPTIONS = ['Vàng', 'Bạch kim', 'Đồng']

interface PartnerFormProps {
    partner?: any
}

export function PartnerForm({ partner }: PartnerFormProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const isEdit = !!partner

    const [form, setForm] = useState({
        name: partner?.name || '',
        logo_url: partner?.logo_url || '',
        description: partner?.description || '',
        tier: partner?.tier || 'Vàng',
        gradient_class: partner?.gradient_class || '',
        link_url: partner?.link_url || '',
        is_active: partner?.is_active ?? true,
        sort_order: partner?.sort_order?.toString() || '0',
    })

    const set = (key: string, value: any) => setForm(p => ({ ...p, [key]: value }))

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            const payload = { ...form, sort_order: parseInt(form.sort_order) || 0 }
            const result = isEdit
                ? await updatePartner(partner.id, payload)
                : await createPartner(payload)
            if (result?.errors || result?.message) {
                toast.error(result.message || 'Vui lòng kiểm tra lại dữ liệu')
            } else {
                toast.success(isEdit ? 'Đã cập nhật đối tác' : 'Đã thêm đối tác')
                router.push('/admin/doi-tac')
            }
        })
    }

    const inputCls = "w-full h-10 px-3 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white"
    const labelCls = "block text-sm font-medium text-[#3C4E56] mb-1.5"

    return (
        <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
            <div className="bg-white rounded-2xl border border-[#E4EEF2] p-6 space-y-5">
                <div>
                    <label className={labelCls}>Tên đối tác *</label>
                    <input required className={inputCls} value={form.name}
                        onChange={e => set('name', e.target.value)} placeholder="Tên thương hiệu / đối tác..." />
                </div>
                <div>
                    <ImageUploader label="Logo đối tác" value={form.logo_url}
                        onChange={v => set('logo_url', v as string)} folder="partners" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Cấp độ (Tier)</label>
                        <select className={inputCls} value={form.tier} onChange={e => set('tier', e.target.value)}>
                            {TIER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Thứ tự hiển thị</label>
                        <input type="number" className={inputCls} value={form.sort_order}
                            onChange={e => set('sort_order', e.target.value)} min={0} />
                    </div>
                </div>
                <div>
                    <label className={labelCls}>Website / Link</label>
                    <input type="url" className={inputCls} value={form.link_url}
                        onChange={e => set('link_url', e.target.value)} placeholder="https://..." />
                </div>
                <div>
                    <label className={labelCls}>Mô tả ngắn</label>
                    <textarea className={`${inputCls} h-20 py-2 resize-none`} value={form.description}
                        onChange={e => set('description', e.target.value)} placeholder="Mô tả về đối tác..." />
                </div>
                <div>
                    <label className={labelCls}>Gradient CSS class (tuỳ chọn)</label>
                    <input className={inputCls} value={form.gradient_class}
                        onChange={e => set('gradient_class', e.target.value)} placeholder="VD: from-blue-500 to-blue-700" />
                    <p className="text-xs text-muted-foreground mt-1">Dùng cho background fallback khi không có logo</p>
                </div>
                <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.is_active}
                            onChange={e => set('is_active', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary" />
                        <span className="text-sm font-medium text-[#3C4E56]">Hiển thị</span>
                    </label>
                </div>
            </div>
            <div className="flex items-center gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => router.back()}>Huỷ</Button>
                <Button type="submit" disabled={isPending} className="gap-2">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isEdit ? 'Cập nhật' : 'Thêm đối tác'}
                </Button>
            </div>
        </form>
    )
}
