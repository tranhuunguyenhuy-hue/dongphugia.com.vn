"use client"

import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ImageUploader } from "@/components/ui/image-uploader"
import { createProductType, updateProductType } from "@/lib/actions"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

const formSchema = z.object({
    name: z.string().min(1, "Tên loại sản phẩm là bắt buộc"),
    slug: z.string().min(1, "Slug là bắt buộc"),
    image: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

function toSlug(str: string): string {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim()
}

interface ProductTypeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    categoryId: string
    initialData?: {
        id: string
        name: string
        slug: string
        image: string | null
    } | null
}

export function ProductTypeDialog({
    open,
    onOpenChange,
    categoryId,
    initialData,
}: ProductTypeDialogProps) {
    const [isPending, startTransition] = useTransition()
    const isEditing = !!initialData

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: initialData?.name || "",
            slug: initialData?.slug || "",
            image: initialData?.image || "",
        },
    })

    const onSubmit = (data: FormValues) => {
        startTransition(async () => {
            const payload = { ...data, categoryId }

            const result = isEditing
                ? await updateProductType(initialData!.id, payload)
                : await createProductType(payload)

            if (result?.errors) {
                Object.entries(result.errors).forEach(([key, msgs]) => {
                    form.setError(key as any, {
                        message: (msgs as string[]).join(", "),
                    })
                })
                return
            }

            if (result?.message && !result?.success) {
                toast.error(result.message)
                return
            }

            toast.success(
                isEditing
                    ? "Đã cập nhật loại sản phẩm"
                    : "Đã tạo loại sản phẩm mới"
            )
            form.reset()
            onOpenChange(false)
        })
    }

    // Auto-generate slug when typing name
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value
        form.setValue("name", name)
        if (!isEditing) {
            form.setValue("slug", toSlug(name))
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? "Sửa loại sản phẩm" : "Thêm loại sản phẩm mới"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Tên loại sản phẩm</Label>
                        <Input
                            id="name"
                            placeholder="VD: Gạch Vân đá Marble"
                            {...form.register("name")}
                            onChange={handleNameChange}
                        />
                        {form.formState.errors.name && (
                            <p className="text-sm text-destructive">
                                {form.formState.errors.name.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="slug">Slug (URL)</Label>
                        <Input
                            id="slug"
                            placeholder="gach-van-da-marble"
                            {...form.register("slug")}
                        />
                        {form.formState.errors.slug && (
                            <p className="text-sm text-destructive">
                                {form.formState.errors.slug.message}
                            </p>
                        )}
                    </div>

                    <ImageUploader
                        value={form.watch("image") || ""}
                        onChange={(val) =>
                            form.setValue("image", Array.isArray(val) ? val[0] : val)
                        }
                        label="Ảnh đại diện (tuỳ chọn)"
                    />

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Huỷ
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {isEditing ? "Cập nhật" : "Tạo mới"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
