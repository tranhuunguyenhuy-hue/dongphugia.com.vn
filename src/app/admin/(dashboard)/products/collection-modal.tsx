'use client'

import { useState, useTransition } from 'react'
import { createCollection, updateCollection } from '@/lib/actions'
import { slugify } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PatternType { id: number; name: string }

export interface CollectionModalData {
    id: number
    name: string
    slug: string
    pattern_type_id: number
    tagline?: string | null
    thumbnail_url?: string | null
    is_active: boolean
    is_featured: boolean
}

interface CollectionModalProps {
    isOpen: boolean
    onClose: () => void
    patternTypes: PatternType[]
    collection?: CollectionModalData
    defaultPatternTypeId?: number
}

export function CollectionModal({
    isOpen,
    onClose,
    patternTypes,
    collection,
    defaultPatternTypeId,
}: CollectionModalProps) {
    const isEdit = !!collection
    const [isPending, startTransition] = useTransition()
    const [form, setForm] = useState({
        name: collection?.name || '',
        slug: collection?.slug || '',
        pattern_type_id: collection?.pattern_type_id?.toString() || defaultPatternTypeId?.toString() || '',
        tagline: collection?.tagline || '',
        thumbnail_url: collection?.thumbnail_url || '',
        is_active: collection?.is_active ?? true,
        is_featured: collection?.is_featured ?? false,
    })

    const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }))

    if (!isOpen) return null

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            const payload = {
                ...form,
                pattern_type_id: parseInt(form.pattern_type_id) || 0,
            }
            const result = isEdit
                ? await updateCollection(collection.id, payload)
                : await createCollection(payload)

            if (result?.errors || result?.message) {
                toast.error(result.message || 'Vui lòng kiểm tra lại dữ liệu')
            } else {
                toast.success(isEdit ? 'Đã cập nhật bộ sưu tập' : 'Đã thêm bộ sưu tập')
                onClose()
            }
        })
    }

    const inputCls = "w-full h-10 px-3 rounded-lg border border-[#e2e8f0] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white"
    const labelCls = "block text-sm font-medium text-[#374151] mb-1.5"

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white rounded-t-2xl">
                    <h2 className="text-base font-semibold">
                        {isEdit ? 'Sửa bộ sưu tập' : 'Thêm bộ sưu tập mới'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={onSubmit} className="p-5 space-y-4">
                    <div>
                        <label className={labelCls}>Tên bộ sưu tập <span className="text-red-500">*</span></label>
                        <input
                            className={inputCls}
                            value={form.name}
                            onChange={(e) => {
                                set('name', e.target.value)
                                if (!isEdit) set('slug', slugify(e.target.value))
                            }}
                            required
                            placeholder="VD: Mystic Collection"
                        />
                    </div>

                    <div>
                        <label className={labelCls}>Slug <span className="text-red-500">*</span></label>
                        <input
                            className={inputCls}
                            value={form.slug}
                            onChange={(e) => set('slug', e.target.value)}
                            required
                            placeholder="mystic-collection"
                        />
                    </div>

                    <div>
                        <label className={labelCls}>Kiểu vân <span className="text-red-500">*</span></label>
                        <select
                            className={inputCls}
                            value={form.pattern_type_id}
                            onChange={(e) => set('pattern_type_id', e.target.value)}
                            required
                        >
                            <option value="">-- Chọn kiểu vân --</option>
                            {patternTypes.map((pt) => (
                                <option key={pt.id} value={pt.id}>{pt.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelCls}>Tagline</label>
                        <input
                            className={inputCls}
                            value={form.tagline}
                            onChange={(e) => set('tagline', e.target.value)}
                            placeholder="Mô tả ngắn về bộ sưu tập..."
                        />
                    </div>

                    <div>
                        <label className={labelCls}>Ảnh thumbnail (URL)</label>
                        <input
                            className={inputCls}
                            value={form.thumbnail_url}
                            onChange={(e) => set('thumbnail_url', e.target.value)}
                            placeholder="https://..."
                        />
                    </div>

                    <div className="flex gap-5">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.is_active}
                                onChange={(e) => set('is_active', e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                            />
                            <span className="text-sm font-medium text-[#374151]">Hiển thị</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.is_featured}
                                onChange={(e) => set('is_featured', e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                            />
                            <span className="text-sm font-medium text-[#374151]">Nổi bật</span>
                        </label>
                    </div>

                    <div className="flex items-center gap-3 justify-end pt-2 border-t border-[#e2e8f0]">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                            Huỷ
                        </Button>
                        <Button type="submit" disabled={isPending} className="gap-2">
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {isEdit ? 'Cập nhật' : 'Thêm mới'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
