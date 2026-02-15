'use client'

import { useState, useEffect } from "react"
import { useFormStatus } from "react-dom"
import { createPost, updatePost } from "@/lib/post-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { slugify } from "@/lib/utils"
import { ImageUploader } from "@/components/ui/image-uploader"

export default function PostForm({ post }: { post?: any }) {
    const [errors, setErrors] = useState<Record<string, string[]>>({})
    const [title, setTitle] = useState(post?.title || "")
    const [slug, setSlug] = useState(post?.slug || "")
    const [thumbnailUrl, setThumbnailUrl] = useState(post?.thumbnail || "")

    // Auto-slug
    useEffect(() => {
        if (!post && title) {
            setSlug(slugify(title))
        }
    }, [title, post])

    async function action(formData: FormData) {
        const rawFormData = {
            title: formData.get("title"),
            slug: formData.get("slug"),
            content: formData.get("content"),
            thumbnail: formData.get("thumbnail"),
            isPublished: formData.get("isPublished") === "on",
        }

        const res = post ? await updatePost(post.id, rawFormData) : await createPost(rawFormData)

        if (res?.errors) {
            setErrors(res.errors)
            toast.error("Vui lòng kiểm tra lại thông tin.")
        } else if (res?.message) {
            toast.error(res.message)
        } else {
            toast.success(post ? "Cập nhật bài viết thành công" : "Tạo bài viết thành công")
        }
    }

    return (
        <form action={action} className="space-y-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/admin/bai-viet">
                        <ChevronLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-xl font-semibold tracking-tight">
                    {post ? `Chỉnh sửa Bài viết` : "Viết bài mới"}
                </h1>
            </div>

            <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Nội dung bài viết</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Tiêu đề</Label>
                                <Input
                                    id="title"
                                    name="title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Tiêu đề bài viết..."
                                    required
                                />
                                {errors.title && <p className="text-sm text-red-500">{errors.title[0]}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="slug">Slug (URL)</Label>
                                <Input
                                    id="slug"
                                    name="slug"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    placeholder="tieu-de-bai-viet"
                                    required
                                />
                                {errors.slug && <p className="text-sm text-red-500">{errors.slug[0]}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="content">Nội dung (HTML/Markdown)</Label>
                                <Textarea
                                    id="content"
                                    name="content"
                                    defaultValue={post?.content}
                                    placeholder="Nội dung bài viết..."
                                    required
                                    className="min-h-[300px] font-mono"
                                />
                                {errors.content && <p className="text-sm text-red-500">{errors.content[0]}</p>}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Cài đặt</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="thumbnail">Ảnh đại diện</Label>
                                <ImageUploader
                                    value={thumbnailUrl}
                                    onChange={(url) => setThumbnailUrl(url as string)}
                                    folder="posts"
                                />
                                <input type="hidden" name="thumbnail" value={thumbnailUrl} />
                            </div>

                            <div className="flex items-center space-x-2 pt-2">
                                <Checkbox id="isPublished" name="isPublished" defaultChecked={post?.isPublished ?? true} />
                                <Label htmlFor="isPublished">Xuất bản ngay</Label>
                            </div>

                            <div className="pt-4">
                                <SubmitButton isEditing={!!post} />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    )
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Đang xử lý..." : isEditing ? "Cập nhật" : "Đăng bài"}
        </Button>
    )
}
