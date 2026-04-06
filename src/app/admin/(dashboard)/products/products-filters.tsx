'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Search, X } from 'lucide-react'
import { useCallback, useTransition } from 'react'

interface Category { id: number; name: string; slug: string }

export function ProductsFilters({ categories }: { categories: Category[] }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const updateFilter = useCallback((key: string, value: string | undefined) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value && value !== 'all') {
            params.set(key, value)
        } else {
            params.delete(key)
        }
        params.delete('page') // reset to page 1
        startTransition(() => router.push(`/admin/products?${params.toString()}`))
    }, [router, searchParams])

    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const search = (e.currentTarget.elements.namedItem('search') as HTMLInputElement).value
        updateFilter('search', search || undefined)
    }

    const hasFilters = searchParams.has('search') || searchParams.has('category_id') || searchParams.has('is_active')

    return (
        <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px] max-w-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        name="search"
                        placeholder="Tìm tên, SKU..."
                        defaultValue={searchParams.get('search') || ''}
                        className="pl-9"
                    />
                </div>
                <Button type="submit" variant="secondary" disabled={isPending}>Tìm</Button>
            </form>

            {/* Category filter */}
            <Select
                value={searchParams.get('category_id') || 'all'}
                onValueChange={v => updateFilter('category_id', v)}
            >
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Tất cả danh mục" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Tất cả danh mục</SelectItem>
                    {categories.map(cat => (
                        <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Status filter */}
            <Select
                value={searchParams.get('is_active') || 'all'}
                onValueChange={v => updateFilter('is_active', v)}
            >
                <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="true">Đang hiển thị</SelectItem>
                    <SelectItem value="false">Đang ẩn</SelectItem>
                </SelectContent>
            </Select>

            {/* Clear filters */}
            {hasFilters && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/admin/products')}
                    className="text-muted-foreground"
                >
                    <X className="h-4 w-4 mr-1" /> Xóa bộ lọc
                </Button>
            )}
        </div>
    )
}
