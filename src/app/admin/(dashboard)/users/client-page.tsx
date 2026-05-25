'use client'

import { useState } from 'react'
import { Plus, Pencil, Shield, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { UserFormModal } from './user-form'
import type { AdminRole } from '@/lib/auth/permissions'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/auth/permissions'

interface User {
    id: number;
    name: string;
    email: string;
    username: string | null;
    role: string;
    is_active: boolean;
    last_login_at: Date | null;
}

export function UsersClient({ users }: { users: User[] }) {
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const openCreate = () => {
        setSelectedUser(null)
        setIsModalOpen(true)
    }

    const openEdit = (user: User) => {
        setSelectedUser(user)
        setIsModalOpen(true)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Quản lý nhân viên</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Quản lý tài khoản và phân quyền truy cập hệ thống CMS
                    </p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Thêm nhân viên
                </Button>
            </div>

            <div className="rounded-xl border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nhân viên</TableHead>
                            <TableHead>Vai trò</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead>Đăng nhập lần cuối</TableHead>
                            <TableHead className="text-right">Thao tác</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{user.name}</span>
                                        <div className="flex gap-2 items-center text-sm text-muted-foreground mt-0.5">
                                            {user.username && <span className="text-[#2E7A96] font-medium">@{user.username}</span>}
                                            <span className={user.username ? "text-xs opacity-70" : ""}>{user.email}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role as AdminRole] || 'bg-gray-100'}`}>
                                        <Shield className="mr-1 h-3 w-3" />
                                        {ROLE_LABELS[user.role as AdminRole]}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    {user.is_active ? (
                                        <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">Hoạt động</Badge>
                                    ) : (
                                        <Badge variant="secondary" className="bg-stone-100 text-stone-500">Đã khóa</Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {user.last_login_at ? (
                                        <div className="flex items-center text-sm text-muted-foreground">
                                            <Clock className="mr-1.5 h-3.5 w-3.5" />
                                            {new Date(user.last_login_at).toLocaleString('vi-VN', {
                                                day: '2-digit', month: '2-digit', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit'
                                            })}
                                        </div>
                                    ) : (
                                        <span className="text-sm text-muted-foreground italic">Chưa đăng nhập</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                                        <Pencil className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {isModalOpen && (
                <UserFormModal
                    user={selectedUser}
                    open={isModalOpen}
                    onOpenChange={setIsModalOpen}
                />
            )}
        </div>
    )
}
