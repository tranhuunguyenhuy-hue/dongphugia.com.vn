"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
    Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { createProduct, updateProduct, getSpecSuggestions } from "@/lib/actions"
import { toast } from "sonner"
import { useState, useEffect, useCallback } from "react"
import { Upload, X, Star, Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"

// ---- Types ----
interface Product {
    id: string
    name: string
    slug: string
    sku: string | null
    description: string | null
    price: any
    originalPrice: any
    showPrice: boolean
    thumbnail: string | null
    images: string
    isPublished: boolean
    isFeatured: boolean
    categoryId: string
    productTypeId: string | null
    collectionId: string | null
    dimensions: string | null
    simDimensions: string | null
    surface: string | null
    origin: string | null
    antiSlip: string | null
    patternCount: number | null
    colorName: string | null
}

interface TileProductFormProps {
    tileCategoryId: string
    productTypeId: string
    productTypeName: string
    collectionId?: string
    collectionName?: string
    typeSlug: string
    initialData?: Product | null
}

// ---- Schema ----
const tileFormSchema = z.object({
    name: z.string().min(1, "Tên sản phẩm là bắt buộc"),
    slug: z.string().min(1, "Slug là bắt buộc"),
    sku: z.string().optional(),
    description: z.string().optional(),
    price: z.coerce.number().default(0),
    originalPrice: z.coerce.number().optional(),
    showPrice: z.boolean().default(false),
    isPublished: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    // Specs
    dimensions: z.string().optional(),
    simDimensions: z.string().optional(),
    surface: z.string().optional(),
    origin: z.string().optional(),
    antiSlip: z.string().optional(),
    patternCount: z.coerce.number().optional(),
    colorName: z.string().optional(),
})

type TileFormValues = z.infer<typeof tileFormSchema>

// ---- Slug helper ----
function toSlug(str: string): string {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "d")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
}

// ---- Spec Dropdown Component ----
function SpecDropdownField({
    label,
    placeholder,
    value,
    onChange,
    suggestions,
}: {
    label: string
    placeholder: string
    value: string
    onChange: (val: string) => void
    suggestions: string[]
}) {
    const [showSuggestions, setShowSuggestions] = useState(false)
    const filtered = suggestions.filter((s) =>
        s.toLowerCase().includes(value.toLowerCase())
    )

    return (
        <div className="relative">
            <label className="text-sm font-medium mb-1.5 block">{label}</label>
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder={placeholder}
            />
            {showSuggestions && filtered.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-32 overflow-y-auto">
                    {filtered.map((s) => (
                        <button
                            key={s}
                            type="button"
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                            onMouseDown={(e) => {
                                e.preventDefault()
                                onChange(s)
                                setShowSuggestions(false)
                            }}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ---- Main Form ----
export default function TileProductForm({
    tileCategoryId,
    productTypeId,
    productTypeName,
    collectionId,
    collectionName,
    typeSlug,
    initialData,
}: TileProductFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [imageFiles, setImageFiles] = useState<File[]>([])
    const [imagePreviews, setImagePreviews] = useState<string[]>([])
    const [thumbnailIndex, setThumbnailIndex] = useState(0)
    const [specs, setSpecs] = useState({
        surface: [] as string[],
        dimensions: [] as string[],
        simDimensions: [] as string[],
        origin: [] as string[],
        antiSlip: [] as string[],
        colorName: [] as string[],
    })

    // Parse existing images for edit mode
    useEffect(() => {
        if (initialData) {
            try {
                const imgs = JSON.parse(initialData.images || "[]")
                setImagePreviews(imgs)
                if (initialData.thumbnail) {
                    const idx = imgs.indexOf(initialData.thumbnail)
                    if (idx >= 0) setThumbnailIndex(idx)
                }
            } catch { }
        }
    }, [initialData])

    // Fetch spec suggestions
    useEffect(() => {
        async function fetchSuggestions() {
            const [surface, dimensions, simDimensions, origin, antiSlip, colorName] = await Promise.all([
                getSpecSuggestions("surface"),
                getSpecSuggestions("dimensions"),
                getSpecSuggestions("simDimensions"),
                getSpecSuggestions("origin"),
                getSpecSuggestions("antiSlip"),
                getSpecSuggestions("colorName"),
            ])
            setSpecs({ surface, dimensions, simDimensions, origin, antiSlip, colorName })
        }
        fetchSuggestions()
    }, [])

    const form = useForm<TileFormValues>({
        resolver: zodResolver(tileFormSchema) as any,
        defaultValues: {
            name: initialData?.name || "",
            slug: initialData?.slug || "",
            sku: initialData?.sku || "",
            description: initialData?.description || "",
            price: initialData?.price ? Number(initialData.price) : 0,
            originalPrice: initialData?.originalPrice ? Number(initialData.originalPrice) : undefined,
            showPrice: initialData?.showPrice ?? false,
            isPublished: initialData?.isPublished ?? true,
            isFeatured: initialData?.isFeatured ?? false,
            dimensions: initialData?.dimensions || "",
            simDimensions: initialData?.simDimensions || "",
            surface: initialData?.surface || "",
            origin: initialData?.origin || "",
            antiSlip: initialData?.antiSlip || "",
            patternCount: initialData?.patternCount || undefined,
            colorName: initialData?.colorName || "",
        },
    })

    // Auto-generate slug from name
    const watchName = form.watch("name")
    useEffect(() => {
        if (!initialData && watchName) {
            form.setValue("slug", toSlug(watchName))
        }
    }, [watchName, initialData, form])

    // Image upload handler
    const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        for (const file of files) {
            // Upload to server
            const formData = new FormData()
            formData.append("file", file)
            try {
                const res = await fetch("/api/upload", { method: "POST", body: formData })
                if (res.ok) {
                    const data = await res.json()
                    setImagePreviews((prev) => [...prev, data.url])
                } else {
                    // Fallback to local preview
                    const reader = new FileReader()
                    reader.onload = () => {
                        setImagePreviews((prev) => [...prev, reader.result as string])
                    }
                    reader.readAsDataURL(file)
                }
            } catch {
                const reader = new FileReader()
                reader.onload = () => {
                    setImagePreviews((prev) => [...prev, reader.result as string])
                }
                reader.readAsDataURL(file)
            }
        }
        e.target.value = ""
    }, [])

    const removeImage = (index: number) => {
        setImagePreviews((prev) => prev.filter((_, i) => i !== index))
        if (thumbnailIndex === index) setThumbnailIndex(0)
        else if (thumbnailIndex > index) setThumbnailIndex((prev) => prev - 1)
    }

    // Submit
    async function onSubmit(data: TileFormValues) {
        setIsSubmitting(true)
        try {
            const submitData = {
                ...data,
                categoryId: tileCategoryId,
                productTypeId,
                collectionId: collectionId || undefined,
                images: JSON.stringify(imagePreviews),
                thumbnail: imagePreviews[thumbnailIndex] || null,
                specs: JSON.stringify({
                    surface: data.surface,
                    dimensions: data.dimensions,
                    simDimensions: data.simDimensions,
                    origin: data.origin,
                    antiSlip: data.antiSlip,
                    patternCount: data.patternCount,
                    color: data.colorName,
                }),
            }

            if (initialData) {
                await updateProduct(initialData.id, submitData)
                toast.success("Đã cập nhật sản phẩm")
            } else {
                await createProduct(submitData)
                toast.success("Đã tạo sản phẩm mới")
            }
        } catch (error) {
            toast.error("Có lỗi xảy ra. Vui lòng thử lại.")
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/admin/gach-op-lat" className="hover:text-foreground">Gạch ốp lát</Link>
                <span>/</span>
                <Link href={`/admin/gach-op-lat/type/${typeSlug}`} className="hover:text-foreground">{productTypeName}</Link>
                <span>/</span>
                {collectionName && (
                    <>
                        <span>{collectionName}</span>
                        <span>/</span>
                    </>
                )}
                <span className="text-foreground font-medium">
                    {initialData ? "Chỉnh sửa" : "Thêm sản phẩm mới"}
                </span>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Section 1: Basic Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Thông tin cơ bản</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tên sản phẩm</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Gạch - 120278EN7Z" {...field} />
                                            </FormControl>
                                            <FormDescription>Cấu trúc: Gạch - [Mã sản phẩm]</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="sku"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Mã sản phẩm (SKU)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="120278EN7Z" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="slug"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Slug (URL)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="gach-120278en7z" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {/* Section 2: Pricing */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Giá sản phẩm</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField
                                control={form.control}
                                name="showPrice"
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-2">
                                        <FormControl>
                                            <Checkbox
                                                checked={!field.value}
                                                onCheckedChange={(checked) => field.onChange(!checked)}
                                            />
                                        </FormControl>
                                        <FormLabel className="!mt-0">Không để giá sản phẩm (Liên hệ báo giá)</FormLabel>
                                    </FormItem>
                                )}
                            />
                            {form.watch("showPrice") && (
                                <div className="grid gap-4 md:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="price"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Giá hiện tại (VNĐ)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" placeholder="0" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="originalPrice"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Giá gốc / Giá sale (VNĐ)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" placeholder="0" {...field} />
                                                </FormControl>
                                                <FormDescription>Nếu để giá sale, giá gốc sẽ hiện gạch ngang</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Section 3: Images */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Hình ảnh sản phẩm</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                                {imagePreviews.map((src, idx) => (
                                    <div
                                        key={idx}
                                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${idx === thumbnailIndex
                                            ? "border-primary ring-2 ring-primary/20"
                                            : "border-transparent hover:border-muted-foreground/30"
                                            }`}
                                        onClick={() => setThumbnailIndex(idx)}
                                    >
                                        <img src={src} alt="" className="h-full w-full object-cover" />
                                        {idx === thumbnailIndex && (
                                            <div className="absolute top-1 left-1 bg-primary text-primary-foreground rounded-full p-0.5">
                                                <Star className="h-3 w-3 fill-current" />
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); removeImage(idx) }}
                                            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-black/80"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}

                                {/* Upload button */}
                                <label className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex flex-col items-center justify-center cursor-pointer transition-colors">
                                    <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                                    <span className="text-[10px] text-muted-foreground">Upload</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={handleImageUpload}
                                    />
                                </label>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Click vào ảnh để chọn làm thumbnail (⭐). Upload nhiều ảnh cùng lúc.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Section 4: Spec Dropdowns */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Thông số sản phẩm</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                <FormField
                                    control={form.control}
                                    name="patternCount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Số vân</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="6" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <SpecDropdownField
                                    label="Quy cách (Kích thước)"
                                    placeholder="120x278cm"
                                    value={form.watch("dimensions") || ""}
                                    onChange={(val) => form.setValue("dimensions", val)}
                                    suggestions={specs.dimensions}
                                />
                                <SpecDropdownField
                                    label="Kích thước mô phỏng"
                                    placeholder="120x278cm"
                                    value={form.watch("simDimensions") || ""}
                                    onChange={(val) => form.setValue("simDimensions", val)}
                                    suggestions={specs.simDimensions}
                                />
                                <SpecDropdownField
                                    label="Bề mặt"
                                    placeholder="Bóng, Mờ"
                                    value={form.watch("surface") || ""}
                                    onChange={(val) => form.setValue("surface", val)}
                                    suggestions={specs.surface}
                                />
                                <SpecDropdownField
                                    label="Xuất xứ"
                                    placeholder="Ý, Tây Ban Nha"
                                    value={form.watch("origin") || ""}
                                    onChange={(val) => form.setValue("origin", val)}
                                    suggestions={specs.origin}
                                />
                                <SpecDropdownField
                                    label="Độ chống trượt"
                                    placeholder="R9, R10"
                                    value={form.watch("antiSlip") || ""}
                                    onChange={(val) => form.setValue("antiSlip", val)}
                                    suggestions={specs.antiSlip}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Section 5: Description */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Mô tả sản phẩm</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Viết mô tả sản phẩm..."
                                                className="min-h-[120px]"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Hỗ trợ HTML. Bạn có thể viết đoạn văn mô tả kèm hình ảnh đính kèm.
                                        </FormDescription>
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {/* Section 6: Publishing */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Trạng thái</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <FormField
                                control={form.control}
                                name="isPublished"
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-2">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormLabel className="!mt-0">Hiển thị sản phẩm (Published)</FormLabel>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="isFeatured"
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-2">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormLabel className="!mt-0">Sản phẩm nổi bật (Featured)</FormLabel>
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {/* Submit */}
                    <div className="flex items-center justify-between">
                        <Button type="button" variant="outline" asChild>
                            <Link href={`/admin/gach-op-lat/type/${typeSlug}`}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Quay lại
                            </Link>
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Đang lưu...
                                </>
                            ) : (
                                initialData ? "Cập nhật sản phẩm" : "Tạo sản phẩm"
                            )}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}
