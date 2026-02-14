"use client"

import { Star } from "lucide-react"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useState, useEffect } from "react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createProduct, updateProduct } from "@/lib/actions"
import { Category, Brand, ProductType, Product, Collection } from "@prisma/client"

const productSchema = z.object({
    name: z.string().min(2, "Tên phải có ít nhất 2 ký tự"),
    slug: z.string().min(2, "Slug phải có ít nhất 2 ký tự"),
    sku: z.string().optional(),
    price: z.coerce.number().min(0, "Giá phải >= 0"),
    originalPrice: z.coerce.number().optional(),
    showPrice: z.boolean().default(false),
    categoryId: z.string().min(1, "Vui lòng chọn danh mục"),
    brandId: z.string().optional(),
    productTypeId: z.string().optional(),
    collectionId: z.string().optional(),
    description: z.string().optional(),
    images: z.string().optional(),
    thumbnail: z.string().optional(),
    isPublished: z.boolean().default(true),
    // Tile specs
    specSurface: z.string().optional(),
    specDimensions: z.string().optional(),
    specSimDimensions: z.string().optional(),
    specOrigin: z.string().optional(),
    specAntiSlip: z.string().optional(),
    specPatternCount: z.string().optional(),
    specColor: z.string().optional(),
})

type ProductFormValues = z.infer<typeof productSchema>

interface ProductFormProps {
    categories: Category[]
    brands: Brand[]
    productTypes: ProductType[]
    collections: Collection[]
    initialData?: Product | null
    tileCategoryId?: string
}

function parseSpecs(specs: string | null): Record<string, string> {
    if (!specs) return {}
    try {
        return JSON.parse(specs)
    } catch {
        return {}
    }
}

export default function ProductForm({ categories, brands, productTypes, collections, initialData, tileCategoryId }: ProductFormProps) {
    const existingSpecs = parseSpecs(initialData?.specs || null)

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema) as any,
        defaultValues: initialData ? {
            name: initialData.name,
            slug: initialData.slug,
            sku: initialData.sku || "",
            price: Number(initialData.price) || 0,
            originalPrice: Number(initialData.originalPrice) || 0,
            showPrice: initialData.showPrice,
            description: initialData.description || "",
            images: initialData.images || "",
            isPublished: initialData.isPublished,
            categoryId: initialData.categoryId,
            brandId: initialData.brandId || "",
            productTypeId: initialData.productTypeId || "",
            collectionId: initialData.collectionId || "",
            specSurface: existingSpecs.surface || "",
            specDimensions: existingSpecs.dimensions || "",
            specSimDimensions: existingSpecs.simDimensions || "",
            specOrigin: existingSpecs.origin || "",
            specAntiSlip: existingSpecs.antiSlip || "",
            specPatternCount: existingSpecs.patternCount || "",
            specColor: existingSpecs.color || "",
        } : {
            name: "",
            slug: "",
            sku: "",
            price: 0,
            originalPrice: 0,
            showPrice: false,
            description: "",
            images: "",
            isPublished: true,
            categoryId: "",
            brandId: "",
            productTypeId: "",
            collectionId: "",
            specSurface: "",
            specDimensions: "",
            specSimDimensions: "",
            specOrigin: "",
            specAntiSlip: "",
            specPatternCount: "",
            specColor: "",
        },
    })

    const selectedCategoryId = useWatch({ control: form.control, name: "categoryId" })
    const isTileCategory = tileCategoryId && selectedCategoryId === tileCategoryId

    // Filter productTypes and collections by selected category context
    const filteredProductTypes = productTypes
    const filteredCollections = collections

    // --- Image Upload State ---
    const [uploadedImages, setUploadedImages] = useState<string[]>([])
    const [selectedThumbnail, setSelectedThumbnail] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)

    // Parse initial images if editing
    useEffect(() => {
        if (initialData?.images) {
            try {
                const parsed = JSON.parse(initialData.images)
                if (Array.isArray(parsed)) {
                    setUploadedImages(parsed)
                }
            } catch (e) {
                // if not json, maybe comma separated?
                if (initialData.images.includes(',')) {
                    setUploadedImages(initialData.images.split(',').map(s => s.trim()))
                } else if (initialData.images.trim()) {
                    setUploadedImages([initialData.images])
                }
            }
        }
        if (initialData?.thumbnail) {
            setSelectedThumbnail(initialData.thumbnail)
        }
    }, [initialData])

    // Sync state to form field
    useEffect(() => {
        form.setValue("images", JSON.stringify(uploadedImages))
    }, [uploadedImages, form])

    async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files
        if (!files || files.length === 0) return

        setIsUploading(true)
        const newUrls: string[] = []

        try {
            for (let i = 0; i < files.length; i++) {
                const formData = new FormData()
                formData.append("file", files[i])

                const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                })

                if (res.ok) {
                    const data = await res.json()
                    newUrls.push(data.url)
                } else {
                    console.error("Upload failed for file", files[i].name)
                    alert(`Upload thất bại: ${files[i].name}`)
                }
            }
            setUploadedImages(prev => [...prev, ...newUrls])
        } catch (error) {
            console.error("Upload error", error)
            alert("Đã xảy ra lỗi khi upload ảnh")
        } finally {
            setIsUploading(false)
            // Reset input
            e.target.value = ""
        }
    }

    function removeImage(index: number) {
        setUploadedImages(prev => {
            const newImages = prev.filter((_: string, i: number) => i !== index)
            // If removed image was thumbnail, reset thumbnail
            if (prev[index] === selectedThumbnail) {
                setSelectedThumbnail(null)
            }
            return newImages
        })
    }

    async function onSubmit(data: ProductFormValues) {
        // Build specs JSON from individual fields
        const specs: Record<string, string> = {}
        if (data.specSurface) specs.surface = data.specSurface
        if (data.specDimensions) specs.dimensions = data.specDimensions
        if (data.specSimDimensions) specs.simDimensions = data.specSimDimensions
        if (data.specOrigin) specs.origin = data.specOrigin
        if (data.specAntiSlip) specs.antiSlip = data.specAntiSlip
        if (data.specPatternCount) specs.patternCount = data.specPatternCount
        if (data.specColor) specs.color = data.specColor

        const submitData = {
            name: data.name,
            slug: data.slug,
            sku: data.sku,
            price: data.price,
            originalPrice: data.originalPrice,
            showPrice: data.showPrice,
            categoryId: data.categoryId,
            brandId: data.brandId,
            productTypeId: data.productTypeId,
            collectionId: data.collectionId,
            description: data.description,
            images: data.images,
            thumbnail: selectedThumbnail,
            isPublished: data.isPublished,
            specs: Object.keys(specs).length > 0 ? JSON.stringify(specs) : undefined,
        }

        let result;
        if (initialData) {
            result = await updateProduct(initialData.id, submitData)
        } else {
            result = await createProduct(submitData)
        }

        if (result?.errors) {
            console.error(result.errors)
            alert("Lỗi khi lưu sản phẩm")
        } else if (result?.message) {
            alert(result.message)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic info */}
                <Card>
                    <CardHeader>
                        <CardTitle>Thông tin cơ bản</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tên sản phẩm</FormLabel>
                                    <FormControl>
                                        <Input placeholder="VD: Gạch Viglacera MDK 362009" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="slug"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Slug</FormLabel>
                                        <FormControl>
                                            <Input placeholder="gach-viglacera-mdk-362009" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="sku"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>SKU</FormLabel>
                                        <FormControl>
                                            <Input placeholder="MDK-362009" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Mô tả</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Mô tả sản phẩm..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Image Upload Section */}
                        <div className="space-y-3">
                            <FormLabel>Anh sản phẩm (Carousel)</FormLabel>

                            {/* Hidden Input for Form Submission */}
                            <FormField
                                control={form.control}
                                name="images"
                                render={({ field }) => (
                                    <FormItem className="hidden">
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            {/* File Upload Button */}
                            <div className="flex items-center gap-4">
                                <label
                                    htmlFor="image-upload"
                                    className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                                >
                                    Tải ảnh lên (Máy tính)
                                </label>
                                <input
                                    id="image-upload"
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageUpload}
                                />
                                <span className="text-sm text-gray-500">
                                    {isUploading ? "Đang tải lên..." : "Chọn nhiều ảnh"}
                                </span>
                            </div>

                            {/* Image Preview Grid */}
                            {uploadedImages.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                                    {uploadedImages.map((url, idx) => (
                                        <div key={idx} className={`relative group aspect-square rounded-lg border overflow-hidden ${selectedThumbnail === url ? 'ring-2 ring-primary' : 'bg-gray-50'}`}>
                                            <img
                                                src={url}
                                                alt={`Uploaded ${idx}`}
                                                className="w-full h-full object-cover"
                                            />
                                            {/* Thumbnail Selection */}
                                            <button
                                                type="button"
                                                onClick={() => setSelectedThumbnail(url)}
                                                className={`absolute top-1 left-1 p-1 rounded-full transition-all ${selectedThumbnail === url ? 'bg-primary text-white' : 'bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-primary'}`}
                                                title="Đặt làm ảnh đại diện"
                                            >
                                                <Star size={14} fill={selectedThumbnail === url ? "currentColor" : "none"} />
                                            </button>

                                            {/* Remove Button */}
                                            <button
                                                type="button"
                                                onClick={() => removeImage(idx)}
                                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                            </button>

                                            {selectedThumbnail === url && (
                                                <div className="absolute bottom-0 inset-x-0 bg-primary/80 text-white text-[10px] text-center py-1 font-medium">
                                                    Ảnh đại diện
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Pricing */}
                <Card>
                    <CardHeader>
                        <CardTitle>Giá</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Giá bán (VNĐ)</FormLabel>
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
                                        <FormLabel>Giá gốc (VNĐ)</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="0" {...field} />
                                        </FormControl>
                                        <FormDescription>Để trống nếu không có khuyến mãi</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="showPrice"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>Hiển thị giá</FormLabel>
                                        <FormDescription>
                                            Bỏ tick sẽ hiển thị &ldquo;Liên hệ&rdquo; thay vì giá
                                        </FormDescription>
                                    </div>
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                {/* Classification */}
                <Card>
                    <CardHeader>
                        <CardTitle>Phân loại</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="categoryId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Danh mục</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Chọn danh mục" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {categories.map((category) => (
                                                    <SelectItem key={category.id} value={category.id}>
                                                        {category.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="brandId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Thương hiệu</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Chọn thương hiệu" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {brands.map((brand) => (
                                                    <SelectItem key={brand.id} value={brand.id}>
                                                        {brand.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="productTypeId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phân loại con</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Chọn phân loại" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {filteredProductTypes.map((type) => (
                                                    <SelectItem key={type.id} value={type.id}>
                                                        {type.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="collectionId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Bộ sưu tập</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Chọn BST" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {filteredCollections.map((col) => (
                                                    <SelectItem key={col.id} value={col.id}>
                                                        {col.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Tile Specs — only show when category is Gạch ốp lát */}
                {isTileCategory && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Thông số kỹ thuật (Gạch)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="specSurface"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Bề mặt</FormLabel>
                                            <FormControl>
                                                <Input placeholder="VD: Men bóng" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="specDimensions"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Kích thước</FormLabel>
                                            <FormControl>
                                                <Input placeholder="VD: 600x1200 mm" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="specSimDimensions"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Kích thước giả (hiển thị)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="VD: 60x120 cm" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="specOrigin"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Xuất xứ</FormLabel>
                                            <FormControl>
                                                <Input placeholder="VD: Việt Nam" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="specAntiSlip"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Chống trượt</FormLabel>
                                            <FormControl>
                                                <Input placeholder="VD: R9" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="specPatternCount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Số mẫu</FormLabel>
                                            <FormControl>
                                                <Input placeholder="VD: 4" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="specColor"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Màu sắc</FormLabel>
                                            <FormControl>
                                                <Input placeholder="VD: Xám đậm" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Publish */}
                <Card>
                    <CardContent className="pt-6">
                        <FormField
                            control={form.control}
                            name="isPublished"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>Xuất bản</FormLabel>
                                        <FormDescription>Hiển thị sản phẩm trên trang công khai</FormDescription>
                                    </div>
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <div className="flex gap-4">
                    <Button type="submit">
                        {initialData ? "Cập nhật" : "Tạo sản phẩm"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
