'use client'

import { useState, useEffect } from "react"
import { useFormStatus } from "react-dom"
import { createProject, updateProject } from "@/lib/project-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, X } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { slugify } from "@/lib/utils"

export default function ProjectForm({ project }: { project?: any }) {
    const [errors, setErrors] = useState<Record<string, string[]>>({})
    const [name, setName] = useState(project?.name || "")
    const [slug, setSlug] = useState(project?.slug || "")

    // Image handling
    const [imageUrl, setImageUrl] = useState("")
    const [images, setImages] = useState<string[]>(
        project?.images ? JSON.parse(project.images) : []
    )

    useEffect(() => {
        if (!project && name) {
            setSlug(slugify(name))
        }
    }, [name, project])

    const addImage = () => {
        if (imageUrl) {
            setImages([...images, imageUrl])
            setImageUrl("")
        }
    }

    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index))
    }

    async function action(formData: FormData) {
        const rawFormData = {
            name: formData.get("name"),
            slug: formData.get("slug"),
            description: formData.get("description"),
            images: JSON.stringify(images),
        }

        const res = project ? await updateProject(project.id, rawFormData) : await createProject(rawFormData)

        if (res?.errors) {
            setErrors(res.errors)
            toast.error("Vui lòng kiểm tra lại thông tin.")
        } else if (res?.message) {
            toast.error(res.message)
        } else {
            toast.success(project ? "Cập nhật dự án thành công" : "Tạo dự án thành công")
        }
    }

    return (
        <form action={action} className="space-y-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/admin/du-an">
                        <ChevronLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-xl font-semibold tracking-tight">
                    {project ? `Chỉnh sửa Dự án` : "Thêm Dự án mới"}
                </h1>
            </div>

            <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Thông tin dự án</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Tên dự án</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Tên dự án..."
                                    required
                                />
                                {errors.name && <p className="text-sm text-red-500">{errors.name[0]}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="slug">Slug (URL)</Label>
                                <Input
                                    id="slug"
                                    name="slug"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    placeholder="ten-du-an"
                                    required
                                />
                                {errors.slug && <p className="text-sm text-red-500">{errors.slug[0]}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Mô tả</Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    defaultValue={project?.description}
                                    placeholder="Mô tả dự án..."
                                    className="min-h-[150px]"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Hình ảnh ({images.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="https://..."
                                    value={imageUrl}
                                    onChange={(e) => setImageUrl(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            addImage()
                                        }
                                    }}
                                />
                                <Button type="button" onClick={addImage}>Thêm</Button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {images.map((img, i) => (
                                    <div key={i} className="relative aspect-video rounded-lg overflow-hidden border group">
                                        <Image src={img} alt={`Image ${i}`} fill className="object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(i)}
                                            className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
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
                            <div className="pt-4">
                                <SubmitButton isEditing={!!project} />
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
            {pending ? "Đang xử lý..." : isEditing ? "Cập nhật" : "Tạo dự án"}
        </Button>
    )
}
