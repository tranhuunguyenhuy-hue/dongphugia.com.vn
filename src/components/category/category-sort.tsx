'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const SORT_OPTIONS = [
    { value: 'default',    label: 'Mặc định' },
    { value: 'price-asc',  label: 'Giá tăng dần' },
    { value: 'price-desc', label: 'Giá giảm dần' },
] as const

export function CategorySort() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const currentSort = searchParams.get('sort') || 'default'
    const isActive = currentSort !== 'default'

    const handleSortChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value === 'default') {
            params.delete('sort')
        } else {
            params.set('sort', value)
        }
        params.set('page', '1')
        router.push(`${pathname}?${params.toString()}`)
    }

    return (
        <Select value={currentSort} onValueChange={handleSortChange}>
            <SelectTrigger
                size="sm"
                className={`
                    h-7 min-w-0 w-auto gap-1 px-2.5 rounded-md
                    border bg-transparent shadow-none
                    text-[11px] font-medium cursor-pointer
                    transition-all duration-150
                    ${isActive
                        ? 'border-[#2E7A96]/25 bg-[#2E7A96]/5 text-[#2E7A96]'
                        : 'border-neutral-200 text-neutral-400 hover:border-neutral-300 hover:text-neutral-600 hover:bg-neutral-50'
                    }
                    [&_svg]:size-3 [&_svg]:opacity-40
                `}
            >
                <svg className="size-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-3L16.5 18m0 0L12 13.5m4.5 4.5V4.5" />
                </svg>
                <SelectValue placeholder="Sắp xếp" />
            </SelectTrigger>
            <SelectContent
                align="end"
                className="min-w-[140px] rounded-lg border-neutral-200 shadow-lg shadow-black/5"
            >
                {SORT_OPTIONS.map(opt => (
                    <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="text-[11px] py-1.5 rounded-md cursor-pointer"
                    >
                        {opt.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

