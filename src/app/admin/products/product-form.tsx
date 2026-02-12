"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
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
import { createProduct, updateProduct } from "@/lib/actions"
import { Category, Brand, ProductType, Product } from "@prisma/client"
// ... import { toast } from "sonner" 

const productSchema = z.object({
    name: z.string().min(2, {
        message: "Name must be at least 2 characters.",
    }),
    slug: z.string().min(2, {
        message: "Slug must be at least 2 characters.",
    }),
    price: z.coerce.number().min(0, { message: "Price must be positive" }),
    categoryId: z.string().min(1, "Please select a category"),
    brandId: z.string().optional(),
    productTypeId: z.string().optional(),
    description: z.string().optional(),
    images: z.string().optional(), // Comma separated for MVP
    isPublished: z.boolean().default(true),
})

type ProductFormValues = z.infer<typeof productSchema>

interface ProductFormProps {
    categories: Category[]
    brands: Brand[]
    productTypes: ProductType[]
    initialData?: Product | null
}

export default function ProductForm({ categories, brands, productTypes, initialData }: ProductFormProps) {
    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema) as any,
        defaultValues: initialData ? {
            name: initialData.name,
            slug: initialData.slug,
            price: Number(initialData.price) || 0,
            description: initialData.description || "",
            images: initialData.images || "",
            isPublished: initialData.isPublished,
            categoryId: initialData.categoryId,
            brandId: initialData.brandId || "",
            productTypeId: initialData.productTypeId || "",
        } : {
            name: "",
            slug: "",
            price: 0,
            description: "",
            images: "",
            isPublished: true,
            categoryId: "", // Explicit default
        },
    })

    async function onSubmit(data: ProductFormValues) {
        let result;
        if (initialData) {
            result = await updateProduct(initialData.id, data)
        } else {
            result = await createProduct(data)
        }

        if (result?.errors) {
            // handle errors
            console.error(result.errors)
            alert("Error saving product")
        } else {
            alert("Product saved successfully")
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                                <Input placeholder="Product name" {...field} />
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
                                    <Input placeholder="product-slug" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Price</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="0" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name="categoryId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Category</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a category" />
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
                                <FormLabel>Brand</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a brand" />
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
                    <FormField
                        control={form.control}
                        name="productTypeId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a type" />
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
                </div>

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Product description" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="images"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Images (CSV for MVP)</FormLabel>
                            <FormControl>
                                <Input placeholder="https://example.com/image.jpg" {...field} />
                            </FormControl>
                            <FormDescription>Enter image URLs separated by commas</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
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
                                <FormLabel>
                                    Published
                                </FormLabel>
                                <FormDescription>
                                    This product will appear on the public site.
                                </FormDescription>
                            </div>
                        </FormItem>
                    )}
                />
                <Button type="submit">save</Button>
            </form>
        </Form>
    )
}
