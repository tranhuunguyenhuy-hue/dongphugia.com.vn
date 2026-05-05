'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { customers } from '@prisma/client'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import { saveCustomer } from './actions'

export function CustomerForm({ initialData }: { initialData: customers | null }) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsLoading(true)

        const formData = new FormData(e.currentTarget)
        const data = {
            id: initialData?.id,
            full_name: formData.get('full_name') as string,
            phone: formData.get('phone') as string,
            email: formData.get('email') as string,
            notes: formData.get('notes') as string,
            source: formData.get('source') as string,
        }

        const res = await saveCustomer(data)

        if (res.success) {
            toast.success("Đã lưu thông tin khách hàng!")
            router.push('/admin/customers')
            router.refresh()
        } else {
            toast.error(res.error || "Đã có lỗi xảy ra.")
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/admin/customers">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {initialData ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng mới'}
                    </h1>
                </div>
                <Button type="submit" disabled={isLoading} className="bg-[#192125] hover:bg-[#192125]/90">
                    <Save className="h-4 w-4 mr-2" />
                    Lưu thông tin
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Thông tin liên hệ</CardTitle>
                            <CardDescription>
                                Thông tin cơ bản để định danh khách hàng. Số điện thoại là trường bắt buộc và duy nhất.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="full_name">Họ và tên <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="full_name"
                                        name="full_name"
                                        defaultValue={initialData?.full_name || ''}
                                        required
                                        placeholder="Nguyễn Văn A"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Số điện thoại <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="phone"
                                        name="phone"
                                        defaultValue={initialData?.phone || ''}
                                        required
                                        placeholder="0912345678"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    defaultValue={initialData?.email || ''}
                                    placeholder="example@gmail.com"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Ghi chú & CSKH</CardTitle>
                            <CardDescription>
                                Sales có thể ghi chú về nhu cầu, trạng thái quan tâm của khách hàng để dễ dàng theo dõi.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                name="notes"
                                defaultValue={initialData?.notes || ''}
                                rows={5}
                                placeholder="Khách hàng quan tâm đến thiết bị vệ sinh Inax, cần tư vấn thêm về chậu rửa bát..."
                            />
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Nguồn khách hàng</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nguồn</Label>
                                    <Select name="source" defaultValue={initialData?.source || 'MANUAL'}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="MANUAL">Thêm thủ công</SelectItem>
                                            <SelectItem value="QUOTE_FORM">Gửi Yêu cầu Báo giá</SelectItem>
                                            <SelectItem value="CONTACT_FORM">Form Liên hệ (Trang Contact)</SelectItem>
                                            <SelectItem value="FOOTER_FORM">Form Footer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {initialData?.last_interacted_at && (
                                    <div className="text-sm text-muted-foreground pt-4 border-t">
                                        <p>Tương tác lần cuối:</p>
                                        <p className="font-medium text-[#192125]">
                                            {new Date(initialData.last_interacted_at).toLocaleString('vi-VN')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    )
}
