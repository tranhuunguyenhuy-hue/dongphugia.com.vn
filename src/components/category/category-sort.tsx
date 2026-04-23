'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function CategorySort() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const currentSort = searchParams.get('sort') || 'default'

    const handleSortChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value === 'default') {
            params.delete('sort')
        } else {
            params.set('sort', value)
        }
        params.set('page', '1') // Reset page on sort
        router.push(`${pathname}?${params.toString()}`)
    }

    return (
        <Select value={currentSort} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[140px] h-9 bg-white border-neutral-200 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm text-neutral-700 shadow-sm">
                <SelectValue placeholder="Sắp xếp" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="default" className="text-sm">Mặc định (Mới nhất)</SelectItem>
                <SelectItem value="price-asc" className="text-sm">Giá: Thấp đến Cao</SelectItem>
                <SelectItem value="price-desc" className="text-sm">Giá: Cao đến Thấp</SelectItem>
            </SelectContent>
        </Select>
    )
}
