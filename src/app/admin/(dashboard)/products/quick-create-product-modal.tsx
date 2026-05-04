'use client'

import { useState } from 'react'
import { createProduct } from '@/lib/product-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

interface QuickCreateProductModalProps {
    categories: { id: number, name: string }[]
    onSuccess: (product: { id: number, name: string, sku: string, price: number | null, image_main_url: string | null }) => void
}

export function QuickCreateProductModal({ categories, onSuccess }: QuickCreateProductModalProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    
    // Form state
    const [name, setName] = useState('')
    const [sku, setSku] = useState('')
    const [price, setPrice] = useState('')
    const [categoryId, setCategoryId] = useState<string>('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name || !sku || !categoryId) {
            toast.error('Vui lòng điền đủ Tên, SKU và Danh mục')
            return
        }

        setIsLoading(true)
        
        // Generate a simple slug
        const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        const slug = `${baseSlug}-${Math.floor(Math.random() * 10000)}`

        const newProduct = {
            name,
            sku,
            slug,
            category_id: parseInt(categoryId),
            price: price ? parseInt(price) : null,
            is_active: true,
            stock_status: 'in_stock'
        }

        const res = await createProduct(newProduct)
        setIsLoading(false)

        if (res.errors || res.message) {
            toast.error(res.message || 'Lỗi tạo sản phẩm (Kiểm tra SKU bị trùng)')
        } else if (res.success && res.id) {
            toast.success('Đã tạo sản phẩm thành công')
            onSuccess({
                id: res.id,
                name: newProduct.name,
                sku: newProduct.sku,
                price: newProduct.price,
                image_main_url: null
            })
            // Reset and close
            setName('')
            setSku('')
            setPrice('')
            setCategoryId('')
            setOpen(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="shrink-0 bg-white">
                    <Plus className="h-4 w-4 mr-2" /> Tạo nhanh
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Tạo nhanh sản phẩm</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="qc-name">Tên sản phẩm *</Label>
                        <Input id="qc-name" value={name} onChange={e => setName(e.target.value)} placeholder="Nhập tên sản phẩm..." required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="qc-sku">Mã SKU *</Label>
                            <Input id="qc-sku" value={sku} onChange={e => setSku(e.target.value)} placeholder="Nhập mã SKU..." required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="qc-price">Giá bán</Label>
                            <Input id="qc-price" type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="VNĐ" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="qc-category">Danh mục chính *</Label>
                        <Select value={categoryId} onValueChange={setCategoryId} required>
                            <SelectTrigger id="qc-category">
                                <SelectValue placeholder="Chọn danh mục" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(c => (
                                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Hủy</Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Lưu và Chọn
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
