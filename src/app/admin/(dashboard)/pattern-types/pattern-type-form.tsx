'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPatternType, updatePatternType } from '@/lib/actions'
import { slugify } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImageUploader } from '@/components/ui/image-uploader'

interface Category { id: number; name: string }

interface PatternTypeFormProps {
    patternType?: any
    categories: Category[]
}

export function PatternTypeForm({ patternType, categories }: PatternTypeFormProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const isEdit = !!patternType

    const [form, setForm] = useState({
        name: patternType?.name || '',
        slug: patternType?.slug || '',
        category_id: patternType?.category_id?.toString() || '',
        description: patternType?.description || '',
        thumbnail_url: patternType?.thumbnail_url || '',
        hero_image_url: patternType?.hero_image_url || '',
        is_active: patternType?.is_active ?? true,
        sort_order: patternType?.sort_order?.toString() || '0',
        seo_title: patternType?.seo_title || '',
        seo_description: patternType?.seo_description || '',
    })

    const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }))

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            const payload = {
                ...form,
                category_id: parseInt(form.category_id) || 0,
                sort_order: parseInt(form.sort_order) || 0,
            }
            const result = isEdit
                ? await updatePatternType(patternType.id, payload)
                : await createPatternType(payload)

            if (result?.errors || result?.message) {
                toast.error(result.message || 'Vui lòng kiểm tra lại dữ liệu')
            } else {
                toast.success(isEdit ? 'Đã cập nhật kiểu vân' : 'Đã thêm kiểu vân')
                router.push('/admin/pattern-types')
            }
        })
    }

    const inputCls = "w-full h-10 px-3 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white"
    const labelCls = "block text-sm font-medium text-[#3C4E56] mb-1.5"

    return (
        <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
            <div className="bg-white rounded-2xl border border-[#E4EEF2] p-6 space-y-5">
                <h2 className="text-base font-semibold">Thông tin cơ bản</h2>

                <div>
                    <label className={labelCls}>Tên kiểu vân <span className="text-red-500">*</span></label>
                    <input
                        className={inputCls}
                        value={form.name}
                        onChange={(e) => {
                            set('name', e.target.value)
                            if (!isEdit) set('slug', slugify(e.target.value))
                        }}
                        required placeholder="Marble, Đá tự nhiên, Vân gỗ..."
                    />
                </div>
                <div>
                    <label className={labelCls}>Slug <span className="text-red-500">*</span></label>
                    <input className={inputCls} value={form.slug} onChange={(e) => set('slug', e.target.value)} required placeholder="marble" />
                </div>
                <div>
                    <label className={labelCls}>Danh mục <span className="text-red-500">*</span></label>
                    <select className={inputCls} value={form.category_id} onChange={(e) => set('category_id', e.target.value)} required>
                        <option value="">-- Chọn danh mục --</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Mô tả</label>
                    <textarea
                        className="w-full px-3 py-2 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-y min-h-[80px]"
                        value={form.description}
                        onChange={(e) => set('description', e.target.value)}
                        placeholder="Mô tả kiểu vân..."
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <ImageUploader
                        label="Ảnh thumbnail"
                        value={form.thumbnail_url}
                        onChange={(v) => set('thumbnail_url', v as string)}
                        folder="pattern-types"
                    />
                    <ImageUploader
                        label="Ảnh hero"
                        value={form.hero_image_url}
                        onChange={(v) => set('hero_image_url', v as string)}
                        folder="pattern-types"
                    />
                </div>
                <div>
                    <label className={labelCls}>Thứ tự hiển thị</label>
                    <input type="number" className={inputCls} value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} min={0} />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary" />
                    <span className="text-sm font-medium text-[#3C4E56]">Hiển thị</span>
                </label>
            </div>

            <div className="bg-white rounded-2xl border border-[#E4EEF2] p-6 space-y-5">
                <h2 className="text-base font-semibold">SEO</h2>
                <div>
                    <label className={labelCls}>SEO Title</label>
                    <input className={inputCls} value={form.seo_title} onChange={(e) => set('seo_title', e.target.value)} placeholder="Tiêu đề SEO (max 200 ký tự)" maxLength={200} />
                </div>
                <div>
                    <label className={labelCls}>SEO Description</label>
                    <textarea
                        className="w-full px-3 py-2 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-y min-h-[80px]"
                        value={form.seo_description}
                        onChange={(e) => set('seo_description', e.target.value)}
                        placeholder="Mô tả SEO (max 500 ký tự)"
                        maxLength={500}
                    />
                </div>
            </div>

            <div className="flex items-center gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => router.back()}>Huỷ</Button>
                <Button type="submit" disabled={isPending} className="gap-2">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isEdit ? 'Cập nhật' : 'Thêm kiểu vân'}
                </Button>
            </div>
        </form>
    )
}
