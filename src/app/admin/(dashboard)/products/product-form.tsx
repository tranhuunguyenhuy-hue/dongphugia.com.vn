'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createProduct, updateProduct } from '@/lib/product-actions'
import { toast } from 'sonner'
import { Loader2, Save, ArrowLeft, Image as ImageIcon, Sparkles, LayoutGrid, Tag, Settings2, FileText, SearchIcon, Upload, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ImageUploader } from '@/components/ui/image-uploader'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { ProductGallery } from './product-gallery'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import Link from 'next/link'
import { ProductRelationshipPicker } from './product-relationship-picker'
import { QuickCreateProductModal } from './quick-create-product-modal'
import { addProductRelationship, removeProductRelationship } from '@/lib/product-actions'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// Slug generation utility
function generateSlug(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'd')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
}

// Validation Schema
const formSchema = z.object({
    sku: z.string().min(1, 'Mã SKU là bắt buộc'),
    name: z.string().min(1, 'Tên sản phẩm là bắt buộc'),
    display_name: z.string().optional(),
    slug: z.string().min(1, 'Slug là bắt buộc'),
    category_id: z.string().min(1, 'Danh mục là bắt buộc'),
    subcategory_id: z.string().optional(),
    brand_id: z.string().optional(),
    origin_id: z.string().optional(),
    color_id: z.string().optional(),
    material_id: z.string().optional(),
    price: z.string().optional(),
    original_price: z.string().optional(),
    price_display: z.string().optional(),
    description: z.string().optional(),
    features: z.string().optional(),
    warranty_months: z.string().optional(),
    image_main_url: z.string().optional(),
    stock_status: z.string().optional(),
    is_active: z.boolean().optional(),
    is_featured: z.boolean().optional(),
    is_new: z.boolean().optional(),
    is_bestseller: z.boolean().optional(),
    sort_order: z.string().optional(),
    product_type: z.string().optional(),
    product_sub_type: z.string().optional(),
    source_url: z.string().optional(),
    hita_product_id: z.string().optional(),
    seo_title: z.string().optional(),
    seo_description: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface LookupItem { id: number; name: string; slug?: string }
interface SubcategoryItem extends LookupItem { category_id: number }
interface ColorItem extends LookupItem { hex_code?: string | null }
interface FilterDefinitionItem {
    id: number;
    category_id: number | null;
    subcategory_id: number | null;
    filter_key: string;
    filter_label: string;
    filter_type: string;
    options: any;
    sort_order: number;
}

interface ProductTypeItem {
    subcategory_id: number | null;
    product_type: string | null;
    product_sub_type: string | null;
}

interface ProductFormProps {
    pageTitle: string
    pageSubtitle?: string
    product?: any // Full product data from getAdminProductById
    categories: LookupItem[]
    subcategories: SubcategoryItem[]
    brands: LookupItem[]
    origins: LookupItem[]
    colors: ColorItem[]
    materials: LookupItem[]
    filterDefinitions?: FilterDefinitionItem[]
    productTypes?: ProductTypeItem[]
}

export function ProductForm({ pageTitle, pageSubtitle, product, categories, subcategories, brands, origins, colors, materials, filterDefinitions = [], productTypes = [] }: ProductFormProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const isEdit = !!product

    // Specs state is still separate as it's dynamic
    const [specs, setSpecs] = useState<Record<string, any>>(
        typeof product?.specs === 'string' ? JSON.parse(product.specs) : product?.specs || {}
    )

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
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
        }
    })

    const categoryId = form.watch('category_id')
    const subcategoryId = form.watch('subcategory_id')
    const currentPrice = form.watch('price')
    const currentOriginalPrice = form.watch('original_price')
    const currentProductType = form.watch('product_type')

    const filteredSubcategories = useMemo(() => {
        if (!categoryId) return []
        return subcategories.filter(s => s.category_id === Number(categoryId))
    }, [categoryId, subcategories])

    const availableProductTypes = useMemo(() => {
        if (!subcategoryId || !productTypes.length) return []
        const subId = Number(subcategoryId)
        const types = productTypes
            .filter(t => t.subcategory_id === subId && t.product_type)
            .map(t => t.product_type as string)
        return Array.from(new Set(types)).sort()
    }, [subcategoryId, productTypes])

    const availableProductSubTypes = useMemo(() => {
        if (!subcategoryId || !currentProductType || !productTypes.length) return []
        const subId = Number(subcategoryId)
        const types = productTypes
            .filter(t => t.subcategory_id === subId && t.product_type === currentProductType && t.product_sub_type)
            .map(t => t.product_sub_type as string)
        return Array.from(new Set(types)).sort()
    }, [subcategoryId, currentProductType, productTypes])

    const relevantFilters = useMemo(() => {
        const EXCLUDED_KEYS = ['brand', 'thuong-hieu', 'price', 'khoang-gia', 'origin', 'xuat-xu', 'color', 'mau-sac', 'material', 'chat-lieu']
        const filtered = filterDefinitions.filter(f => {
            if (EXCLUDED_KEYS.includes(f.filter_key.toLowerCase())) return false;
            const isGlobal = f.category_id === null && f.subcategory_id === null;
            const isCategorySpecific = f.category_id === Number(categoryId) && f.subcategory_id === null;
            const isSubcategorySpecific = f.subcategory_id === Number(subcategoryId);

            if (subcategoryId) {
                return isSubcategorySpecific || isCategorySpecific || isGlobal;
            } else if (categoryId) {
                return isCategorySpecific || isGlobal;
            }
            return isGlobal;
        })

        const uniqueFilters = new Map<string, typeof filtered[0]>()
        filtered.forEach(f => {
            const existing = uniqueFilters.get(f.filter_key)
            if (!existing) {
                uniqueFilters.set(f.filter_key, f)
            } else {
                const getSpecificity = (filter: typeof f) => {
                    if (filter.subcategory_id) return 3
                    if (filter.category_id) return 2
                    return 1
                }
                if (getSpecificity(f) > getSpecificity(existing)) {
                    uniqueFilters.set(f.filter_key, f)
                }
            }
        })
        return Array.from(uniqueFilters.values()).sort((a, b) => a.sort_order - b.sort_order)
    }, [filterDefinitions, categoryId, subcategoryId])

    const discountPercent = useMemo(() => {
        const price = parseFloat(currentPrice || '0')
        const original = parseFloat(currentOriginalPrice || '0')
        if (original && price && original > price) {
            return Math.round(((original - price) / original) * 100)
        }
        return 0
    }, [currentPrice, currentOriginalPrice])

    const onSubmit = (values: FormValues) => {
        startTransition(async () => {
            const payload = {
                ...values,
                category_id: Number(values.category_id),
                subcategory_id: values.subcategory_id ? Number(values.subcategory_id) : null,
                brand_id: values.brand_id ? Number(values.brand_id) : null,
                origin_id: values.origin_id ? Number(values.origin_id) : null,
                color_id: values.color_id ? Number(values.color_id) : null,
                material_id: values.material_id ? Number(values.material_id) : null,
                price: values.price ? Number(values.price) : null,
                original_price: values.original_price ? Number(values.original_price) : null,
                warranty_months: values.warranty_months ? Number(values.warranty_months) : null,
                sort_order: Number(values.sort_order) || 0,
                specs: specs,
                display_name: values.display_name || null,
                product_type: values.product_type || null,
                product_sub_type: values.product_sub_type || null,
                source_url: values.source_url || null,
                hita_product_id: values.hita_product_id || null,
                seo_title: values.seo_title || null,
                seo_description: values.seo_description || null,
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

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="relative w-full pb-10 admin-theme">
                {/* Top Action Bar */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/admin/products"
                            className="h-9 w-9 flex items-center justify-center rounded-lg border border-[#E4EEF2] text-muted-foreground hover:bg-muted transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
                            {pageSubtitle && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{pageSubtitle}</p>}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button type="button" variant="outline" className="rounded-full px-6 bg-white shadow-none border-[#E4EEF2] hover:bg-stone-50">
                                    Huỷ
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="admin-theme">
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Bạn có chắc chắn muốn huỷ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Các thay đổi của bạn sẽ không được lưu. Hành động này không thể hoàn tác.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="shadow-none rounded-md">Trở lại</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => router.push('/admin/products')} className="bg-red-600 hover:bg-red-700 text-white shadow-none rounded-md">
                                        Đồng ý huỷ
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        <Button type="submit" disabled={isPending} className="gap-2 rounded-full px-8 bg-stone-900 hover:bg-stone-800 text-white shadow-none">
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {isEdit ? 'Cập nhật' : 'Lưu sản phẩm'}
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 items-start">
                    {/* ── LEFT COLUMN ────────────────────────────────────────── */}
                    <div className="w-full lg:w-[320px] xl:w-[380px] space-y-6 flex-shrink-0 lg:sticky lg:top-[88px]">
                        
                        {/* Hình ảnh sản phẩm */}
                        <Card className="shadow-none rounded-xl overflow-hidden p-0 gap-0">
                            <CardHeader className="bg-stone-100 border-b px-5 !py-3">
                                <CardTitle className="text-base font-semibold text-stone-900">Hình ảnh sản phẩm
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Quản lý ảnh đại diện và thư viện ảnh.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-5">
                                {isEdit ? (
                                    <ProductGallery
                                        productId={product.id}
                                        images={product.product_images || []}
                                        currentThumbnail={form.watch('image_main_url') || ''}
                                        onSetThumbnail={(url: string) => form.setValue('image_main_url', url)}
                                    />
                                ) : (
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="image_main_url"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-sm font-semibold text-[#1A2B34]">Ảnh đại diện</FormLabel>
                                                    <FormControl>
                                                        <ImageUploader
                                                            label=""
                                                            value={field.value || ''}
                                                            onChange={v => field.onChange(v as string)}
                                                            folder="products"
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <div className="rounded-lg border-2 border-dashed border-[#E4EEF2] p-3 text-center text-muted-foreground flex items-center justify-center gap-3">
                                            <div className="rounded-full bg-stone-100 p-2">
                                                <Upload className="h-4 w-4 text-stone-500" />
                                            </div>
                                            <p className="text-sm font-medium text-left">Lưu sản phẩm trước để sử dụng Thư viện ảnh</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>



                        {/* Phân loại Cơ bản */}
                        <Card className="shadow-none rounded-xl overflow-hidden p-0 gap-0">
                            <CardHeader className="bg-stone-100 border-b px-5 !py-3">
                                <CardTitle className="text-base font-semibold text-stone-900">Phân loại chi tiết
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-5 space-y-4">
                                <FormField
                                    control={form.control}
                                    name="category_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Danh mục chính *</FormLabel>
                                            <Select onValueChange={(val) => { field.onChange(val); form.setValue('subcategory_id', '') }} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Chọn danh mục" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {categoryId && (
                                    <FormField
                                        control={form.control}
                                        name="subcategory_id"
                                        render={({ field }) => (
                                            <FormItem className="animate-in fade-in slide-in-from-top-2 duration-300">
                                                <FormLabel>Danh mục con</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Không chọn" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {filteredSubcategories.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                                {subcategoryId && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        {availableProductTypes.length > 0 && (
                                            <FormField
                                                control={form.control}
                                                name="product_type"
                                                render={({ field }) => (
                                                    <FormItem className="animate-in fade-in slide-in-from-top-2 duration-300">
                                                        <FormLabel>Loại sản phẩm</FormLabel>
                                                        <Select onValueChange={(val) => { field.onChange(val); form.setValue('product_sub_type', '') }} value={field.value || undefined}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Chọn loại sản phẩm" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {availableProductTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                        {availableProductSubTypes.length > 0 && (
                                            <FormField
                                                control={form.control}
                                                name="product_sub_type"
                                                render={({ field }) => (
                                                    <FormItem className="animate-in fade-in slide-in-from-top-2 duration-300">
                                                        <FormLabel>Loại phụ</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Chọn loại phụ" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {availableProductSubTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                        <FormField
                                            control={form.control}
                                            name="brand_id"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Thương hiệu</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Không chọn" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {brands.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                    </div>

                    {/* ── RIGHT COLUMN (TABS) ─────────────────────────────────── */}
                    <div className="flex-1 min-w-0 w-full bg-transparent">
                        <Tabs defaultValue="general" className="w-full">
                            <TabsList variant="line" className="mb-6 flex w-fit justify-start gap-5 rounded-none bg-transparent h-auto p-0 border-none">
                                <TabsTrigger value="general" className="px-1 py-1.5 font-medium text-stone-500 data-[state=active]:text-stone-900 data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:outline-none border-none">
                                    Thông tin chung
                                </TabsTrigger>
                                <TabsTrigger value="description" className="px-1 py-1.5 font-medium text-stone-500 data-[state=active]:text-stone-900 data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:outline-none border-none">
                                    Mô tả chi tiết
                                </TabsTrigger>
                                <TabsTrigger value="advance" className="px-1 py-1.5 font-medium text-stone-500 data-[state=active]:text-stone-900 data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:outline-none border-none">
                                    Nâng cao & Thông số
                                </TabsTrigger>
                                <TabsTrigger value="combo" className="px-1 py-1.5 font-medium text-stone-500 data-[state=active]:text-stone-900 data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:outline-none border-none">
                                    Combo & Liên kết
                                </TabsTrigger>
                            </TabsList>

                            {/* TAB 1: THÔNG TIN CHUNG */}
                            <TabsContent value="general" className="space-y-6 outline-none">
                                {/* General Information */}
                                <Card className="shadow-none rounded-xl overflow-hidden p-0 gap-0">
                                    <CardHeader className="bg-stone-100 border-b px-5 !py-3">
                                        <CardTitle className="text-base font-semibold text-stone-900">Tổng quan sản phẩm
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 space-y-5">
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Tên sản phẩm *</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="VD: Bồn cầu 1 khối INAX AC-4005VN" {...field} onChange={(e) => { field.onChange(e); if(!isEdit || !form.getValues('slug')) { form.setValue('slug', generateSlug(e.target.value)) } }} />
                                                    </FormControl>
                                                    <FormDescription>Tên đầy đủ của sản phẩm, khuyến nghị chứa mã SKU để dễ tìm kiếm.</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="sku"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Mã SKU *</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="VD: INAX-AC4005VN" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="slug"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Slug (URL) *</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="bon-cau-inax..." {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="display_name"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Tên hiển thị (tuỳ chọn)</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Tên rút gọn hiển thị trên card..." {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="stock_status"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Tình trạng hàng</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Chọn tình trạng" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="in_stock">Còn hàng</SelectItem>
                                                                <SelectItem value="out_of_stock">Hết hàng</SelectItem>
                                                                <SelectItem value="preorder">Đặt trước</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <div className="border-t border-[#E4EEF2] pt-4 mt-4 space-y-4">
                                            <FormField
                                                control={form.control}
                                                name="is_active"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-row items-center justify-between">
                                                        <div className="space-y-0.5">
                                                            <FormLabel className="text-sm font-medium text-[#1A2B34] cursor-pointer" onClick={() => field.onChange(!field.value)}>Hiển thị (Active)</FormLabel>
                                                            <FormDescription className="text-xs">Sản phẩm sẽ được hiển thị công khai trên website.</FormDescription>
                                                        </div>
                                                        <FormControl>
                                                            <label className="relative inline-flex h-6 w-11 items-center rounded-full peer-focus-visible:outline-none cursor-pointer">
                                                                <input type="checkbox" checked={field.value} onChange={e => field.onChange(e.target.checked)} className="peer sr-only" />
                                                                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                            </label>
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                                {[
                                                    { name: 'is_featured' as const, label: 'Nổi bật', desc: 'Hiển thị ở trang chủ' },
                                                    { name: 'is_new' as const, label: 'Hàng mới', desc: 'Sản phẩm mới ra mắt' },
                                                    { name: 'is_bestseller' as const, label: 'Bán chạy', desc: 'Badge bán chạy' },
                                                ].map(({ name, label, desc }) => (
                                                    <FormField
                                                        key={name}
                                                        control={form.control}
                                                        name={name}
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-[#E4EEF2] p-4 bg-[#F8FAFB]/50">
                                                                <FormControl>
                                                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-1" />
                                                                </FormControl>
                                                                <div className="space-y-1 leading-none">
                                                                    <FormLabel className="text-sm font-medium cursor-pointer" onClick={() => field.onChange(!field.value)}>
                                                                        {label}
                                                                    </FormLabel>
                                                                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                                                                </div>
                                                            </FormItem>
                                                        )}
                                                    />
                                                ))}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                                <FormField
                                                    control={form.control}
                                                    name="sort_order"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Thứ tự hiển thị</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" min={0} {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="source_url"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Nguồn gốc URL</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="https://..." {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="hita_product_id"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>ID Hita (Crawler)</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Mã ID gốc" {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>


                                {/* Giá cả */}
                                <Card className="shadow-none rounded-xl overflow-hidden p-0 gap-0">
                                    <CardHeader className="bg-stone-100 border-b px-5 !py-3 flex flex-row items-center justify-between">
                                        <CardTitle className="text-base font-semibold text-stone-900">Giá cả & Thanh toán
                                        </CardTitle>
                                        {discountPercent > 0 && (
                                            <span className="text-xs font-bold text-white bg-red-500 px-2.5 py-1 rounded-full">
                                                -{discountPercent}%
                                            </span>
                                        )}
                                    </CardHeader>
                                    <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <FormField
                                            control={form.control}
                                            name="price"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Giá bán hiện tại (VNĐ)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" min={0} step={1000} {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="original_price"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Giá gốc (VNĐ) — Bị gạch ngang</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" min={0} step={1000} {...field} />
                                                    </FormControl>
                                                    <FormDescription>Nhập giá cao hơn để hệ thống tính toán % giảm giá.</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="price_display"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Văn bản hiển thị thay thế</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="VD: Liên hệ báo giá" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="warranty_months"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Thời gian bảo hành</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" placeholder="Tính bằng tháng (VD: 12)" min={0} {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* TAB: MÔ TẢ CHI TIẾT */}
                            <TabsContent value="description" className="space-y-6 outline-none">
                                <Card className="shadow-none rounded-xl overflow-hidden p-0 gap-0">
                                    <CardHeader className="bg-stone-100 border-b px-5 !py-3">
                                        <CardTitle className="text-base font-semibold text-stone-900">Mô tả & Bài viết
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 space-y-5">
                                        <FormField
                                            control={form.control}
                                            name="description"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Bài viết / Mô tả</FormLabel>
                                                    <FormControl>
                                                        <RichTextEditor 
                                                            value={field.value || ''} 
                                                            onChange={field.onChange} 
                                                            placeholder="Nhập nội dung bài viết..."
                                                            folder="products"
                                                        />
                                                    </FormControl>
                                                    <FormDescription>Mô tả đầy đủ để tăng tỉ lệ chốt sale và tối ưu SEO.</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="features"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Tính năng nổi bật</FormLabel>
                                                    <FormControl>
                                                        <RichTextEditor 
                                                            value={field.value || ''} 
                                                            onChange={field.onChange} 
                                                            placeholder="Liệt kê các tính năng nổi bật..."
                                                            folder="products"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* TAB 3: NÂNG CAO & THÔNG SỐ */}
                            <TabsContent value="advance" className="space-y-6 outline-none">
                                {/* Thông số Native */}
                                <Card className="shadow-none rounded-xl overflow-hidden p-0 gap-0">
                                    <CardHeader className="bg-stone-100 border-b px-5 !py-3">
                                        <CardTitle className="text-base font-semibold text-stone-900">Phân loại phụ
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="origin_id"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Xuất xứ</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Không chọn" /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>{origins.map(o => <SelectItem key={o.id} value={o.id.toString()}>{o.name}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="color_id"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Màu sắc</FormLabel>
                                                    <div className="relative">
                                                        {field.value && (() => {
                                                            const sel = colors.find(c => c.id === Number(field.value))
                                                            return sel ? <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-black/10 shadow-sm z-10" style={{ backgroundColor: sel.hex_code || '#ccc' }} /> : null
                                                        })()}
                                                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                            <FormControl>
                                                                <SelectTrigger className={field.value ? 'pl-9' : ''}>
                                                                    <SelectValue placeholder="Không chọn" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>{colors.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="material_id"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Chất liệu</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Không chọn" /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>{materials.map(m => <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                    </CardContent>
                                </Card>

                                {/* Dynamic Specs (Not part of strict form schema) */}
                                <Card className="shadow-none rounded-xl overflow-hidden p-0 gap-0">
                                    <CardHeader className="bg-stone-100 border-b px-5 !py-3">
                                        <CardTitle className="text-base font-semibold text-stone-900">
                                            Thông số kỹ thuật mở rộng
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5">
                                        {relevantFilters.length === 0 ? (
                                            <p className="text-sm text-muted-foreground bg-stone-50 p-4 rounded-lg border border-stone-100 text-center">
                                                Vui lòng chọn <strong>Danh mục chính</strong> ở bên trái để hiển thị các thông số phù hợp.
                                            </p>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                {relevantFilters.map(filter => (
                                                    <div key={filter.id} className="space-y-2">
                                                        <Label>{filter.filter_label}</Label>
                                                        {filter.filter_type === 'select' || filter.filter_type === 'radio' ? (
                                                            <Select value={specs[filter.filter_key] || undefined} onValueChange={v => setSpecs(prev => ({ ...prev, [filter.filter_key]: v }))}>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Không chọn" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {Array.isArray(filter.options) && filter.options.map((opt: any) => (
                                                                        <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            <Input value={specs[filter.filter_key] || ''} onChange={e => setSpecs(prev => ({ ...prev, [filter.filter_key]: e.target.value }))} placeholder={`Nhập ${filter.filter_label.toLowerCase()}...`} />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* SEO */}
                                <Card className="shadow-none rounded-xl overflow-hidden p-0 gap-0">
                                    <CardHeader className="bg-stone-100 border-b px-5 !py-3">
                                        <CardTitle className="text-base font-semibold text-stone-900">Tối ưu hoá SEO
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="seo_title"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>SEO Title</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Tiêu đề SEO (tối đa 200 ký tự)" maxLength={200} {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="seo_description"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>SEO Description</FormLabel>
                                                    <FormControl>
                                                        <Textarea className="min-h-[80px] resize-y" placeholder="Mô tả SEO (tối đa 500 ký tự)" maxLength={500} {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </CardContent>
                                </Card>


                            </TabsContent>

                            {/* TAB: COMBO & LIÊN KẾT */}
                            <TabsContent value="combo" className="space-y-6 outline-none">
                                <Card className="shadow-none rounded-xl overflow-hidden p-0 gap-0">
                                    <CardHeader className="bg-stone-100 border-b px-5 !py-3 flex flex-row items-center justify-between">
                                        <CardTitle className="text-base font-semibold text-stone-900">
                                            Sản phẩm trong Combo / Tương thích
                                        </CardTitle>
                                        <QuickCreateProductModal 
                                            categories={categories} 
                                            onSuccess={async (newProduct) => {
                                                if (isEdit && product.id) {
                                                    const res = await addProductRelationship(product.id, newProduct.id, newProduct.sku, 'component')
                                                    if (res.message) toast.error(res.message)
                                                    else toast.success('Đã thêm sản phẩm vào Combo')
                                                } else {
                                                    toast.info('Sản phẩm đã được tạo, nhưng Combo chỉ hoạt động sau khi bạn LƯU sản phẩm chính này.')
                                                }
                                            }}
                                        />
                                    </CardHeader>
                                    <CardContent className="p-5 space-y-5">
                                        {isEdit ? (
                                            <>
                                                <div className="space-y-2">
                                                    <Label>Thêm sản phẩm có sẵn</Label>
                                                    <ProductRelationshipPicker 
                                                        excludeId={product.id} 
                                                        onSelect={async (child) => {
                                                            const res = await addProductRelationship(product.id, child.id, child.sku, 'component')
                                                            if (res.message) toast.error(res.message)
                                                            else toast.success('Đã thêm sản phẩm vào Combo')
                                                        }} 
                                                    />
                                                </div>

                                                <div className="space-y-3">
                                                    <Label>Danh sách sản phẩm liên kết</Label>
                                                    {(product as any).product_relationships?.length > 0 ? (
                                                        <div className="divide-y border rounded-lg overflow-hidden bg-white">
                                                            {(product as any).product_relationships.map((rel: any) => (
                                                                <div key={rel.id} className="flex items-center justify-between p-3 hover:bg-stone-50">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="h-10 w-10 relative rounded bg-stone-100 border shrink-0">
                                                                            {rel.child?.image_main_url ? (
                                                                                <Image src={rel.child.image_main_url} alt={rel.child.name} fill className="object-cover" />
                                                                            ) : (
                                                                                <div className="w-full h-full flex items-center justify-center text-[10px] text-stone-400">Img</div>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-sm font-medium">{rel.child?.name}</p>
                                                                            <p className="text-xs text-muted-foreground">{rel.child_sku}</p>
                                                                        </div>
                                                                    </div>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                                        onClick={async () => {
                                                                            if (confirm('Bỏ liên kết sản phẩm này?')) {
                                                                                const res = await removeProductRelationship(rel.id, product.id)
                                                                                if (res.message) toast.error(res.message)
                                                                                else toast.success('Đã bỏ liên kết')
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg bg-stone-50 border-dashed">
                                                            Chưa có sản phẩm liên kết nào.
                                                        </p>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-sm text-muted-foreground bg-amber-50 text-amber-800 p-4 rounded-lg border border-amber-200">
                                                Tính năng Combo chỉ khả dụng khi bạn <strong>chỉnh sửa</strong> sản phẩm. Vui lòng thêm sản phẩm này trước, sau đó vào lại để gắn các sản phẩm con.
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </form>
        </Form>
    )
}
