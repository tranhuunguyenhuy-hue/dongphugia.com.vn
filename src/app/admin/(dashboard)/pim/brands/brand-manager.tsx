'use client'

import { useState, useTransition } from 'react'
import { createBrand, setBrandActive } from '@/lib/pim-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Brand = { id: number; name: string; slug: string; is_active: boolean; is_featured: boolean; logo_url: string | null }

export function BrandManager({ brands }: { brands: Brand[] }) {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState('')
    return (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <Card>
                <CardHeader><CardTitle className="text-base">Thêm Brand</CardTitle></CardHeader>
                <CardContent>
                    <form className="space-y-4" onSubmit={(event) => {
                        event.preventDefault()
                        const data = new FormData(event.currentTarget)
                        startTransition(async () => {
                            const result = await createBrand({ name: data.get('name'), slug: data.get('slug'), logo_url: data.get('logo_url') || null, website_url: data.get('website_url') || null, is_active: true, is_featured: false, sort_order: 0 })
                            setMessage(result.success ? 'Đã tạo Brand.' : ('message' in result ? result.message : 'Dữ liệu Brand không hợp lệ.'))
                            if (result.success) event.currentTarget.reset()
                        })
                    }}>
                        <div><Label htmlFor="brand-name">Tên</Label><Input id="brand-name" name="name" required /></div>
                        <div><Label htmlFor="brand-slug">Slug</Label><Input id="brand-slug" name="slug" required /></div>
                        <div><Label htmlFor="brand-logo">Logo URL</Label><Input id="brand-logo" name="logo_url" type="url" /></div>
                        <div><Label htmlFor="brand-site">Website URL</Label><Input id="brand-site" name="website_url" type="url" /></div>
                        <Button type="submit" disabled={pending}>{pending ? 'Đang lưu…' : 'Tạo Brand'}</Button>
                        {message && <p className="text-sm text-muted-foreground">{message}</p>}
                    </form>
                </CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-base">Brands hiện có</CardTitle></CardHeader><CardContent>
                <div className="divide-y">{brands.map((brand) => <div key={brand.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span>{brand.name}<span className="ml-2 text-muted-foreground">/{brand.slug}</span></span><Button variant="ghost" size="sm" disabled={pending} onClick={() => startTransition(async () => { const result = await setBrandActive(brand.id, !brand.is_active); setMessage(result.success ? 'Đã cập nhật trạng thái Brand.' : ('message' in result ? result.message : 'Không thể cập nhật Brand.')) })}><span className={brand.is_active ? 'text-emerald-600' : 'text-muted-foreground'}>{brand.is_active ? 'active' : 'inactive'}</span></Button></div>)}</div>
            </CardContent></Card>
        </div>
    )
}
