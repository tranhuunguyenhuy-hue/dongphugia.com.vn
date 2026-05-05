'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useTransition, useState } from 'react'

export function OrderSearch() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()
    const [search, setSearch] = useState(searchParams.get('search') || '')

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        const params = new URLSearchParams(searchParams.toString())
        if (search) {
            params.set('search', search)
            params.delete('page') // Reset page on new search
        } else {
            params.delete('search')
        }
        startTransition(() => {
            router.push(`/admin/orders?${params.toString()}`)
        })
    }

    return (
        <form onSubmit={handleSearch} className="relative w-full sm:w-[320px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                type="search"
                name="search"
                placeholder="Tìm mã đơn, tên, SĐT..."
                className="pl-9 h-10 w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={isPending}
            />
        </form>
    )
}
