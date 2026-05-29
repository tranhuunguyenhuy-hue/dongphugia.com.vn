'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { type ColumnDef } from '@tanstack/react-table'
import { customers } from '@prisma/client'
import { DataTable } from '@/components/admin/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, MoreHorizontal, UserCircle, MessageSquare } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function getSourceBadge(source: string | null) {
    if (!source) return <Badge variant="outline">Không rõ</Badge>
    switch (source) {
        case 'QUOTE_FORM':
            return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-0">Form Báo giá</Badge>
        case 'CONTACT_FORM':
            return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-0">Liên hệ</Badge>
        case 'FOOTER_FORM':
            return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-0">Footer</Badge>
        case 'MANUAL':
            return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100 border-0">Thủ công</Badge>
        default:
            return <Badge variant="outline">{source}</Badge>
    }
}

export function CustomersTableClient({
    customers,
}: {
    customers: customers[]
}) {
    const router = useRouter()

    const columns: ColumnDef<customers>[] = [
        {
            accessorKey: 'full_name',
            header: 'Khách hàng',
            cell: ({ row }) => {
                const customer = row.original
                return (
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 shrink-0">
                            <UserCircle className="h-6 w-6" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-medium">{customer.full_name || 'Khách Vãng Lai'}</span>
                            <span className="text-xs text-muted-foreground line-clamp-1">{customer.email || 'Không có email'}</span>
                        </div>
                    </div>
                )
            },
        },
        {
            accessorKey: 'phone',
            header: 'Số điện thoại',
            cell: ({ row }) => {
                const phone = row.getValue('phone') as string
                return (
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-[#192125]">{phone}</span>
                    </div>
                )
            },
        },
        {
            accessorKey: 'source',
            header: 'Nguồn',
            cell: ({ row }) => {
                return getSourceBadge(row.getValue('source') as string)
            },
        },
        {
            accessorKey: 'last_interacted_at',
            header: 'Tương tác cuối',
            cell: ({ row }) => {
                const dateStr = row.getValue('last_interacted_at') as Date
                if (!dateStr) return '-'
                const d = new Date(dateStr)
                return (
                    <div className="text-sm">
                        {d.toLocaleDateString('vi-VN')} <span className="text-muted-foreground text-xs">{d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                )
            },
        },
        {
            accessorKey: 'notes',
            header: 'Ghi chú CSKH',
            cell: ({ row }) => {
                const note = row.getValue('notes') as string
                if (!note) return <span className="text-muted-foreground text-sm italic">Trống</span>
                return (
                    <div className="flex items-center gap-2 max-w-[200px]" title={note}>
                        <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{note}</span>
                    </div>
                )
            },
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                const customer = row.original

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Mở menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Hành động</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                                <Link href={`/admin/customers/${customer.id}`}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Cập nhật thông tin
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => navigator.clipboard.writeText(customer.phone)}
                            >
                                Copy số điện thoại
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            },
        },
    ]

    return (
        <div className="bg-white rounded-xl border border-border/60 overflow-hidden">
            <DataTable columns={columns} data={customers} />
        </div>
    )
}
