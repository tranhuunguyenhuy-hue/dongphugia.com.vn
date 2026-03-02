'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createProduct, updateProduct } from '@/lib/actions'
import { slugify } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ImageUploader } from '@/components/ui/image-uploader'

interface LookupItem { id: number; name?: string; label?: string; slug: string }
interface PatternType { id: number; name: string; slug: string }
interface Collection { id: number; name: string; slug: string; pattern_type_id: number }
interface Color { id: number; name: string; slug: string }
interface Location { id: number; name: string; slug: string }

interface ProductFormProps {
    product?: any
    patternTypes: PatternType[]
    allCollections: Collection[]
    surfaces: LookupItem[]
    sizes: LookupItem[]
    origins: LookupItem[]
    colors: Color[]
    locations: Location[]
}

export function ProductForm({
    product,
    patternTypes,
    allCollections,
    surfaces,
    sizes,
    origins,
    colors,
    locations,
}: ProductFormProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const isEdit = !!product

    const [form, setForm] = useState({
        sku: product?.sku || '',
        name: product?.name || '',
        slug: product?.slug || '',
        pattern_type_id: product?.pattern_type_id?.toString() || '',
        collection_id: product?.collection_id?.toString() || '',
        surface_id: product?.surface_id?.toString() || '',
        size_id: product?.size_id?.toString() || '',
        origin_id: product?.origin_id?.toString() || '',
        description: product?.description || '',
        price_display: product?.price_display || 'Liên hệ báo giá',
        image_main_url: product?.image_main_url || '',
        image_hover_url: product?.image_hover_url || '',
        is_active: product?.is_active ?? true,
        is_featured: product?.is_featured ?? false,
        sort_order: product?.sort_order?.toString() || '0',
        color_ids: (product?.product_colors?.map((c: any) => c.color_id) || []) as number[],
        location_ids: (product?.product_locations?.map((l: any) => l.location_id) || []) as number[],
    })

    // Manage all uploaded images in one list
    const [uploadedImages, setUploadedImages] = useState<string[]>(() => {
        const list: string[] = []
        if (product?.image_main_url) list.push(product.image_main_url)
        if (product?.product_images) {
            product.product_images.forEach((img: any) => {
                if (img.image_url !== product.image_main_url) list.push(img.image_url)
            })
        }
        return list
    })
    const [mainImage, setMainImage] = useState<string>(product?.image_main_url || '')

    const filteredCollections = form.pattern_type_id
        ? allCollections.filter((c) => c.pattern_type_id === parseInt(form.pattern_type_id))
        : []

    const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }))

    const toggleId = (key: 'color_ids' | 'location_ids', id: number) => {
        setForm((prev) => {
            const arr = prev[key]
            return { ...prev, [key]: arr.includes(id) ? arr.filter((v) => v !== id) : [...arr, id] }
        })
    }

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            const payload = {
                ...form,
                pattern_type_id: parseInt(form.pattern_type_id) || 0,
                collection_id: form.collection_id ? parseInt(form.collection_id) : null,
                surface_id: form.surface_id ? parseInt(form.surface_id) : null,
                size_id: form.size_id ? parseInt(form.size_id) : null,
                origin_id: form.origin_id ? parseInt(form.origin_id) : null,
                sort_order: parseInt(form.sort_order) || 0,
                image_main_url: mainImage || uploadedImages[0] || '',
                additional_image_urls: uploadedImages.filter(url => url !== (mainImage || uploadedImages[0] || '')),
            }
            const result = isEdit
                ? await updateProduct(product.id, payload)
                : await createProduct(payload)

            if (result?.errors || result?.message) {
                toast.error(result.message || 'Vui lòng kiểm tra lại dữ liệu')
            } else {
                toast.success(isEdit ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm')
                router.push('/admin/products')
            }
        })
    }

    const inputCls = "w-full h-10 px-3 rounded-lg border border-[#e2e8f0] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white"
    const selectCls = "w-full h-10 px-3 rounded-lg border border-[#e2e8f0] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white"
    const labelCls = "block text-sm font-medium text-[#374151] mb-1.5"

    return (
        <form onSubmit={onSubmit} className="space-y-8">
            {/* Basic Info */}
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 space-y-5">
                <h2 className="text-base font-semibold text-foreground">Thông tin cơ bản</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className={labelCls}>SKU <span className="text-red-500">*</span></label>
                        <input className={inputCls} value={form.sku} onChange={(e) => set('sku', e.target.value)} required placeholder="VD: MBL-001" />
                    </div>
                    <div>
                        <label className={labelCls}>Giá hiển thị</label>
                        <input className={inputCls} value={form.price_display} onChange={(e) => set('price_display', e.target.value)} placeholder="Liên hệ báo giá" />
                    </div>
                </div>

                <div>
                    <label className={labelCls}>Tên sản phẩm <span className="text-red-500">*</span></label>
                    <input
                        className={inputCls}
                        value={form.name}
                        onChange={(e) => {
                            set('name', e.target.value)
                            if (!isEdit) set('slug', slugify(e.target.value))
                        }}
                        required
                        placeholder="Tên sản phẩm đầy đủ"
                    />
                </div>

                <div>
                    <label className={labelCls}>Slug <span className="text-red-500">*</span></label>
                    <input className={inputCls} value={form.slug} onChange={(e) => set('slug', slugify(e.target.value))} required placeholder="ten-san-pham" />
                    <p className="mt-1 text-xs text-muted-foreground">URL: /gach-op-lat/[kiểu-vân]/<span className="font-mono text-primary">{form.slug || 'slug'}</span></p>
                </div>
            </div>

            {/* Classification */}
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 space-y-5">
                <h2 className="text-base font-semibold text-foreground">Phân loại</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className={labelCls}>Kiểu vân <span className="text-red-500">*</span></label>
                        <select className={selectCls} value={form.pattern_type_id} onChange={(e) => { set('pattern_type_id', e.target.value); set('collection_id', '') }} required>
                            <option value="">-- Chọn kiểu vân --</option>
                            {patternTypes.map((pt) => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Bộ sưu tập</label>
                        <select className={selectCls} value={form.collection_id} onChange={(e) => set('collection_id', e.target.value)} disabled={!form.pattern_type_id}>
                            <option value="">-- Không có --</option>
                            {filteredCollections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Kích thước</label>
                        <select className={selectCls} value={form.size_id} onChange={(e) => set('size_id', e.target.value)}>
                            <option value="">-- Không có --</option>
                            {sizes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Bề mặt</label>
                        <select className={selectCls} value={form.surface_id} onChange={(e) => set('surface_id', e.target.value)}>
                            <option value="">-- Không có --</option>
                            {surfaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Xuất xứ</label>
                        <select className={selectCls} value={form.origin_id} onChange={(e) => set('origin_id', e.target.value)}>
                            <option value="">-- Không có --</option>
                            {origins.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Thứ tự hiển thị</label>
                        <input type="number" className={inputCls} value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} min={0} />
                    </div>
                </div>

                {/* Colors */}
                <div>
                    <label className={labelCls}>Màu sắc</label>
                    <div className="flex flex-wrap gap-2">
                        {colors.map((c) => {
                            const selected = form.color_ids.includes(c.id)
                            return (
                                <button key={c.id} type="button" onClick={() => toggleId('color_ids', c.id)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selected ? 'bg-primary text-white border-primary' : 'bg-white text-[#374151] border-[#e2e8f0] hover:border-primary/50'}`}>
                                    {c.name}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Locations */}
                <div>
                    <label className={labelCls}>Vị trí ốp lát</label>
                    <div className="flex flex-wrap gap-2">
                        {locations.map((l) => {
                            const selected = form.location_ids.includes(l.id)
                            return (
                                <button key={l.id} type="button" onClick={() => toggleId('location_ids', l.id)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selected ? 'bg-primary text-white border-primary' : 'bg-white text-[#374151] border-[#e2e8f0] hover:border-primary/50'}`}>
                                    {l.name}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Images */}
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 space-y-6">
                <h2 className="text-base font-semibold text-foreground">Hình ảnh sản phẩm</h2>

                <div className="space-y-4">
                    <label className={labelCls}>Thư viện ảnh (Main & Additional)</label>
                    <ImageUploader
                        value={uploadedImages}
                        onChange={val => {
                            const newImages = Array.isArray(val) ? val : [val].filter(Boolean)
                            setUploadedImages(newImages)
                            if (mainImage && !newImages.includes(mainImage)) {
                                setMainImage(newImages[0] || '')
                            } else if (!mainImage && newImages.length > 0) {
                                setMainImage(newImages[0])
                            }
                        }}
                        multiple
                        maxFiles={12}
                        folder="products"
                    />

                    {uploadedImages.length > 0 && (
                        <div className="bg-[#f8fafc] p-4 rounded-xl border border-[#e2e8f0] mt-4">
                            <label className="block text-sm font-medium text-[#15803d] mb-3">Chọn 1 ảnh làm ảnh đại diện (Thumbnail)</label>
                            <div className="flex flex-wrap gap-4">
                                {uploadedImages.map((url, idx) => (
                                    <div
                                        key={idx}
                                        className={`relative cursor-pointer rounded-xl border-2 overflow-hidden transition-all ${mainImage === url ? 'border-[#15803d] shadow-md scale-105' : 'border-transparent hover:border-gray-300'
                                            }`}
                                        onClick={() => setMainImage(url)}
                                    >
                                        <div className="w-24 h-24 relative bg-white">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={url} alt={`img-${idx}`} className="w-full h-full object-cover" />
                                        </div>
                                        {mainImage === url && (
                                            <div className="absolute top-1.5 right-1.5 bg-[#15803d] text-white rounded-full p-1 shadow-sm">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="pt-6 border-t border-[#e2e8f0]">
                    <label className={labelCls}>Ảnh khi di chuột (Hover Image)</label>
                    <ImageUploader
                        value={form.image_hover_url}
                        onChange={val => set('image_hover_url', Array.isArray(val) ? val[0] : val)}
                        multiple={false}
                        folder="products"
                    />
                </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 space-y-5">
                <h2 className="text-base font-semibold text-foreground">Mô tả</h2>
                <textarea
                    className="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-y min-h-[120px]"
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder="Mô tả sản phẩm..."
                />
            </div>

            {/* Settings */}
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
                <h2 className="text-base font-semibold text-foreground mb-5">Cài đặt</h2>
                <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30" />
                        <span className="text-sm font-medium text-[#374151]">Hiển thị (is_active)</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.is_featured} onChange={(e) => set('is_featured', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30" />
                        <span className="text-sm font-medium text-[#374151]">Sản phẩm nổi bật (is_featured)</span>
                    </label>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => router.back()}>Huỷ</Button>
                <Button type="submit" disabled={isPending} className="gap-2">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isEdit ? 'Cập nhật' : 'Thêm sản phẩm'}
                </Button>
            </div>
        </form>
    )
}
