'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createProduct, updateProduct } from '@/lib/product-actions'
import { toast } from 'sonner'
import { Loader2, Save, ArrowLeft, Tag, DollarSign, Image as ImageIcon, FileText, Settings, Search as SearchIcon, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImageUploader } from '@/components/ui/image-uploader'
import { ProductGallery } from './product-gallery'
import Link from 'next/link'

// Slug generation utility
function generateSlug(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/đ/g, 'd').replace(/Đ/g, 'd')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
}

interface LookupItem { id: number; name: string; slug?: string }
interface SubcategoryItem extends LookupItem { category_id: number }
interface ColorItem extends LookupItem { hex_code?: string | null }

interface ProductFormProps {
    product?: any // Full product data from getAdminProductById
    categories: LookupItem[]
    subcategories: SubcategoryItem[]
    brands: LookupItem[]
    origins: LookupItem[]
    colors: ColorItem[]
    materials: LookupItem[]
}

export function ProductForm({ product, categories, subcategories, brands, origins, colors, materials }: ProductFormProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const isEdit = !!product

    const [form, setForm] = useState({
        sku: product?.sku || '',
        name: product?.name || '',
        display_name: product?.display_name || '',
        slug: product?.slug || '',
        category_id: product?.category_id?.toString() || '',
        subcategory_id: product?.subcategory_id?.toString() || '',
        brand_id: product?.brand_id?.toString() || '',
        origin_id: product?.origin_id?.toString() || '',
        color_id: product?.color_id?.toString() || '',
        material_id: product?.material_id?.toString() || '',
        price: product?.price?.toString() || '',
        original_price: product?.original_price?.toString() || '',
        price_display: product?.price_display || 'Liên hệ báo giá',
        description: product?.description || '',
        features: product?.features || '',
        warranty_months: product?.warranty_months?.toString() || '',
        image_main_url: product?.image_main_url || '',
        image_hover_url: product?.image_hover_url || '',
        stock_status: product?.stock_status || 'in_stock',
        is_active: product?.is_active ?? true,
        is_featured: product?.is_featured ?? false,
        is_new: product?.is_new ?? false,
        is_bestseller: product?.is_bestseller ?? false,
        sort_order: product?.sort_order?.toString() || '0',
        product_type: product?.product_type || '',
        product_sub_type: product?.product_sub_type || '',
        source_url: product?.source_url || '',
        hita_product_id: product?.hita_product_id || '',
        seo_title: product?.seo_title || '',
        seo_description: product?.seo_description || '',
    })

    const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }))

    // Auto-slug when name changes (only for new products)
    const handleNameChange = (name: string) => {
        set('name', name)
        if (!isEdit || !form.slug) {
            set('slug', generateSlug(name))
        }
    }

    // Filter subcategories by selected category
    const filteredSubcategories = useMemo(() => {
        if (!form.category_id) return []
        return subcategories.filter(s => s.category_id === Number(form.category_id))
    }, [form.category_id, subcategories])

    // Calculate discount percentage for preview
    const discountPercent = useMemo(() => {
        const price = parseFloat(form.price)
        const original = parseFloat(form.original_price)
        if (original && price && original > price) {
            return Math.round(((original - price) / original) * 100)
        }
        return 0
    }, [form.price, form.original_price])

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            const payload = {
                ...form,
                category_id: Number(form.category_id),
                subcategory_id: form.subcategory_id ? Number(form.subcategory_id) : null,
                brand_id: form.brand_id ? Number(form.brand_id) : null,
                origin_id: form.origin_id ? Number(form.origin_id) : null,
                color_id: form.color_id ? Number(form.color_id) : null,
                material_id: form.material_id ? Number(form.material_id) : null,
                price: form.price ? Number(form.price) : null,
                original_price: form.original_price ? Number(form.original_price) : null,
                warranty_months: form.warranty_months ? Number(form.warranty_months) : null,
                sort_order: Number(form.sort_order) || 0,
                specs: {},
                display_name: form.display_name || null,
                product_type: form.product_type || null,
                product_sub_type: form.product_sub_type || null,
                source_url: form.source_url || null,
                hita_product_id: form.hita_product_id || null,
                seo_title: form.seo_title || null,
                seo_description: form.seo_description || null,
            }

            const result = isEdit
                ? await updateProduct(product.id, payload)
                : await createProduct(payload)

            if (result?.errors) {
                const firstError = Object.values(result.errors).flat()[0]
                toast.error(String(firstError) || 'Vui lòng kiểm tra lại dữ liệu')
            } else if (result?.message) {
                toast.error(result.message)
            } else {
                toast.success(isEdit ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm mới')
                router.push('/admin/products')
                router.refresh()
            }
        })
    }

    const inputCls = "w-full h-10 px-3 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white"
    const selectCls = "w-full h-10 px-3 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white appearance-none"
    const labelCls = "block text-sm font-medium text-[#3C4E56] mb-1.5"
    const sectionCls = "bg-white rounded-2xl border border-[#E4EEF2] p-6 space-y-5"
    const sectionTitleCls = "flex items-center gap-2 text-base font-semibold text-[#1A2B34] pb-3 border-b border-[#E4EEF2] mb-4"

    return (
        <form onSubmit={onSubmit} className="space-y-6 max-w-4xl">
            {/* ── Section 1: Thông tin cơ bản ───────────────────────────── */}
            <div className={sectionCls}>
                <div className={sectionTitleCls}>
                    <Tag className="h-4 w-4 text-[#2E7A96]" />
                    Thông tin cơ bản
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className={labelCls}>Tên sản phẩm *</label>
                        <input
                            className={inputCls}
                            value={form.name}
                            onChange={e => handleNameChange(e.target.value)}
                            placeholder="VD: Bồn cầu 1 khối INAX AC-4005VN"
                            required
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Tên hiển thị (tuỳ chọn)</label>
                        <input
                            className={inputCls}
                            value={form.display_name}
                            onChange={e => set('display_name', e.target.value)}
                            placeholder="Tên rút gọn hiển thị trên card..."
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Mã SKU *</label>
                        <input
                            className={inputCls}
                            value={form.sku}
                            onChange={e => set('sku', e.target.value)}
                            placeholder="VD: INAX-AC4005VN"
                            required
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelCls}>Slug (URL) *</label>
                        <input
                            className={inputCls}
                            value={form.slug}
                            onChange={e => set('slug', e.target.value)}
                            placeholder="bon-cau-1-khoi-inax-ac-4005vn"
                            required
                        />
                        <p className="text-xs text-muted-foreground mt-1">Tự động tạo từ tên. Sửa tay nếu cần.</p>
                    </div>
                </div>
            </div>

            {/* ── Section 2: Phân loại ─────────────────────────────────── */}
            <div className={sectionCls}>
                <div className={sectionTitleCls}>
                    <Sparkles className="h-4 w-4 text-[#2E7A96]" />
                    Phân loại
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label className={labelCls}>Danh mục *</label>
                        <select
                            className={selectCls}
                            value={form.category_id}
                            onChange={e => {
                                set('category_id', e.target.value)
                                set('subcategory_id', '') // Reset sub when cat changes
                            }}
                            required
                        >
                            <option value="">Chọn danh mục</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Danh mục con</label>
                        <select
                            className={selectCls}
                            value={form.subcategory_id}
                            onChange={e => set('subcategory_id', e.target.value)}
                        >
                            <option value="">Không chọn</option>
                            {filteredSubcategories.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Thương hiệu</label>
                        <select
                            className={selectCls}
                            value={form.brand_id}
                            onChange={e => set('brand_id', e.target.value)}
                        >
                            <option value="">Không chọn</option>
                            {brands.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Xuất xứ</label>
                        <select
                            className={selectCls}
                            value={form.origin_id}
                            onChange={e => set('origin_id', e.target.value)}
                        >
                            <option value="">Không chọn</option>
                            {origins.map(o => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Màu sắc</label>
                        <div className="relative">
                            {/* Preview swatch of selected color */}
                            {form.color_id && (() => {
                                const sel = colors.find(c => c.id === Number(form.color_id))
                                return sel ? (
                                    <span
                                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-black/10 shadow-sm z-10"
                                        style={{ backgroundColor: sel.hex_code || '#ccc' }}
                                    />
                                ) : null
                            })()}
                            <select
                                className={`${selectCls} ${form.color_id ? 'pl-9' : ''}`}
                                value={form.color_id}
                                onChange={e => set('color_id', e.target.value)}
                            >
                                <option value="">Không chọn</option>
                                {colors.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}{c.hex_code ? ` (${c.hex_code})` : ''}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className={labelCls}>Chất liệu</label>
                        <select
                            className={selectCls}
                            value={form.material_id}
                            onChange={e => set('material_id', e.target.value)}
                        >
                            <option value="">Không chọn</option>
                            {materials.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                {/* Product Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[#E4EEF2]">
                    <div>
                        <label className={labelCls}>Loại sản phẩm</label>
                        <input
                            className={inputCls}
                            value={form.product_type}
                            onChange={e => set('product_type', e.target.value)}
                            placeholder="VD: don-le, bo-combo"
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Loại phụ</label>
                        <input
                            className={inputCls}
                            value={form.product_sub_type}
                            onChange={e => set('product_sub_type', e.target.value)}
                            placeholder="VD: 1-khoi, 2-khoi"
                        />
                    </div>
                </div>
            </div>

            {/* ── Section 3: Giá cả ───────────────────────────────────── */}
            <div className={sectionCls}>
                <div className={sectionTitleCls}>
                    <DollarSign className="h-4 w-4 text-[#2E7A96]" />
                    Giá cả
                    {discountPercent > 0 && (
                        <span className="ml-auto text-xs font-bold text-white bg-red-500 px-2.5 py-1 rounded-full">
                            -{discountPercent}%
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className={labelCls}>Giá bán (VNĐ)</label>
                        <input
                            type="number"
                            className={inputCls}
                            value={form.price}
                            onChange={e => set('price', e.target.value)}
                            placeholder="0"
                            min={0}
                            step={1000}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Giá gốc (VNĐ) — Gạch ngang</label>
                        <input
                            type="number"
                            className={inputCls}
                            value={form.original_price}
                            onChange={e => set('original_price', e.target.value)}
                            placeholder="0"
                            min={0}
                            step={1000}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Để trống nếu không giảm giá. Nhập giá cao hơn giá bán để hiển thị tag giảm giá.</p>
                    </div>
                    <div>
                        <label className={labelCls}>Văn bản giá</label>
                        <input
                            className={inputCls}
                            value={form.price_display}
                            onChange={e => set('price_display', e.target.value)}
                            placeholder="Liên hệ báo giá"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Tồn kho</label>
                        <select
                            className={selectCls}
                            value={form.stock_status}
                            onChange={e => set('stock_status', e.target.value)}
                        >
                            <option value="in_stock">Còn hàng</option>
                            <option value="out_of_stock">Hết hàng</option>
                            <option value="preorder">Đặt trước</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Bảo hành (tháng)</label>
                        <input
                            type="number"
                            className={inputCls}
                            value={form.warranty_months}
                            onChange={e => set('warranty_months', e.target.value)}
                            placeholder="12"
                            min={0}
                        />
                    </div>
                </div>
            </div>

            {/* ── Section 4: Hình ảnh ─────────────────────────────────── */}
            <div className={sectionCls}>
                <div className={sectionTitleCls}>
                    <ImageIcon className="h-4 w-4 text-[#2E7A96]" />
                    Hình ảnh sản phẩm
                </div>

                {/* Thumbnail (ảnh chính) */}
                <div>
                    <label className={labelCls}>Ảnh đại diện (Thumbnail)</label>
                    <p className="text-xs text-muted-foreground mb-3">Ảnh hiển thị trên Product Card. Bấm ⭐ trên ảnh gallery bên dưới để đổi.</p>
                    <ImageUploader
                        label=""
                        value={form.image_main_url}
                        onChange={v => set('image_main_url', v as string)}
                        folder="products"
                    />
                </div>

                {/* Gallery multi-upload — chỉ hiện khi đang edit sản phẩm đã có ID */}
                {isEdit && (
                    <ProductGallery
                        productId={product.id}
                        images={product.product_images || []}
                        currentThumbnail={form.image_main_url}
                        onSetThumbnail={(url: string) => set('image_main_url', url)}
                    />
                )}
                {!isEdit && (
                    <div className="rounded-lg border-2 border-dashed border-[#E4EEF2] p-6 text-center text-muted-foreground text-sm">
                        💡 Lưu sản phẩm trước, sau đó quay lại để thêm ảnh gallery.
                    </div>
                )}
            </div>

            {/* ── Section 5: Mô tả & Tính năng ───────────────────────── */}
            <div className={sectionCls}>
                <div className={sectionTitleCls}>
                    <FileText className="h-4 w-4 text-[#2E7A96]" />
                    Mô tả & Tính năng
                </div>
                <div>
                    <label className={labelCls}>Mô tả chi tiết</label>
                    <textarea
                        className="w-full px-3 py-2 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white min-h-[120px] resize-y"
                        value={form.description}
                        onChange={e => set('description', e.target.value)}
                        placeholder="Mô tả đầy đủ sản phẩm..."
                        rows={5}
                    />
                </div>
                <div>
                    <label className={labelCls}>Tính năng (HTML)</label>
                    <textarea
                        className="w-full px-3 py-2 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white min-h-[100px] resize-y font-mono"
                        value={form.features}
                        onChange={e => set('features', e.target.value)}
                        placeholder="<ul><li>Tính năng 1</li></ul>"
                        rows={4}
                    />
                </div>
            </div>

            {/* ── Section 6: SEO ──────────────────────────────────────── */}
            <div className={sectionCls}>
                <div className={sectionTitleCls}>
                    <SearchIcon className="h-4 w-4 text-[#2E7A96]" />
                    SEO
                </div>
                <div>
                    <label className={labelCls}>SEO Title</label>
                    <input
                        className={inputCls}
                        value={form.seo_title}
                        onChange={e => set('seo_title', e.target.value)}
                        placeholder="Tiêu đề SEO (tối đa 200 ký tự)"
                        maxLength={200}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{form.seo_title.length}/200 ký tự</p>
                </div>
                <div>
                    <label className={labelCls}>SEO Description</label>
                    <textarea
                        className="w-full px-3 py-2 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white min-h-[80px] resize-y"
                        value={form.seo_description}
                        onChange={e => set('seo_description', e.target.value)}
                        placeholder="Mô tả SEO (tối đa 500 ký tự)"
                        maxLength={500}
                        rows={3}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{form.seo_description.length}/500 ký tự</p>
                </div>
            </div>

            {/* ── Section 7: Cài đặt ─────────────────────────────────── */}
            <div className={sectionCls}>
                <div className={sectionTitleCls}>
                    <Settings className="h-4 w-4 text-[#2E7A96]" />
                    Cài đặt & Hiển thị
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { key: 'is_active', label: 'Hiển thị', color: 'text-emerald-600' },
                        { key: 'is_featured', label: 'Nổi bật', color: 'text-amber-600' },
                        { key: 'is_new', label: 'Sản phẩm mới', color: 'text-blue-600' },
                        { key: 'is_bestseller', label: 'Bán chạy', color: 'text-red-600' },
                    ].map(({ key, label, color }) => (
                        <label key={key} className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-[#E4EEF2] hover:bg-[#F8FAFB] transition-colors">
                            <input
                                type="checkbox"
                                checked={(form as any)[key]}
                                onChange={e => set(key, e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary"
                            />
                            <span className={`text-sm font-medium ${color}`}>{label}</span>
                        </label>
                    ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-[#E4EEF2]">
                    <div>
                        <label className={labelCls}>Thứ tự sắp xếp</label>
                        <input
                            type="number"
                            className={inputCls}
                            value={form.sort_order}
                            onChange={e => set('sort_order', e.target.value)}
                            min={0}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Nguồn gốc URL</label>
                        <input
                            className={inputCls}
                            value={form.source_url}
                            onChange={e => set('source_url', e.target.value)}
                            placeholder="https://..."
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Hita Product ID</label>
                        <input
                            className={inputCls}
                            value={form.hita_product_id}
                            onChange={e => set('hita_product_id', e.target.value)}
                            placeholder="ID từ hệ thống Hita"
                        />
                    </div>
                </div>
            </div>

            {/* ── Action Buttons ────────────────────────────────────── */}
            <div className="flex items-center gap-3 justify-between sticky bottom-0 bg-[#F8FAFB]/95 backdrop-blur-sm py-4 px-1 -mx-1 border-t border-[#E4EEF2]">
                <Link href="/admin/products">
                    <Button type="button" variant="outline" className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Quay lại
                    </Button>
                </Link>
                <Button type="submit" disabled={isPending} className="gap-2 min-w-[160px]">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isEdit ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm'}
                </Button>
            </div>
        </form>
    )
}
