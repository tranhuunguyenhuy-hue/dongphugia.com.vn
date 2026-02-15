"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createCollection, updateCollection } from "@/lib/actions"
import { ProductType, Collection } from "@prisma/client"
import { ImageUploader } from "@/components/ui/image-uploader"

const collectionSchema = z.object({
    name: z.string().min(2, "Tên phải có ít nhất 2 ký tự"),
    slug: z.string().min(2, "Slug phải có ít nhất 2 ký tự"),
    image: z.string().optional(),
    productTypeId: z.string().min(1, "Vui lòng chọn phân loại"),
})

type CollectionFormValues = z.infer<typeof collectionSchema>

interface CollectionFormProps {
    productTypes: ProductType[]
    initialData?: Collection | null
}

export default function CollectionForm({ productTypes, initialData }: CollectionFormProps) {
    const form = useForm<CollectionFormValues>({
        resolver: zodResolver(collectionSchema) as any,
        defaultValues: initialData ? {
            name: initialData.name,
            slug: initialData.slug,
            image: initialData.image || "",
            productTypeId: initialData.productTypeId,
        } : {
            name: "",
            slug: "",
            image: "",
            productTypeId: "",
        },
    })

    async function onSubmit(data: CollectionFormValues) {
        let result;
        if (initialData) {
            result = await updateCollection(initialData.id, data)
        } else {
            result = await createCollection(data)
        }

        if (result?.errors) {
            console.error(result.errors)
            alert("Lỗi khi lưu bộ sưu tập")
        } else if (result?.message) {
            alert(result.message)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Thông tin bộ sưu tập</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tên BST</FormLabel>
                                    <FormControl>
                                        <Input placeholder="VD: INSIDE ART" {...field} />
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
                                    <FormLabel>Slug</FormLabel>
                                    <FormControl>
                                        <Input placeholder="inside-art" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="productTypeId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Phân loại</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Chọn phân loại" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {productTypes.map((type) => (
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
                            name="image"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Ảnh đại diện (URL)</FormLabel>
                                    <FormControl>
                                        <ImageUploader
                                            value={field.value || ""}
                                            onChange={field.onChange}
                                            folder="collections"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <Button type="submit">
                    {initialData ? "Cập nhật" : "Tạo BST"}
                </Button>
            </form>
        </Form>
    )
}
