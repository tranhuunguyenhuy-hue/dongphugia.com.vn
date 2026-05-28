'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveUser } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import type { AdminRole } from '@/lib/auth/permissions'
import { ROLE_LABELS } from '@/lib/auth/permissions'

export function UserFormModal({
    user,
    open,
    onOpenChange
}: {
    user?: {
        id?: number;
        username?: string | null;
        name?: string;
        email?: string;
        role?: string;
        is_active?: boolean;
    } | null;
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const isEdit = !!user

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const formData = new FormData(e.currentTarget)
        const data = {
            id: user?.id,
            username: formData.get('username') as string,
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            password: formData.get('password') as string,
            role: formData.get('role') as AdminRole,
            is_active: formData.get('is_active') === 'true'
        }

        const res = await saveUser(data)
        if (res.success) {
            onOpenChange(false)
            router.refresh()
        } else {
            setError(res.error || 'Đã có lỗi xảy ra')
        }
        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên mới'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="username">Tên đăng nhập</Label>
                // @ts-expect-error - Expected type mismatch due to Prisma Decimal vs number or partial types
                // @ts-expect-error - Expected type mismatch due to Prisma Decimal vs number or partial types
                        <Input id="username" name="username" defaultValue={user?.username || ""} placeholder="Mặc định đăng nhập bằng email" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="name">Họ và tên</Label>
                        <Input id="name" name="name" defaultValue={user?.name} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email đăng nhập</Label>
                        <Input id="email" name="email" type="email" defaultValue={user?.email} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">
                            {isEdit ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu'}
                        </Label>
                        <Input id="password" name="password" type="password" required={!isEdit} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="role">Phân quyền</Label>
                        <Select name="role" defaultValue={user?.role || 'sale'}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(ROLE_LABELS).map(([val, label]) => (
                                    <SelectItem key={val} value={val}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <Label htmlFor="is_active">Trạng thái hoạt động</Label>
                            <p className="text-[0.8rem] text-muted-foreground">
                                Cho phép đăng nhập vào hệ thống
                            </p>
                        </div>
                        <Select name="is_active" defaultValue={user ? String(user.is_active) : 'true'}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="true">Hoạt động</SelectItem>
                                <SelectItem value="false">Khóa</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    
                    {error && (
                        <p className="text-sm text-destructive font-medium">{error}</p>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Hủy
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Đang lưu...' : 'Lưu lại'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
