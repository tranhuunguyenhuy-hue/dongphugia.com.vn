'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Search, X, Check, ChevronsUpDown } from 'lucide-react'
import { useCallback, useTransition, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface Category { id: number; name: string; slug: string }
interface Subcategory { id: number; name: string; slug: string }
interface Brand { id: number; name: string; slug: string }

function FilterCombobox({
    value,
    onChange,
    options,
    placeholder,
    searchPlaceholder = "Tìm kiếm...",
    emptyText = "Không tìm thấy.",
    width = "w-[160px]"
}: {
    value: string
    onChange: (value: string) => void
    options: { value: string; label: string }[]
    placeholder: string
    searchPlaceholder?: string
    emptyText?: string
    width?: string
}) {
    const [open, setOpen] = useState(false)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("justify-between font-normal text-slate-700", width)}
                >
                    <span className="truncate">
                        {value && value !== 'all' && value !== 'default'
                            ? options.find((opt) => opt.value === value)?.label
                            : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className={cn("p-0", width)} align="start">
                <Command>
                    <CommandInput placeholder={searchPlaceholder} className="h-9" />
                    <CommandList>
                        <CommandEmpty>{emptyText}</CommandEmpty>
                        <CommandGroup>
                            {options.map((opt) => (
                                <CommandItem
                                    key={opt.value}
                                    value={opt.label} // CommandItem matches against string content (label usually) in shadcn, but we need to track value. Actually shadcn CommandItem value is derived from its string value. We should use opt.label for search.
                                    onSelect={() => {
                                        // We pass opt.value to onChange
                                        onChange(opt.value === value && opt.value !== 'all' && opt.value !== 'default' ? "" : opt.value)
                                        setOpen(false)
                                    }}
                                    className="cursor-pointer"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === opt.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {opt.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

export function ProductsFilters({ 
    categories, 
    subcategories, 
    brands,
    defaultCategoryId 
}: { 
    categories: Category[]
    subcategories?: Subcategory[]
    brands?: Brand[]
    defaultCategoryId?: number 
}) {
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
        
        // If category changes, clear subcategory
        if (key === 'category_id') {
            params.delete('subcategory_id')
        }
        
        params.delete('page') // reset to page 1
        startTransition(() => router.push(`/admin/products?${params.toString()}`))
    }, [router, searchParams])

    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const search = (e.currentTarget.elements.namedItem('search') as HTMLInputElement).value
        updateFilter('search', search || undefined)
    }

    const hasFilters = searchParams.has('search') || 
                       searchParams.has('category_id') || 
                       searchParams.has('subcategory_id') || 
                       searchParams.has('brand_id') || 
                       searchParams.has('highlight_type') || 
                       searchParams.has('is_active') ||
                       searchParams.has('sort')

    const currentCategory = searchParams.get('category_id') || String(defaultCategoryId)

    return (
        <div className="space-y-5">
            {/* Category Tabs */}
            <div className="border-b border-slate-200 overflow-x-auto no-scrollbar">
                <div className="flex gap-8 whitespace-nowrap px-1">

                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => updateFilter('category_id', String(cat.id))}
                            className={`pb-3 text-[13px] font-semibold tracking-wide transition-colors border-b-2 -mb-[1px] ${
                                currentCategory === String(cat.id)
                                    ? 'border-slate-900 text-slate-900' 
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Subcategory Pill Tabs */}
            {subcategories && subcategories.length > 0 && (
                <div className="overflow-x-auto no-scrollbar pb-2">
                    <Tabs 
                        value={searchParams.get('subcategory_id') || 'all'} 
                        onValueChange={(v) => updateFilter('subcategory_id', v)}
                    >
                        <TabsList className="h-9 w-fit justify-start bg-slate-100/50 p-1">
                            <TabsTrigger 
                                value="all"
                                className="px-4 text-[13px] rounded-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                            >
                                Tất cả
                            </TabsTrigger>
                            {subcategories.map(sub => (
                                <TabsTrigger 
                                    key={sub.id} 
                                    value={String(sub.id)}
                                    className="px-4 text-[13px] rounded-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                                >
                                    {sub.name}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
                {/* Search */}
                <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
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

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Brand filter */}
                    {brands && brands.length > 0 && (
                        <FilterCombobox 
                            value={searchParams.get('brand_id') || 'all'}
                            onChange={v => updateFilter('brand_id', v)}
                            options={[
                                { value: 'all', label: 'Tất cả thương hiệu' },
                                ...brands.map(b => ({ value: String(b.id), label: b.name }))
                            ]}
                            placeholder="Thương hiệu"
                            width="w-[160px]"
                        />
                    )}

                    {/* Highlight filter */}
                    <FilterCombobox 
                        value={searchParams.get('highlight_type') || 'all'}
                        onChange={v => updateFilter('highlight_type', v)}
                        options={[
                            { value: 'all', label: 'Tất cả hiển thị' },
                            { value: 'featured', label: 'Sản phẩm nổi bật' },
                            { value: 'promotion', label: 'Đang khuyến mãi' }
                        ]}
                        placeholder="Loại hiển thị"
                        width="w-[160px]"
                    />

                    {/* Status filter */}
                    <FilterCombobox 
                        value={searchParams.get('is_active') || 'all'}
                        onChange={v => updateFilter('is_active', v)}
                        options={[
                            { value: 'all', label: 'Tất cả trạng thái' },
                            { value: 'true', label: 'Đang hiển thị' },
                            { value: 'false', label: 'Đang ẩn' }
                        ]}
                        placeholder="Trạng thái"
                        width="w-[150px]"
                    />

                    {/* Sort filter */}
                    <FilterCombobox 
                        value={searchParams.get('sort') || 'default'}
                        onChange={v => updateFilter('sort', v)}
                        options={[
                            { value: 'default', label: 'Sắp xếp mặc định' },
                            { value: 'price_asc', label: 'Giá tăng dần' },
                            { value: 'price_desc', label: 'Giá giảm dần' }
                        ]}
                        placeholder="Sắp xếp"
                        width="w-[170px]"
                    />

                    {/* Clear filters */}
                    {hasFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push('/admin/products')}
                            className="text-muted-foreground hover:bg-slate-100"
                        >
                            <X className="h-4 w-4 mr-1" /> Xóa bộ lọc
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
