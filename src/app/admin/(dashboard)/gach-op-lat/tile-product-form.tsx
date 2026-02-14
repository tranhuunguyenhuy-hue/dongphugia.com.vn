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
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { createProduct, updateProduct, createCollection } from "@/lib/actions"
import { toast } from "sonner"
import { useState, useEffect, useCallback } from "react"
import { PlusCircle, Package } from "lucide-react"

// Types
interface ProductType {
    id: string
    name: string
    slug: string
}

interface Collection {
    id: string
    name: string
    slug: string
    productTypeId: string
}

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
    specs: string | null
    material: string | null
    thickness: string | null
    waterAbsorption: string | null
    usage: string | null
    colorHex: string | null
    isPublished: boolean
    isFeatured: boolean
    categoryId: string
    brandId: string | null
    productTypeId: string | null
    collectionId: string | null
}

interface TileProductFormProps {
    subCategories: ProductType[]
    collections: Collection[]
    tileCategoryId: string
    initialData?: Product | null
}

const tileFormSchema = z.object({
    name: z.string().min(1, "Tên sản phẩm là bắt buộc"),
    slug: z.string().min(1, "Slug là bắt buộc"),
    sku: z.string().optional(),
    description: z.string().optional(),
    thumbnail: z.string().optional(),
    images: z.string().optional(),
    price: z.coerce.number().optional(),
    originalPrice: z.coerce.number().optional(),
    showPrice: z.boolean().default(false),
    isPublished: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    productTypeId: z.string().min(1, "Vui lòng chọn loại gạch"),
    collectionId: z.string().optional(),
    // Tile specs
    surface: z.string().optional(),
    dimensions: z.string().optional(),
    simDimensions: z.string().optional(),
    origin: z.string().optional(),
    antiSlip: z.string().optional(),
    patternCount: z.coerce.number().optional(),
    color: z.string().optional(),
    // Tab: Thông tin sản phẩm
    material: z.string().optional(),
    thickness: z.string().optional(),
    waterAbsorption: z.string().optional(),
    usage: z.string().optional(),
    colorHex: z.string().optional(),
})

type TileFormValues = z.infer<typeof tileFormSchema>

// Vietnamese slug helper
function toSlug(str: string): string {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d").replace(/Đ/g, "d")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
}

export default function TileProductForm({
    subCategories,
    collections: initialCollections,
    tileCategoryId,
    initialData,
}: TileProductFormProps) {
    const [step, setStep] = useState(initialData ? 3 : 1)
    const [collections, setCollections] = useState(initialCollections)
    const [showNewBST, setShowNewBST] = useState(false)
    const [newBSTName, setNewBSTName] = useState("")
    const [newBSTSlug, setNewBSTSlug] = useState("")
    const [creatingBST, setCreatingBST] = useState(false)

    // Parse existing specs
    const existingSpecs = initialData?.specs ? JSON.parse(initialData.specs) : {}

    const form = useForm<TileFormValues>({
        resolver: zodResolver(tileFormSchema) as any,
        defaultValues: {
            name: initialData?.name || "",
            slug: initialData?.slug || "",
            sku: initialData?.sku || "",
            description: initialData?.description || "",
            thumbnail: initialData?.thumbnail || "",
            images: initialData?.images || "[]",
            price: initialData?.price ? Number(initialData.price) : undefined,
            originalPrice: initialData?.originalPrice ? Number(initialData.originalPrice) : undefined,
            showPrice: initialData?.showPrice ?? false,
            isPublished: initialData?.isPublished ?? true,
            isFeatured: initialData?.isFeatured ?? false,
            productTypeId: initialData?.productTypeId || "",
            collectionId: initialData?.collectionId || "",
            surface: existingSpecs.surface || "",
            dimensions: existingSpecs.dimensions || "",
            simDimensions: existingSpecs.simDimensions || "",
            origin: existingSpecs.origin || "",
            antiSlip: existingSpecs.antiSlip || "",
            patternCount: existingSpecs.patternCount || undefined,
            color: existingSpecs.color || "",
            material: initialData?.material || "",
            thickness: initialData?.thickness || "",
            waterAbsorption: initialData?.waterAbsorption || "",
            usage: initialData?.usage || "",
            colorHex: initialData?.colorHex || "",
        },
    })

    const selectedTypeId = form.watch("productTypeId")
    const productName = form.watch("name")

    // Auto-slug from name
    useEffect(() => {
        if (!initialData && productName) {
            form.setValue("slug", toSlug(productName))
        }
    }, [productName, initialData, form])

    // Filter collections by selected sub-category
    const filteredCollections = collections.filter(c => c.productTypeId === selectedTypeId)

    // Handle creating new BST inline
    async function handleCreateBST() {
        if (!newBSTName || !selectedTypeId) return
        setCreatingBST(true)

        try {
            const result = await createCollection({
                name: newBSTName,
                slug: newBSTSlug || toSlug(newBSTName),
                productTypeId: selectedTypeId,
            })

            if (result?.errors || result?.message) {
                toast.error(result.message || "Lỗi tạo BST")
                setCreatingBST(false)
                return
            }

            // Refresh collections — we need the new one
            toast.success(`Đã tạo BST "${newBSTName}"`)
            // Add to local state (we won't have the ID from redirect, so we reload)
            window.location.reload()
        } catch {
            toast.error("Lỗi khi tạo BST")
            setCreatingBST(false)
        }
    }

    // Submit handler
    async function onSubmit(data: TileFormValues) {
        // Build specs JSON
        const specs = JSON.stringify({
            surface: data.surface || undefined,
            dimensions: data.dimensions || undefined,
            simDimensions: data.simDimensions || undefined,
            origin: data.origin || undefined,
            antiSlip: data.antiSlip || undefined,
            patternCount: data.patternCount || undefined,
            color: data.color || undefined,
        })

        const payload = {
            name: data.name,
            slug: data.slug,
            sku: data.sku,
            description: data.description,
            thumbnail: data.thumbnail || "",
            images: data.images || "[]",
            price: data.price || 0,
            originalPrice: data.originalPrice,
            showPrice: data.showPrice,
            isPublished: data.isPublished,
            categoryId: tileCategoryId,
            productTypeId: data.productTypeId,
            collectionId: data.collectionId || undefined,
            specs,
            material: data.material || undefined,
            thickness: data.thickness || undefined,
            waterAbsorption: data.waterAbsorption || undefined,
            usage: data.usage || undefined,
            colorHex: data.colorHex || undefined,
        }

        let result
        if (initialData) {
            result = await updateProduct(initialData.id, payload)
        } else {
            result = await createProduct(payload)
        }

        if (result?.errors) {
            toast.error("Vui lòng kiểm tra lại các trường thông tin")
            console.error(result.errors)
        } else if (result?.message) {
            toast.error(result.message)
        }
        // If successful, server action will redirect
    }

    // Step 1: Choose sub-category
    if (step === 1) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Bước 1: Chọn loại gạch</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {subCategories.map((sub) => (
                        <button
                            key={sub.id}
                            type="button"
                            onClick={() => {
                                form.setValue("productTypeId", sub.id)
                                setStep(2)
                            }}
                            className="w-full flex items-center gap-3 rounded-lg border p-4 text-left hover:bg-accent transition-colors"
                        >
                            <Package className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium">{sub.name}</span>
                        </button>
                    ))}
                </CardContent>
            </Card>
        )
    }

    // Step 2: Choose or create BST
    if (step === 2) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Bước 2: Chọn bộ sưu tập</CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                            ← Quay lại
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {filteredCollections.map((col) => (
                        <button
                            key={col.id}
                            type="button"
                            onClick={() => {
                                form.setValue("collectionId", col.id)
                                setStep(3)
                            }}
                            className="w-full flex items-center gap-3 rounded-lg border p-4 text-left hover:bg-accent transition-colors"
                        >
                            <span className="font-medium">{col.name}</span>
                        </button>
                    ))}

                    {filteredCollections.length === 0 && (
                        <p className="text-sm text-muted-foreground py-2">
                            Chưa có BST nào cho loại gạch đã chọn
                        </p>
                    )}

                    <Separator />

                    {/* Skip BST */}
                    <button
                        type="button"
                        onClick={() => {
                            form.setValue("collectionId", "")
                            setStep(3)
                        }}
                        className="w-full flex items-center gap-3 rounded-lg border border-dashed p-4 text-left text-muted-foreground hover:bg-accent/50 transition-colors"
                    >
                        Bỏ qua — không thuộc BST nào
                    </button>

                    {/* Create new BST */}
                    <Dialog open={showNewBST} onOpenChange={setShowNewBST}>
                        <DialogTrigger asChild>
                            <button
                                type="button"
                                className="w-full flex items-center gap-3 rounded-lg border border-dashed p-4 text-left text-primary hover:bg-accent/50 transition-colors"
                            >
                                <PlusCircle className="h-5 w-5" />
                                <span className="font-medium">Tạo BST mới</span>
                            </button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Tạo bộ sưu tập mới</DialogTitle>
                                <DialogDescription>
                                    BST mới sẽ thuộc loại gạch đang chọn
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Tên BST</label>
                                    <Input
                                        placeholder="VD: INSIDE ART"
                                        value={newBSTName}
                                        onChange={(e) => {
                                            setNewBSTName(e.target.value)
                                            setNewBSTSlug(toSlug(e.target.value))
                                        }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Slug</label>
                                    <Input
                                        placeholder="inside-art"
                                        value={newBSTSlug}
                                        onChange={(e) => setNewBSTSlug(e.target.value)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    onClick={handleCreateBST}
                                    disabled={!newBSTName || creatingBST}
                                >
                                    {creatingBST ? "Đang tạo..." : "Tạo BST"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardContent>
            </Card>
        )
    }

    // Step 3: Full form
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                {/* Step navigation for new products */}
                {!initialData && (
                    <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
                        <button type="button" onClick={() => setStep(1)} className="hover:text-foreground">
                            Loại gạch
                        </button>
                        <span>→</span>
                        <button type="button" onClick={() => setStep(2)} className="hover:text-foreground">
                            BST
                        </button>
                        <span>→</span>
                        <span className="text-foreground font-medium">Chi tiết</span>
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                    {/* Left column — content */}
                    <div className="space-y-6">
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
                                                <Input placeholder="VD: Gạch 120278EN7Z" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="slug"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Slug</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="gach-120278en7z" {...field} />
                                                </FormControl>
                                                <FormDescription>Tự động tạo từ tên</FormDescription>
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
                                                    <Input placeholder="120278EN7Z" {...field} />
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
                                                <Textarea rows={4} placeholder="Mô tả sản phẩm..." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="thumbnail"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Ảnh thumbnail (1 ảnh)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="https://..." {...field} />
                                            </FormControl>
                                            <FormDescription>URL ảnh hiển thị ở card/listing</FormDescription>
                                            {field.value && (
                                                <div className="h-20 w-20 rounded-lg border overflow-hidden mt-2">
                                                    <img src={field.value} alt="" className="h-full w-full object-cover" />
                                                </div>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="images"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Ảnh chi tiết (JSON array)</FormLabel>
                                            <FormControl>
                                                <Input placeholder='["https://..."]' {...field} />
                                            </FormControl>
                                            <FormDescription>Nhiều ảnh cho trang chi tiết sản phẩm</FormDescription>
                                            {field.value && field.value !== "[]" && (() => {
                                                try {
                                                    const urls = JSON.parse(field.value)
                                                    if (Array.isArray(urls) && urls.length > 0) {
                                                        return (
                                                            <div className="flex gap-2 mt-2">
                                                                {urls.slice(0, 4).map((url: string, i: number) => (
                                                                    <div key={i} className="h-16 w-16 rounded-lg border overflow-hidden">
                                                                        <img src={url} alt="" className="h-full w-full object-cover" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )
                                                    }
                                                } catch { }
                                                return null
                                            })()}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        {/* Tile specs */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Thông số kỹ thuật</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="surface"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Bề mặt</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Chọn bề mặt" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Bóng">Bóng</SelectItem>
                                                        <SelectItem value="Mờ">Mờ</SelectItem>
                                                        <SelectItem value="Sugar">Sugar</SelectItem>
                                                        <SelectItem value="Matte">Matte</SelectItem>
                                                        <SelectItem value="Polished">Polished</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="dimensions"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Kích thước</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="60×120cm" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="simDimensions"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>KT giả (hiển thị)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="60×120cm" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="origin"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Xuất xứ</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Chọn xuất xứ" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Ý">Ý</SelectItem>
                                                        <SelectItem value="Tây Ban Nha">Tây Ban Nha</SelectItem>
                                                        <SelectItem value="Việt Nam">Việt Nam</SelectItem>
                                                        <SelectItem value="Trung Quốc">Trung Quốc</SelectItem>
                                                        <SelectItem value="Ấn Độ">Ấn Độ</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="antiSlip"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Chống trượt</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Chọn" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Không">Không</SelectItem>
                                                        <SelectItem value="R9">R9</SelectItem>
                                                        <SelectItem value="R10">R10</SelectItem>
                                                        <SelectItem value="R11">R11</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="patternCount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Số mẫu</FormLabel>
                                                <FormControl>
                                                    <Input type="number" placeholder="4" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="color"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Màu sắc</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Trắng, Xám, Vàng..." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        {/* Product Info (Tab: Thông tin sản phẩm) */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Thông tin sản phẩm</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="material"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Chất liệu</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Chọn chất liệu" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Porcelain">Porcelain</SelectItem>
                                                        <SelectItem value="Ceramic">Ceramic</SelectItem>
                                                        <SelectItem value="Granite">Granite</SelectItem>
                                                        <SelectItem value="Marble">Marble</SelectItem>
                                                        <SelectItem value="Mosaic">Mosaic</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="thickness"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Độ dày</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="9mm" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="waterAbsorption"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Độ hút nước</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="< 0.5%" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="colorHex"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Mã màu (Hex)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="#3b82f6" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="usage"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Ứng dụng</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Lát nền, Ốp tường, Mặt bàn..." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right column — sidebar */}
                    <div className="space-y-6">
                        {/* Classification */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Phân loại</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="productTypeId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Loại gạch</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Chọn loại" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {subCategories.map((sub) => (
                                                        <SelectItem key={sub.id} value={sub.id}>
                                                            {sub.name}
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
                                                    {filteredCollections.length === 0 && (
                                                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                                            Chưa có BST
                                                        </div>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        {/* Price */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Giá</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
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
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="showPrice"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center gap-2 space-y-0">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormLabel className="font-normal">Hiển thị giá</FormLabel>
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        {/* Publishing */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Xuất bản</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="isPublished"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center gap-2 space-y-0">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormLabel className="font-normal">Hiển thị trên website</FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="isFeatured"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center gap-2 space-y-0">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormLabel className="font-normal">Sản phẩm nổi bật</FormLabel>
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        {/* Submit */}
                        <Button type="submit" className="w-full" size="lg">
                            {initialData ? "Cập nhật sản phẩm" : "Tạo sản phẩm"}
                        </Button>
                    </div>
                </div>
            </form>
        </Form>
    )
}
