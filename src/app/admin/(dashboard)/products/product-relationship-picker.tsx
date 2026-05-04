'use client'

import { useState, useEffect } from 'react'
import { searchProducts } from '@/lib/product-actions'
import { Input } from '@/components/ui/input'
import { Loader2, Search, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

interface ProductRelationshipPickerProps {
    excludeId?: number
    onSelect: (product: { id: number, name: string, sku: string, price: number | null, image_main_url: string | null }) => void
}

export function ProductRelationshipPicker({ excludeId, onSelect }: ProductRelationshipPickerProps) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        const fetchResults = async () => {
            setIsLoading(true)
            const data = await searchProducts(query, excludeId)
            setResults(data)
            
            // Only open automatically if typing. If clicking (query empty), onFocus handles opening
            if (query.length > 0) {
                setIsOpen(true)
            }
            setIsLoading(false)
        }

        const debounceTimer = setTimeout(fetchResults, 300)
        return () => clearTimeout(debounceTimer)
    }, [query, excludeId])

    return (
        <div className="relative w-full">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder="Tìm kiếm theo Tên hoặc SKU..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                    onFocus={async () => { 
                        setIsOpen(true) 
                        if (results.length === 0 && query === '') {
                            setIsLoading(true)
                            const data = await searchProducts('', excludeId)
                            setResults(data)
                            setIsLoading(false)
                        }
                    }}
                    onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                />
                {isLoading && (
                    <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
            </div>

            {isOpen && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                    {results.map(product => (
                        <div 
                            key={product.id} 
                            className="flex items-center justify-between p-2 hover:bg-stone-50 cursor-pointer border-b last:border-b-0"
                            onClick={() => {
                                onSelect(product)
                                setQuery('')
                                setIsOpen(false)
                            }}
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="h-10 w-10 relative rounded border overflow-hidden shrink-0 bg-stone-100 flex items-center justify-center">
                                    {product.image_main_url ? (
                                        <Image src={product.image_main_url} alt={product.name} fill className="object-cover" />
                                    ) : (
                                        <span className="text-[10px] text-stone-400">No Img</span>
                                    )}
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-sm font-medium truncate">{product.name}</span>
                                    <span className="text-xs text-muted-foreground">{product.sku} • {product.price ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price) : 'Liên hệ'}</span>
                                </div>
                            </div>
                            <Button size="sm" variant="ghost" className="shrink-0 h-8">
                                <Plus className="h-4 w-4 mr-1" /> Thêm
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {isOpen && query.length > 0 && results.length === 0 && !isLoading && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-50 p-4 text-center text-sm text-muted-foreground">
                    Không tìm thấy sản phẩm nào.
                </div>
            )}
        </div>
    )
}
