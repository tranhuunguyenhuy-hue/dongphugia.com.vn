import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import prisma from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/admin/page-header'
import { CustomersTableClient } from './customers-table-client'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Khách hàng | Quản trị Đông Phú Gia',
    description: 'Hệ thống quản lý khách hàng CSKH',
}

export default async function CustomersPage(props: {
    searchParams: Promise<{ search?: string }>
}) {
    const searchParams = await props.searchParams
    const search = searchParams.search || ''

    const customers = await prisma.customers.findMany({
        where: search
            ? {
                OR: [
                    { full_name: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                ],
            }
            : undefined,
        orderBy: {
            last_interacted_at: 'desc',
        },
    })

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <PageHeader
                    title="Khách hàng (CSKH)"
                    description="Quản lý tập trung mọi liên hệ, khách hàng từ Form web và Báo giá."
                />
                <Button asChild className="bg-[#192125] hover:bg-[#192125]/90">
                    <Link href="/admin/customers/new">
                        <Plus className="mr-2 h-4 w-4" />
                        Thêm khách hàng
                    </Link>
                </Button>
            </div>

            <div className="bg-white p-4 rounded-xl border border-border/60 flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative w-full sm:w-[320px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Tìm tên, SĐT, email..."
                        className="pl-9 h-10 w-full"
                        defaultValue={search}
                    />
                </div>
            </div>

            <Suspense fallback={<div className="h-96 flex items-center justify-center">Đang tải...</div>}>
                <CustomersTableClient customers={customers} />
            </Suspense>
        </div>
    )
}
