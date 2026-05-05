'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { Plus, Search, Loader2, X, Link as LinkIcon, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { searchProducts } from '@/lib/product-actions'
import { linkVariant, unlinkVariant } from '@/lib/product-actions'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

interface VariantItem {
    id: number
    sku: string
    name: string
    price: number | null
    image_main_url: string | null
    variant_group: string | null
    colors?: { name: string, hex_code: string | null } | null
}

export function ProductVariantManager({ 
    productId, 
    initialVariants,
    currentVariantGroup
}: { 
    productId: number
    initialVariants: VariantItem[]
    currentVariantGroup: string | null
}) {
    const [variants, setVariants] = useState<VariantItem[]>(initialVariants)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<VariantItem[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [isPending, startTransition] = useTransition()

    const handleSearch = async () => {
        if (!searchQuery.trim() || searchQuery.length < 2) {
            setSearchResults([])
            return
        }
        setIsSearching(true)
        try {
            // Exclude current product and already linked variants
            const excludeIds = [productId, ...variants.map(v => v.id)]
            const results = await searchProducts(searchQuery, productId) // using existing search action
            
            // Further filter out already linked
            const filtered = (results as any[]).filter(r => !excludeIds.includes(r.id))
            setSearchResults(filtered)
        } catch (error) {
            console.error('Search error:', error)
            toast.error('Lỗi tìm kiếm sản phẩm')
        } finally {
            setIsSearching(false)
        }
    }

    const handleLinkVariant = (targetProduct: VariantItem) => {
        startTransition(async () => {
            const result = await linkVariant(productId, targetProduct.id)
            if (result.success) {
                toast.success('Đã liên kết biến thể thành công')
                setVariants([...variants, targetProduct])
                setSearchResults(searchResults.filter(r => r.id !== targetProduct.id))
                setSearchQuery('')
            } else {
                toast.error(result.message || 'Lỗi khi liên kết')
            }
        })
    }

    const handleUnlinkVariant = (targetId: number) => {
        startTransition(async () => {
            const result = await unlinkVariant(targetId, productId)
            if (result.success) {
                toast.success('Đã gỡ liên kết biến thể')
                setVariants(variants.filter(v => v.id !== targetId))
            } else {
                toast.error(result.message || 'Lỗi khi gỡ liên kết')
            }
        })
    }

    return (
        <Card className="shadow-none rounded-xl overflow-hidden p-0 gap-0 border border-[#E4EEF2]">
            <CardHeader className="bg-stone-100 border-b px-5 !py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold text-stone-900 flex items-center gap-2">
                            Quản lý Biến thể (Variants)
                            {currentVariantGroup && (
                                <Badge variant="secondary" className="font-mono text-xs bg-stone-200">
                                    {currentVariantGroup}
                                </Badge>
                            )}
                        </CardTitle>
                        <CardDescription className="text-sm mt-1">
                            Gom nhóm các sản phẩm có cùng kiểu dáng nhưng khác màu sắc, kích thước.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
                
                {/* Search & Add */}
                <div className="space-y-3">
                    <Label className="text-sm font-medium">Thêm biến thể có sẵn</Label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Nhập mã SKU hoặc tên sản phẩm để tìm kiếm..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="pl-9"
                            />
                        </div>
                        <Button type="button" onClick={handleSearch} disabled={isSearching} variant="secondary">
                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tìm kiếm'}
                        </Button>
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                        <div className="border rounded-lg max-h-[300px] overflow-y-auto bg-stone-50">
                            {searchResults.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-stone-100 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-white border rounded-md overflow-hidden flex items-center justify-center flex-shrink-0">
                                            {item.image_main_url ? (
                                                <Image src={item.image_main_url} alt={item.name} width={40} height={40} className="object-contain" />
                                            ) : (
                                                <Image src="/images/placeholder.svg" alt="placeholder" width={24} height={24} className="opacity-20" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-muted-foreground font-mono">{item.sku}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleLinkVariant(item)}
                                        disabled={isPending}
                                        className="shrink-0 gap-1"
                                    >
                                        <LinkIcon className="h-3 w-3" />
                                        Liên kết
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Current Variants List */}
                <div className="space-y-3">
                    <Label className="text-sm font-medium">Sản phẩm trong nhóm ({variants.length})</Label>
                    
                    {variants.length === 0 ? (
                        <div className="text-center py-8 bg-stone-50 rounded-lg border border-dashed">
                            <p className="text-sm text-muted-foreground">Sản phẩm này chưa được liên kết với biến thể nào.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {variants.map((v) => (
                                <div key={v.id} className={`flex items-center justify-between p-3 border rounded-lg ${v.id === productId ? 'bg-emerald-50 border-emerald-200' : 'bg-white'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 border rounded-md overflow-hidden flex items-center justify-center bg-white shrink-0">
                                            {v.image_main_url ? (
                                                <Image src={v.image_main_url} alt={v.name} width={48} height={48} className="object-contain" />
                                            ) : (
                                                <Image src="/images/placeholder.svg" alt="placeholder" width={24} height={24} className="opacity-20" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium">{v.name}</p>
                                                {v.id === productId && (
                                                    <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200">Sản phẩm hiện tại</Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-xs text-muted-foreground font-mono">{v.sku}</span>
                                                {v.colors && (
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-3 h-3 rounded-full border shadow-sm" style={{ backgroundColor: v.colors.hex_code || '#fff' }} />
                                                        <span className="text-xs text-muted-foreground">{v.colors.name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {v.id !== productId && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleUnlinkVariant(v.id)}
                                            disabled={isPending}
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                            title="Gỡ liên kết khỏi nhóm"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

function Label({ className, children }: { className?: string, children: React.ReactNode }) {
    return <label className={`block text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}>{children}</label>
}
