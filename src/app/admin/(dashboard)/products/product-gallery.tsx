'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { Star, Trash2, Upload, Loader2, ImageIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { addProductImages, deleteProductImage, setProductThumbnail } from '@/lib/product-actions'
import { cn } from '@/lib/utils'

interface GalleryImage {
    id: number
    image_url: string
    alt_text?: string | null
    image_type: string
    sort_order: number
}

interface ProductGalleryProps {
    productId: number
    images: GalleryImage[]
    currentThumbnail: string
    onSetThumbnail: (url: string) => void
}

/** Upload a single file via the server-side API route */
async function uploadViaApi(file: File): Promise<string | null> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', 'products')
    const res = await fetch('/api/upload-image', { method: 'POST', body: formData })
    const json = await res.json()
    if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
    return json.url as string
}

export function ProductGallery({ productId, images: initialImages, currentThumbnail, onSetThumbnail }: ProductGalleryProps) {
    const [images, setImages] = useState<GalleryImage[]>(initialImages)
    const [uploading, setUploading] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [settingThumbnail, setSettingThumbnail] = useState<number | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFiles = useCallback(async (files: FileList | File[]) => {
        const fileArray = Array.from(files)
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        const invalid = fileArray.filter(f => !allowed.includes(f.type))
        if (invalid.length > 0) {
            toast.error('Chỉ hỗ trợ JPG, PNG, WebP, GIF')
            return
        }
        if (fileArray.length > 20) {
            toast.error('Tối đa 20 ảnh một lần')
            return
        }

        setUploading(true)
        try {
            // Upload all files in parallel
            const results = await Promise.allSettled(fileArray.map(f => uploadViaApi(f)))
            const urls: string[] = []
            const errors: string[] = []

            results.forEach((result, i) => {
                if (result.status === 'fulfilled' && result.value) {
                    urls.push(result.value)
                } else if (result.status === 'rejected') {
                    errors.push(`${fileArray[i].name}: ${result.reason?.message}`)
                }
            })

            if (errors.length > 0) toast.error(`Lỗi upload: ${errors.join(', ')}`)

            if (urls.length > 0) {
                // Save to database
                const res = await addProductImages(productId, urls)
                if (res?.message) {
                    toast.error(res.message)
                } else {
                    // Add to local state with fake IDs (will be real after page refresh)
                    const newImages = urls.map((url, i) => ({
                        id: Date.now() + i,
                        image_url: url,
                        alt_text: null,
                        image_type: 'gallery',
                        sort_order: images.length + i,
                    }))
                    setImages(prev => [...prev, ...newImages])
                    toast.success(`Đã thêm ${urls.length} ảnh vào gallery`)
                }
            }
        } catch (err: any) {
            toast.error('Lỗi upload: ' + err.message)
        } finally {
            setUploading(false)
        }
    }, [images.length, productId])

    const handleDelete = async (imageId: number) => {
        setDeletingId(imageId)
        const res = await deleteProductImage(imageId, productId)
        if (res?.message) {
            toast.error(res.message)
        } else {
            setImages(prev => prev.filter(img => img.id !== imageId))
            toast.success('Đã xóa ảnh')
        }
        setDeletingId(null)
    }

    const handleSetThumbnail = async (imageId: number, imageUrl: string) => {
        setSettingThumbnail(imageId)
        const res = await setProductThumbnail(productId, imageUrl)
        if (res?.message) {
            toast.error(res.message)
        } else {
            onSetThumbnail(imageUrl)
            toast.success('Đã đặt làm ảnh đại diện')
        }
        setSettingThumbnail(null)
    }

    return (
        <div className="space-y-3 pt-4 border-t border-[#E4EEF2]">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-[#3C4E56]">Gallery ảnh ({images.length})</p>
                    <p className="text-xs text-muted-foreground">Kéo thả hoặc nhấn để upload nhiều ảnh. Bấm ⭐ để đặt làm thumbnail.</p>
                </div>
            </div>

            {/* Image Grid */}
            {images.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {images.map(img => {
                        const isThumbnail = img.image_url === currentThumbnail
                        return (
                            <div
                                key={img.id}
                                className={cn(
                                    "relative group rounded-lg overflow-hidden border-2 aspect-square bg-neutral-100 transition-all",
                                    isThumbnail ? "border-amber-400 ring-2 ring-amber-200" : "border-[#E4EEF2] hover:border-[#2E7A96]"
                                )}
                            >
                                <Image
                                    src={img.image_url}
                                    alt={img.alt_text || 'Product image'}
                                    fill
                                    className="object-cover"
                                    sizes="150px"
                                    unoptimized
                                />
                                {/* Thumbnail badge */}
                                {isThumbnail && (
                                    <div className="absolute top-1 left-1 bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                        THUMBNAIL
                                    </div>
                                )}
                                {/* Action overlay */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                                    {/* Set as thumbnail */}
                                    {!isThumbnail && (
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="secondary"
                                            className="h-8 w-8 bg-white/90 hover:bg-amber-50"
                                            title="Đặt làm thumbnail"
                                            disabled={settingThumbnail === img.id}
                                            onClick={() => handleSetThumbnail(img.id, img.image_url)}
                                        >
                                            {settingThumbnail === img.id ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Star className="h-3.5 w-3.5 text-amber-500" />
                                            )}
                                        </Button>
                                    )}
                                    {/* Delete */}
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="secondary"
                                        className="h-8 w-8 bg-white/90 hover:bg-red-50"
                                        title="Xóa ảnh"
                                        disabled={deletingId === img.id}
                                        onClick={() => handleDelete(img.id)}
                                    >
                                        {deletingId === img.id ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Upload dropzone */}
            <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files) }}
                onClick={() => inputRef.current?.click()}
                className={cn(
                    "border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors",
                    dragOver
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
                    uploading && "pointer-events-none opacity-60"
                )}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }}
                    className="hidden"
                />
                {uploading ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-7 w-7 animate-spin" />
                        <p className="text-sm">Đang upload...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <div className="rounded-full bg-muted p-2.5">
                            <Upload className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-medium">Kéo thả hoặc nhấn để thêm ảnh gallery</p>
                        <p className="text-xs">JPG, PNG, WebP, GIF — Tối đa 5MB/ảnh · 20 ảnh/lần</p>
                    </div>
                )}
            </div>
        </div>
    )
}
