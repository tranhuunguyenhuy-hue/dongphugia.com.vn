"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlusCircle, Upload, Loader2 } from "lucide-react"
import { createCollection } from "@/lib/actions"
import { toast } from "sonner"

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

interface CollectionDialogProps {
    productTypeId: string
    productTypeName: string
    // For edit mode
    editMode?: boolean
    initialName?: string
    initialImage?: string | null
    collectionId?: string
}

export default function CollectionDialog({
    productTypeId,
    productTypeName,
    editMode = false,
    initialName = "",
    initialImage = null,
    collectionId,
}: CollectionDialogProps) {
    const [open, setOpen] = useState(false)
    const [name, setName] = useState(initialName)
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(initialImage)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setImageFile(file)
            const reader = new FileReader()
            reader.onload = () => setImagePreview(reader.result as string)
            reader.readAsDataURL(file)
        }
    }

    const handleSubmit = async () => {
        if (!name.trim()) {
            toast.error("Vui lòng nhập tên bộ sưu tập")
            return
        }

        setIsSubmitting(true)
        try {
            let imageUrl = initialImage || undefined

            // Upload image if there's a new one
            if (imageFile) {
                const formData = new FormData()
                formData.append("file", imageFile)
                const res = await fetch("/api/upload", { method: "POST", body: formData })
                if (res.ok) {
                    const data = await res.json()
                    imageUrl = data.url
                }
            }

            if (editMode && collectionId) {
                // Use update action
                const { updateCollection } = await import("@/lib/actions")
                await updateCollection(collectionId, {
                    name: name.trim(),
                    slug: toSlug(name.trim()),
                    image: imageUrl,
                    productTypeId,
                })
                toast.success("Đã cập nhật bộ sưu tập")
            } else {
                // Create new
                await createCollection({
                    name: name.trim(),
                    slug: toSlug(name.trim()),
                    image: imageUrl,
                    productTypeId,
                })
                toast.success("Đã tạo bộ sưu tập mới")
            }

            setOpen(false)
            setName("")
            setImageFile(null)
            setImagePreview(null)
            router.refresh()
        } catch (error) {
            toast.error("Có lỗi xảy ra. Vui lòng thử lại.")
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {editMode ? (
                    <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded-sm">
                        Chỉnh sửa
                    </button>
                ) : (
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Tạo bộ sưu tập mới
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        {editMode ? "Chỉnh sửa bộ sưu tập" : "Tạo bộ sưu tập mới"}
                    </DialogTitle>
                    <DialogDescription>
                        {editMode
                            ? `Chỉnh sửa bộ sưu tập trong ${productTypeName}`
                            : `Tạo bộ sưu tập mới cho ${productTypeName}`
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Name input */}
                    <div className="space-y-2">
                        <Label htmlFor="collection-name">Tên bộ sưu tập</Label>
                        <Input
                            id="collection-name"
                            placeholder="VD: INSIDE ART, MYSTIC..."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="uppercase"
                        />
                    </div>

                    {/* Image upload */}
                    <div className="space-y-2">
                        <Label>Ảnh đại diện</Label>
                        <div className="flex items-center gap-4">
                            {imagePreview ? (
                                <div className="relative h-20 w-20 rounded-lg overflow-hidden border">
                                    <img
                                        src={imagePreview}
                                        alt="Preview"
                                        className="h-full w-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { setImageFile(null); setImagePreview(null) }}
                                        className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-black/80"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ) : (
                                <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors">
                                    <Upload className="h-5 w-5 text-muted-foreground" />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageChange}
                                    />
                                </label>
                            )}
                            <p className="text-xs text-muted-foreground">
                                Upload ảnh đại diện cho bộ sưu tập (tuỳ chọn)
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                        Hủy
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Đang xử lý...
                            </>
                        ) : (
                            editMode ? "Cập nhật" : "Tạo bộ sưu tập"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
