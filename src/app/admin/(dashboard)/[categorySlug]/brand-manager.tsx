'use client'

import { useState } from "react"
import { Brand } from "@prisma/client"
import { Trash, Plus, Pencil, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { createBrand, deleteBrand } from "@/lib/brand-actions"
import { ImageUploader } from "@/components/ui/image-uploader"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface BrandManagerProps {
    brands: Brand[]
    categoryId: string
}

export function BrandManager({ brands, categoryId }: BrandManagerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Form state
    const [name, setName] = useState("")
    const [slug, setSlug] = useState("")
    const [logo, setLogo] = useState<string[]>([])

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setName(val)
        // Simple slugify
        setSlug(val.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^\w-]+/g, ""))
    }

    const onSubmit = async () => {
        if (!name || !slug) return toast.error("Vui lòng điền tên thương hiệu")

        setLoading(true)
        const res = await createBrand({
            name,
            slug,
            logo: logo[0] || "",
            categoryId
        })
        setLoading(false)

        if (res.success) {
            toast.success("Đã tạo thương hiệu")
            setIsOpen(false)
            setName("")
            setSlug("")
            setLogo([])
        } else {
            toast.error(res.error)
        }
    }

    const onDelete = async (id: string) => {
        if (!confirm("Bạn có chắc chắn muốn xóa thương hiệu này?")) return
        const res = await deleteBrand(id)
        if (res.success) toast.success("Đã xóa thương hiệu")
        else toast.error("Không thể xóa (có thể đang có sản phẩm)")
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Danh sách thương hiệu ({brands.length})</h3>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button className="press-effect">
                            <Plus className="mr-2 h-4 w-4" /> Thêm Thương Hiệu
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Thêm thương hiệu mới</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="grid gap-2">
                                <Label>Tên thương hiệu</Label>
                                <Input value={name} onChange={handleNameChange} placeholder="VD: TOTO" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Slug (URL)</Label>
                                <Input value={slug} onChange={e => setSlug(e.target.value)} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Logo (Tùy chọn)</Label>
                                <ImageUploader
                                    value={logo}
                                    onChange={(value) => setLogo(Array.isArray(value) ? value : [value])}
                                    maxFiles={1}
                                />
                            </div>
                            <Button onClick={onSubmit} disabled={loading} className="w-full">
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Tạo Thương Hiệu
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {brands.map(brand => (
                    <div key={brand.id} className="border rounded-lg p-4 flex flex-col items-center justify-between gap-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                        <div className="h-16 w-full flex items-center justify-center relative">
                            {brand.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={brand.logo} alt={brand.name} className="max-h-full max-w-full object-contain" />
                            ) : (
                                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xl">
                                    {brand.name[0]}
                                </div>
                            )}
                        </div>
                        <div className="text-center">
                            <div className="font-semibold">{brand.name}</div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 text-red-500 hover:text-red-600 hover:bg-red-50 h-8"
                                onClick={() => onDelete(brand.id)}
                            >
                                <Trash className="h-4 w-4" /> Xóa
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
