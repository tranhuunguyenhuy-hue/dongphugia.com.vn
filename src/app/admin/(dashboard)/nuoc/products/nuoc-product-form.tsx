'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createNuocProduct, updateNuocProduct } from '@/lib/nuoc-actions'
import { slugify } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2, Save, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImageUploader } from '@/components/ui/image-uploader'

interface LookupItem { id: number; name: string; slug: string }
interface ProductType { id: number; name: string; slug: string; nuoc_subtypes: LookupItem[] }

interface NuocProductFormProps {
    product?: any
    productTypes: ProductType[]
    brands: LookupItem[]
    materials: LookupItem[]
    colors: LookupItem[]
    origins: LookupItem[]
}

interface SpecRow { key: string; value: string }

function parseSpecifications(raw: any): SpecRow[] {
    if (!raw || typeof raw !== 'object') return []
    return Object.entries(raw).map(([key, value]) => ({ key, value: String(value) }))
}

export function NuocProductForm({
    product,
    productTypes,
    brands,
    materials,
    colors,
    origins,
}: NuocProductFormProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const isEdit = !!product

    const [form, setForm] = useState({
        sku: product?.sku || '',
        name: product?.name || '',
        slug: product?.slug || '',
        product_type_id: product?.product_type_id?.toString() || '',
        subtype_id: product?.subtype_id?.toString() || '',
        brand_id: product?.brand_id?.toString() || '',
        material_id: product?.material_id?.toString() || '',
        color_id: product?.color_id?.toString() || '',
        origin_id: product?.origin_id?.toString() || '',
        capacity_liters: product?.capacity_liters?.toString() || '',
        power_watts: product?.power_watts?.toString() || '',
        description: product?.description || '',
        features: product?.features || '',
        warranty_months: product?.warranty_months?.toString() || '24',
        price_display: product?.price_display || 'Liên hệ báo giá',
        image_hover_url: product?.image_hover_url || '',
        is_active: product?.is_active ?? true,
        is_featured: product?.is_featured ?? false,
        is_new: product?.is_new ?? false,
        is_bestseller: product?.is_bestseller ?? false,
        sort_order: product?.sort_order?.toString() || '0',
    })

    const [specRows, setSpecRows] = useState<SpecRow[]>(() =>
        parseSpecifications(product?.specifications)
    )

    const [uploadedImages, setUploadedImages] = useState<string[]>(() => {
        const list: string[] = []
        if (product?.image_main_url) list.push(product.image_main_url)
        if (product?.nuoc_product_images) {
            product.nuoc_product_images.forEach((img: any) => {
                if (img.image_url !== product.image_main_url) list.push(img.image_url)
            })
        }
        return list
    })
    const [mainImage, setMainImage] = useState<string>(product?.image_main_url || '')

    const filteredSubtypes = form.product_type_id
        ? productTypes.find((pt) => pt.id.toString() === form.product_type_id)?.nuoc_subtypes || []
        : []

    const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }))

    const addSpecRow = () => setSpecRows((prev) => [...prev, { key: '', value: '' }])

    const updateSpecRow = (idx: number, field: 'key' | 'value', val: string) => {
        setSpecRows((prev) => prev.map((row, i) => i === idx ? { ...row, [field]: val } : row))
    }

    const removeSpecRow = (idx: number) => {
        setSpecRows((prev) => prev.filter((_, i) => i !== idx))
    }

    const buildSpecifications = (): Record<string, string> => {
        const result: Record<string, string> = {}
        for (const row of specRows) {
            if (row.key.trim()) result[row.key.trim()] = row.value.trim()
        }
        return result
    }

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            const effectiveMain = mainImage || uploadedImages[0] || ''
            const additionals = uploadedImages.filter((url) => url !== effectiveMain)

            const payload = {
                ...form,
                product_type_id: parseInt(form.product_type_id) || 0,
                subtype_id: form.subtype_id ? parseInt(form.subtype_id) : null,
                brand_id: form.brand_id ? parseInt(form.brand_id) : null,
                material_id: form.material_id ? parseInt(form.material_id) : null,
                color_id: form.color_id ? parseInt(form.color_id) : null,
                origin_id: form.origin_id ? parseInt(form.origin_id) : null,
                capacity_liters: form.capacity_liters ? parseInt(form.capacity_liters) : null,
                power_watts: form.power_watts ? parseInt(form.power_watts) : null,
                warranty_months: parseInt(form.warranty_months) || 24,
                sort_order: parseInt(form.sort_order) || 0,
                specifications: buildSpecifications(),
                image_main_url: effectiveMain,
                additional_image_urls: additionals,
            }

            const result = isEdit
                ? await updateNuocProduct(product.id, payload)
                : await createNuocProduct(payload)

            if (result?.errors || result?.message) {
                toast.error(result.message || 'Vui lòng kiểm tra lại dữ liệu')
            } else {
                toast.success(isEdit ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm')
                router.push('/admin/nuoc/products')
            }
        })
    }

    const inputCls = "w-full h-10 px-3 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white"
    const selectCls = "w-full h-10 px-3 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white"
    const labelCls = "block text-sm font-medium text-[#3C4E56] mb-1.5"

    return (
        <form onSubmit={onSubmit} className="space-y-8">
            {/* Basic Info */}
            <div className="bg-white rounded-2xl border border-[#E4EEF2] p-6 space-y-5">
                <h2 className="text-base font-semibold text-foreground">Thông tin cơ bản</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className={labelCls}>SKU <span className="text-red-500">*</span></label>
                        <input
                            className={inputCls}
                            value={form.sku}
                            onChange={(e) => set('sku', e.target.value)}
                            required
                            placeholder="VD: DT-BON-1000L"
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Giá hiển thị</label>
                        <input
                            className={inputCls}
                            value={form.price_display}
                            onChange={(e) => set('price_display', e.target.value)}
                            placeholder="Liên hệ báo giá"
                        />
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
                    <input
                        className={inputCls}
                        value={form.slug}
                        onChange={(e) => set('slug', slugify(e.target.value))}
                        required
                        placeholder="ten-san-pham"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                        URL: /vat-lieu-nuoc/[loai]/<span className="font-mono text-primary">{form.slug || 'slug'}</span>
                    </p>
                </div>
            </div>

            {/* Classification */}
            <div className="bg-white rounded-2xl border border-[#E4EEF2] p-6 space-y-5">
                <h2 className="text-base font-semibold text-foreground">Phân loại</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className={labelCls}>Loại sản phẩm <span className="text-red-500">*</span></label>
                        <select
                            className={selectCls}
                            value={form.product_type_id}
                            onChange={(e) => { set('product_type_id', e.target.value); set('subtype_id', '') }}
                            required
                        >
                            <option value="">-- Chọn loại --</option>
                            {productTypes.map((pt) => (
                                <option key={pt.id} value={pt.id}>{pt.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelCls}>Kiểu dáng (Subtype)</label>
                        <select
                            className={selectCls}
                            value={form.subtype_id}
                            onChange={(e) => set('subtype_id', e.target.value)}
                            disabled={!form.product_type_id}
                        >
                            <option value="">-- Không có --</option>
                            {filteredSubtypes.map((st) => (
                                <option key={st.id} value={st.id}>{st.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelCls}>Thương hiệu</label>
                        <select
                            className={selectCls}
                            value={form.brand_id}
                            onChange={(e) => set('brand_id', e.target.value)}
                        >
                            <option value="">-- Không có --</option>
                            {brands.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelCls}>Chất liệu</label>
                        <select
                            className={selectCls}
                            value={form.material_id}
                            onChange={(e) => set('material_id', e.target.value)}
                        >
                            <option value="">-- Không có --</option>
                            {materials.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelCls}>Màu sắc</label>
                        <select
                            className={selectCls}
                            value={form.color_id}
                            onChange={(e) => set('color_id', e.target.value)}
                        >
                            <option value="">-- Không có --</option>
                            {colors.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelCls}>Xuất xứ</label>
                        <select
                            className={selectCls}
                            value={form.origin_id}
                            onChange={(e) => set('origin_id', e.target.value)}
                        >
                            <option value="">-- Không có --</option>
                            {origins.map((o) => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Thông số đặc thù Vật liệu nước */}
                <div className="pt-4 border-t border-[#E4EEF2]">
                    <h3 className="text-sm font-semibold text-[#3C4E56] mb-4">Thông số đặc thù</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div>
                            <label className={labelCls}>Dung tích (lít)</label>
                            <input
                                type="number"
                                className={inputCls}
                                value={form.capacity_liters}
                                onChange={(e) => set('capacity_liters', e.target.value)}
                                min={0}
                                placeholder="VD: 1000"
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Công suất (W)</label>
                            <input
                                type="number"
                                className={inputCls}
                                value={form.power_watts}
                                onChange={(e) => set('power_watts', e.target.value)}
                                min={0}
                                placeholder="VD: 2500"
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Bảo hành (tháng)</label>
                            <input
                                type="number"
                                className={inputCls}
                                value={form.warranty_months}
                                onChange={(e) => set('warranty_months', e.target.value)}
                                min={0}
                                max={240}
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <label className={labelCls}>Thứ tự hiển thị</label>
                    <input
                        type="number"
                        className={`${inputCls} max-w-[120px]`}
                        value={form.sort_order}
                        onChange={(e) => set('sort_order', e.target.value)}
                        min={0}
                    />
                </div>
            </div>

            {/* Images */}
            <div className="bg-white rounded-2xl border border-[#E4EEF2] p-6 space-y-6">
                <h2 className="text-base font-semibold text-foreground">Hình ảnh sản phẩm</h2>

                <div className="space-y-4">
                    <label className={labelCls}>Thư viện ảnh (Main & Additional)</label>
                    <ImageUploader
                        value={uploadedImages}
                        onChange={(val) => {
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
                        folder="nuoc-products"
                    />

                    {uploadedImages.length > 0 && (
                        <div className="bg-[#F5F9FB] p-4 rounded-xl border border-[#E4EEF2] mt-4">
                            <label className="block text-sm font-medium text-[#2E7A96] mb-3">
                                Chọn 1 ảnh làm ảnh đại diện (Thumbnail)
                            </label>
                            <div className="flex flex-wrap gap-4">
                                {uploadedImages.map((url, idx) => (
                                    <div
                                        key={idx}
                                        className={`relative cursor-pointer rounded-xl border-2 overflow-hidden transition-all ${mainImage === url
                                            ? 'border-[#2E7A96] shadow-md scale-105'
                                            : 'border-transparent hover:border-gray-300'
                                            }`}
                                        onClick={() => setMainImage(url)}
                                    >
                                        <div className="w-24 h-24 relative bg-white">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={url} alt={`img-${idx}`} className="w-full h-full object-cover" />
                                        </div>
                                        {mainImage === url && (
                                            <div className="absolute top-1.5 right-1.5 bg-[#2E7A96] text-white rounded-full p-1 shadow-sm">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="pt-6 border-t border-[#E4EEF2]">
                    <label className={labelCls}>Ảnh khi di chuột (Hover Image)</label>
                    <ImageUploader
                        value={form.image_hover_url}
                        onChange={(val) => set('image_hover_url', Array.isArray(val) ? val[0] : val)}
                        multiple={false}
                        folder="nuoc-products"
                    />
                </div>
            </div>

            {/* Specifications */}
            <div className="bg-white rounded-2xl border border-[#E4EEF2] p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-foreground">Thông số kỹ thuật</h2>
                    <Button type="button" variant="outline" size="sm" onClick={addSpecRow}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Thêm thông số
                    </Button>
                </div>

                {specRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                        Chưa có thông số. Nhấn "Thêm thông số" để bắt đầu.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {specRows.map((row, idx) => (
                            <div key={idx} className="flex gap-3 items-center">
                                <input
                                    className={`${inputCls} flex-1`}
                                    value={row.key}
                                    onChange={(e) => updateSpecRow(idx, 'key', e.target.value)}
                                    placeholder="Tên thông số (VD: Dung tích)"
                                />
                                <input
                                    className={`${inputCls} flex-1`}
                                    value={row.value}
                                    onChange={(e) => updateSpecRow(idx, 'value', e.target.value)}
                                    placeholder="Giá trị (VD: 1000 lít)"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeSpecRow(idx)}
                                    className="shrink-0 h-10 w-10 flex items-center justify-center rounded-lg border border-[#E4EEF2] text-muted-foreground hover:border-red-300 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Description & Features */}
            <div className="bg-white rounded-2xl border border-[#E4EEF2] p-6 space-y-5">
                <h2 className="text-base font-semibold text-foreground">Mô tả & Tính năng</h2>
                <div>
                    <label className={labelCls}>Mô tả sản phẩm</label>
                    <textarea
                        className="w-full px-3 py-2 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-y min-h-[100px]"
                        value={form.description}
                        onChange={(e) => set('description', e.target.value)}
                        placeholder="Mô tả ngắn về sản phẩm..."
                    />
                </div>
                <div>
                    <label className={labelCls}>Tính năng nổi bật</label>
                    <textarea
                        className="w-full px-3 py-2 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-y min-h-[100px]"
                        value={form.features}
                        onChange={(e) => set('features', e.target.value)}
                        placeholder="Các tính năng nổi bật của sản phẩm..."
                    />
                </div>
            </div>

            {/* Settings */}
            <div className="bg-white rounded-2xl border border-[#E4EEF2] p-6">
                <h2 className="text-base font-semibold text-foreground mb-5">Cài đặt</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                        { key: 'is_active', label: 'Hiển thị (is_active)' },
                        { key: 'is_featured', label: 'Sản phẩm nổi bật (is_featured)' },
                        { key: 'is_new', label: 'Sản phẩm mới (is_new)' },
                        { key: 'is_bestseller', label: 'Bán chạy (is_bestseller)' },
                    ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form[key as keyof typeof form] as boolean}
                                onChange={(e) => set(key, e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                            />
                            <span className="text-sm font-medium text-[#3C4E56]">{label}</span>
                        </label>
                    ))}
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
