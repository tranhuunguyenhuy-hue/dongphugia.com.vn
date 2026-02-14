'use client'

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ImageUploader } from "@/components/ui/image-uploader"
import { createGenericProduct, updateGenericProduct } from "@/lib/generic-product-actions"

interface ProductDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product?: any // Existing product for edit
    brands: any[]
    productTypes: any[]
    categoryId: string
}

// Zod Schema
const formSchema = z.object({
    name: z.string().min(1, "Tên sản phẩm bắt buộc"),
    slug: z.string().min(1, "Slug bắt buộc"),
    sku: z.string().optional(),
    price: z.coerce.number().optional(),
    originalPrice: z.coerce.number().optional(),
    showPrice: z.boolean().default(false),
    shortDescription: z.string().optional(),
    description: z.string().optional(),
    isPublished: z.boolean().default(true),

    brandId: z.string().min(1, "Chọn thương hiệu"),
    productTypeId: z.string().min(1, "Chọn loại sản phẩm"),
    productGroupId: z.string().optional(),
})

export function ProductDialog({ open, onOpenChange, product, brands, productTypes, categoryId }: ProductDialogProps) {
    const [loading, setLoading] = useState(false)
    const [thumbnail, setThumbnail] = useState<string[]>([])
    const [images, setImages] = useState<string[]>([])
    const [selectedType, setSelectedType] = useState<string>("")

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any, // Cast to any to avoid strict type mismatch during dev
        defaultValues: {
            name: "",
            slug: "",
            sku: "",
            price: 0,
            originalPrice: 0,
            showPrice: false,
            shortDescription: "",
            description: "",
            isPublished: true,
            brandId: "",
            productTypeId: "",
            productGroupId: "",
        }
    })

    // Reset form when dialog opens/closes or product changes
    useEffect(() => {
        if (open) {
            if (product) {
                form.reset({
                    name: product.name,
                    slug: product.slug,
                    sku: product.sku || "",
                    price: Number(product.price) || 0,
                    originalPrice: Number(product.originalPrice) || 0,
                    showPrice: product.showPrice,
                    shortDescription: product.shortDescription || "",
                    description: product.description || "",
                    isPublished: product.isPublished,
                    brandId: product.brandId || "",
                    productTypeId: product.productTypeId || "",
                    productGroupId: product.productGroupId || "none", // Handle undefined
                })
                setThumbnail(product.thumbnail ? [product.thumbnail] : [])
                try {
                    setImages(JSON.parse(product.images || "[]"))
                } catch { setImages([]) }
                setSelectedType(product.productTypeId || "")
            } else {
                form.reset({
                    name: "",
                    slug: "",
                    sku: "",
                    showPrice: false,
                    isPublished: true,
                    description: "",
                    shortDescription: "",
                    brandId: "",
                    productTypeId: "",
                    productGroupId: "none"
                })
                setThumbnail([])
                setImages([])
                setSelectedType("")
            }
        }
    }, [open, product, form])

    // Update slug when name changes
    const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        form.setValue("name", val)
        if (!product) {
            const slug = val.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^\w-]+/g, "")
            form.setValue("slug", slug)
        }
    }

    // Get groups for selected type
    const activeGroups = productTypes.find(t => t.id === selectedType)?.productGroups || []

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoading(true)
        const payload = {
            ...values,
            categoryId,
            thumbnail: thumbnail[0] || "",
            images: JSON.stringify(images),
            productGroupId: values.productGroupId === "none" ? null : values.productGroupId
        }

        let res
        if (product) {
            res = await updateGenericProduct(product.id, payload)
        } else {
            res = await createGenericProduct(payload)
        }

        setLoading(false)
        if (res.success) {
            toast.success(product ? "Cập nhật thành công" : "Tạo mới thành công")
            onOpenChange(false)
        } else {
            toast.error(res.error)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{product ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tên sản phẩm *</FormLabel>
                                    <FormControl><Input {...field} onChange={onNameChange} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="slug" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Slug</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="brandId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Thương hiệu *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Chọn thương hiệu" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {brands.map(b => (
                                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <div className="grid grid-cols-2 gap-2">
                                <FormField control={form.control} name="productTypeId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Loại sản phẩm *</FormLabel>
                                        <Select onValueChange={(val) => {
                                            field.onChange(val)
                                            setSelectedType(val)
                                            form.setValue("productGroupId", "none") // Reset group
                                        }} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Chọn loại" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {productTypes.map(t => (
                                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="productGroupId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nhóm (Tùy chọn)</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value || "none"}
                                            disabled={!selectedType || activeGroups.length === 0}
                                        >
                                            <FormControl><SelectTrigger><SelectValue placeholder="Không chọn" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">-- Không --</SelectItem>
                                                {activeGroups.map((g: any) => (
                                                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                            </div>
                        </div>

                        <FormField control={form.control} name="shortDescription" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Mô tả ngắn (Hiển thị ở danh sách)</FormLabel>
                                <FormControl><Input {...field} placeholder="VD: Vòi chậu rửa 3 lỗ" /></FormControl>
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-3 gap-4">
                            <FormField control={form.control} name="price" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Giá bán</FormLabel>
                                    <FormControl><Input {...field} type="number" /></FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="sku" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Mã SP (SKU)</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="showPrice" render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 mt-6">
                                    <div className="flex items-center space-x-2">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                        <FormLabel className="!mt-0">Hiện giá?</FormLabel>
                                    </div>
                                </FormItem>
                            )} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <FormLabel className="block mb-2">Ảnh đại diện (Thumbnail)</FormLabel>
                                <ImageUploader value={thumbnail} onChange={(value) => setThumbnail(Array.isArray(value) ? value : [value])} maxFiles={1} />
                            </div>
                            <div>
                                <FormLabel className="block mb-2">Album ảnh chi tiết</FormLabel>
                                <ImageUploader value={images} onChange={(value) => setImages(Array.isArray(value) ? value : [value])} maxFiles={5} />
                            </div>
                        </div>

                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Mô tả chi tiết (HTML)</FormLabel>
                                <FormControl><Textarea {...field} className="h-32" /></FormControl>
                            </FormItem>
                        )} />

                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Hủy</Button>
                            <Button type="submit" disabled={loading} className="press-effect">
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {product ? "Cập nhật" : "Tạo mới"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
