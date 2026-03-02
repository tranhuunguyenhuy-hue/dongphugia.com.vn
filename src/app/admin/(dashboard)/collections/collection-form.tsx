'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCollection, updateCollection } from '@/lib/actions'
import { slugify } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PatternType { id: number; name: string }

interface CollectionFormProps {
    collection?: any
    patternTypes: PatternType[]
}

export function CollectionForm({ collection, patternTypes }: CollectionFormProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const isEdit = !!collection

    const [form, setForm] = useState({
        name: collection?.name || '',
        slug: collection?.slug || '',
        pattern_type_id: collection?.pattern_type_id?.toString() || '',
        tagline: collection?.tagline || '',
        description: collection?.description || '',
        thumbnail_url: collection?.thumbnail_url || '',
        is_active: collection?.is_active ?? true,
        is_featured: collection?.is_featured ?? false,
        sort_order: collection?.sort_order?.toString() || '0',
    })

    const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }))

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            const payload = {
                ...form,
                pattern_type_id: parseInt(form.pattern_type_id) || 0,
                sort_order: parseInt(form.sort_order) || 0,
            }
            const result = isEdit
                ? await updateCollection(collection.id, payload)
                : await createCollection(payload)

            if (result?.errors || result?.message) {
                toast.error(result.message || 'Vui lòng kiểm tra lại dữ liệu')
            } else {
                toast.success(isEdit ? 'Đã cập nhật bộ sưu tập' : 'Đã thêm bộ sưu tập')
                router.push('/admin/collections')
            }
        })
    }

    const inputCls = "w-full h-10 px-3 rounded-lg border border-[#e2e8f0] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white"
    const labelCls = "block text-sm font-medium text-[#374151] mb-1.5"

    return (
        <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 space-y-5">
                <div>
                    <label className={labelCls}>Tên bộ sưu tập <span className="text-red-500">*</span></label>
                    <input
                        className={inputCls}
                        value={form.name}
                        onChange={(e) => {
                            set('name', e.target.value)
                            if (!isEdit) set('slug', slugify(e.target.value))
                        }}
                        required placeholder="Tên bộ sưu tập"
                    />
                </div>
                <div>
                    <label className={labelCls}>Slug <span className="text-red-500">*</span></label>
                    <input className={inputCls} value={form.slug} onChange={(e) => set('slug', e.target.value)} required placeholder="ten-bo-suu-tap" />
                </div>
                <div>
                    <label className={labelCls}>Kiểu vân <span className="text-red-500">*</span></label>
                    <select className={inputCls} value={form.pattern_type_id} onChange={(e) => set('pattern_type_id', e.target.value)} required>
                        <option value="">-- Chọn kiểu vân --</option>
                        {patternTypes.map((pt) => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Tagline</label>
                    <input className={inputCls} value={form.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="Slogan ngắn..." />
                </div>
                <div>
                    <label className={labelCls}>Mô tả</label>
                    <textarea
                        className="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-y min-h-[80px]"
                        value={form.description}
                        onChange={(e) => set('description', e.target.value)}
                        placeholder="Mô tả bộ sưu tập..."
                    />
                </div>
                <div>
                    <label className={labelCls}>Ảnh thumbnail (URL)</label>
                    <input className={inputCls} value={form.thumbnail_url} onChange={(e) => set('thumbnail_url', e.target.value)} placeholder="https://..." />
                </div>
                <div>
                    <label className={labelCls}>Thứ tự hiển thị</label>
                    <input type="number" className={inputCls} value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} min={0} />
                </div>
                <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary" />
                        <span className="text-sm font-medium text-[#374151]">Hiển thị</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.is_featured} onChange={(e) => set('is_featured', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary" />
                        <span className="text-sm font-medium text-[#374151]">Nổi bật</span>
                    </label>
                </div>
            </div>

            <div className="flex items-center gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => router.back()}>Huỷ</Button>
                <Button type="submit" disabled={isPending} className="gap-2">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isEdit ? 'Cập nhật' : 'Thêm bộ sưu tập'}
                </Button>
            </div>
        </form>
    )
}
