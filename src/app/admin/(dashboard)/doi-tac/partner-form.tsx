'use client'

import { useState } from "react"
import { useFormStatus } from "react-dom"
import { createPartner, updatePartner } from "@/lib/partner-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export default function PartnerForm({ partner }: { partner?: any }) {
    const [errors, setErrors] = useState<Record<string, string[]>>({})
    const [logoUrl, setLogoUrl] = useState(partner?.logo || "")

    async function action(formData: FormData) {
        const rawFormData = {
            name: formData.get("name"),
            websiteUrl: formData.get("websiteUrl"),
            logo: formData.get("logo"),
        }

        const res = partner ? await updatePartner(partner.id, rawFormData) : await createPartner(rawFormData)

        if (res?.errors) {
            setErrors(res.errors)
            toast.error("Vui lòng kiểm tra lại thông tin.")
        } else if (res?.message) {
            toast.error(res.message)
        } else {
            toast.success(partner ? "Cập nhật đối tác thành công" : "Tạo đối tác thành công")
        }
    }

    return (
        <form action={action} className="space-y-8 max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/admin/doi-tac">
                        <ChevronLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-xl font-semibold tracking-tight">
                    {partner ? `Chỉnh sửa Đối tác` : "Thêm Đối tác mới"}
                </h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Thông tin đối tác</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Tên đối tác</Label>
                        <Input id="name" name="name" defaultValue={partner?.name} placeholder="Tên đối tác..." required />
                        {errors.name && <p className="text-sm text-red-500">{errors.name[0]}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="websiteUrl">Website (Tùy chọn)</Label>
                        <Input id="websiteUrl" name="websiteUrl" defaultValue={partner?.websiteUrl || ""} placeholder="https://..." />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="logo">Logo URL</Label>
                        <Input
                            id="logo"
                            name="logo"
                            defaultValue={partner?.logo}
                            placeholder="https://..."
                            required
                            onChange={(e) => setLogoUrl(e.target.value)}
                        />
                        {errors.logo && <p className="text-sm text-red-500">{errors.logo[0]}</p>}
                        {logoUrl && (
                            <div className="relative h-20 w-40 mt-2 rounded-lg overflow-hidden border bg-muted">
                                <Image src={logoUrl} alt="Preview" fill className="object-contain" />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
                <Button variant="outline" asChild>
                    <Link href="/admin/doi-tac">Hủy</Link>
                </Button>
                <SubmitButton isEditing={!!partner} />
            </div>
        </form>
    )
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending}>
            {pending ? "Đang xử lý..." : isEditing ? "Cập nhật" : "Tạo đối tác"}
        </Button>
    )
}
