'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBanner, updateBanner } from '@/lib/actions'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImageUploader } from '@/components/ui/image-uploader'

interface BannerFormProps {
    banner?: any
}

export function BannerForm({ banner }: BannerFormProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const isEdit = !!banner

    const [form, setForm] = useState({
        title: banner?.title || '',
        image_url: banner?.image_url || '',
        link_url: banner?.link_url || '',
        is_active: banner?.is_active ?? true,
        sort_order: banner?.sort_order?.toString() || '0',
    })

    const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }))

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            const payload = {
                ...form,
                sort_order: parseInt(form.sort_order) || 0,
            }
            const result = isEdit
                ? await updateBanner(banner.id, payload)
                : await createBanner(payload)

            if (result?.errors || result?.message) {
                toast.error(result.message || 'Vui lòng kiểm tra lại dữ liệu')
            } else {
                toast.success(isEdit ? 'Đã cập nhật banner' : 'Đã thêm banner')
                router.push('/admin/banners')
            }
        })
    }

    const inputCls = "w-full h-10 px-3 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white"
    const labelCls = "block text-sm font-medium text-[#3C4E56] mb-1.5"

    return (
        <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
            <div className="bg-white rounded-2xl border border-[#E4EEF2] p-6 space-y-5">
                <div>
                    <label className={labelCls}>Tiêu đề (tuỳ chọn)</label>
                    <input
                        className={inputCls}
                        value={form.title}
                        onChange={(e) => set('title', e.target.value)}
                        placeholder="Tiêu đề banner..."
                    />
                </div>
                <div>
                    <ImageUploader
                        label="Ảnh banner *"
                        value={form.image_url}
                        onChange={(v) => set('image_url', v as string)}
                        folder="banners"
                    />
                </div>
                <div>
                    <label className={labelCls}>URL liên kết (tuỳ chọn)</label>
                    <input
                        className={inputCls}
                        value={form.link_url}
                        onChange={(e) => set('link_url', e.target.value)}
                        placeholder="https://..."
                    />
                </div>
                <div>
                    <label className={labelCls}>Thứ tự hiển thị</label>
                    <input
                        type="number"
                        className={inputCls}
                        value={form.sort_order}
                        onChange={(e) => set('sort_order', e.target.value)}
                        min={0}
                    />
                </div>
                <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.is_active}
                            onChange={(e) => set('is_active', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary"
                        />
                        <span className="text-sm font-medium text-[#3C4E56]">Hiển thị</span>
                    </label>
                </div>
            </div>

            <div className="flex items-center gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => router.back()}>Huỷ</Button>
                <Button type="submit" disabled={isPending} className="gap-2">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isEdit ? 'Cập nhật' : 'Thêm banner'}
                </Button>
            </div>
        </form>
    )
}
