'use client'

import { useState } from "react"
import { useFormStatus } from "react-dom"
import { createBanner, updateBanner } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { ImageUploader } from "@/components/ui/image-uploader"

export default function BannerForm({ banner }: { banner?: any }) {
    const [errors, setErrors] = useState<Record<string, string[]>>({})

    async function action(formData: FormData) {
        const rawFormData = {
            title: formData.get("title"),
            image: formData.get("image"),
            link: formData.get("link"),
            order: formData.get("order"),
            isPublished: formData.get("isPublished") === "on",
        }

        const res = banner ? await updateBanner(banner.id, rawFormData) : await createBanner(rawFormData)

        if (res?.errors) {
            setErrors(res.errors)
            toast.error("Vui lòng kiểm tra lại thông tin.")
        } else if (res?.message) {
            toast.error(res.message)
        } else {
            toast.success(banner ? "Cập nhật banner thành công" : "Tạo banner thành công")
        }
    }

    const [imageUrl, setImageUrl] = useState(banner?.image || "")

    return (
        <form action={action} className="space-y-8 max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/admin/banners">
                        <ChevronLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-xl font-semibold tracking-tight">
                    {banner ? `Chỉnh sửa Banner` : "Thêm Banner mới"}
                </h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Thông tin Banner</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Tiêu đề</Label>
                        <Input id="title" name="title" defaultValue={banner?.title} placeholder="Tiêu đề banner..." required />
                        {errors.title && <p className="text-sm text-red-500">{errors.title[0]}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="image">URL Hình ảnh</Label>
                        <Label htmlFor="image">Hình ảnh</Label>
                        <ImageUploader
                            value={imageUrl}
                            onChange={(url) => setImageUrl(url as string)}
                            folder="banners"
                        />
                        <input type="hidden" name="image" value={imageUrl} />
                        {errors.image && <p className="text-sm text-red-500">{errors.image[0]}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="link">Link liên kết (Tùy chọn)</Label>
                            <Input id="link" name="link" defaultValue={banner?.link || ""} placeholder="/san-pham/..." />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="order">Thứ tự hiển thị</Label>
                            <Input id="order" name="order" type="number" defaultValue={banner?.order || 0} />
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox id="isPublished" name="isPublished" defaultChecked={banner?.isPublished ?? true} />
                        <Label htmlFor="isPublished">Hiển thị trên website</Label>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
                <Button variant="outline" asChild>
                    <Link href="/admin/banners">Hủy</Link>
                </Button>
                <SubmitButton isEditing={!!banner} />
            </div>
        </form>
    )
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending}>
            {pending ? "Đang xử lý..." : isEditing ? "Cập nhật Banner" : "Tạo Banner"}
        </Button>
    )
}
