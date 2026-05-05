'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { updateCategoryBanner } from '@/lib/actions'
import { ImageUploader } from '@/components/ui/image-uploader'
import { toast } from 'sonner'
import { Save, Loader2, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CategoryBannerManagerProps {
    category: {
        id: number
        name: string
        slug: string
        thumbnail_url: string | null
        banner_url: string | null
    }
}

export function CategoryBannerManager({ category }: CategoryBannerManagerProps) {
    const [bannerUrl, setBannerUrl] = useState<string>(category.banner_url || '')
    const [isPending, startTransition] = useTransition()

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateCategoryBanner(category.id, bannerUrl || null)
            if (result?.success) {
                toast.success(`Đã cập nhật banner cho "${category.name}"`)
            } else {
                toast.error(result?.message || 'Lỗi khi lưu')
            }
        })
    }

    return (
        <div className="bg-white rounded-xl border border-[#E4EEF2] overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#E4EEF2] flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-[#192125] text-[15px]">{category.name}</h2>
                    <p className="text-[12px] text-neutral-400 font-mono mt-0.5">/{category.slug}</p>
                </div>
                <Button size="sm" onClick={handleSave} disabled={isPending} className="gap-1.5">
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Lưu
                </Button>
            </div>

            <div className="p-5 space-y-4">
                {/* Preview banner 16:9 */}
                <div>
                    <p className="text-[12px] font-medium text-neutral-500 mb-2 uppercase tracking-wider">
                        Preview Banner 16:9
                    </p>
                    <div className="relative w-full aspect-video rounded-md overflow-hidden bg-neutral-100 border border-neutral-200">
                        {bannerUrl ? (
                            <Image src={bannerUrl} alt={`Banner ${category.name}`} fill className="object-cover" />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-neutral-50 to-neutral-100">
                                <ImageIcon className="h-8 w-8 text-neutral-300" />
                                <p className="text-[12px] text-neutral-400">Chưa có banner</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Uploader */}
                <ImageUploader
                    label="Ảnh banner (tỉ lệ 16:9)"
                    value={bannerUrl}
                    onChange={(v) => setBannerUrl(v as string)}
                    folder="category-banners"
                />
            </div>
        </div>
    )
}
