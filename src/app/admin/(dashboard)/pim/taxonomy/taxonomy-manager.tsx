'use client'

import { useState, useTransition } from 'react'
import { createCatalogTaxon, setCatalogTaxonState } from '@/lib/pim-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Taxon = { id: number; parent_id: number | null; name: string; slug: string; canonical_path: string; depth: number; is_active: boolean; is_listing_enabled: boolean }

export function TaxonomyManager({ taxons }: { taxons: Taxon[] }) {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState('')
    return <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card><CardHeader><CardTitle className="text-base">Thêm Taxon</CardTitle></CardHeader><CardContent>
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(async () => { const result = await createCatalogTaxon({ parent_id: data.get('parent_id') || null, name: data.get('name'), slug: data.get('slug'), canonical_path: data.get('canonical_path'), depth: Number(data.get('depth') || 0), sort_order: 0, is_active: true, is_listing_enabled: true, is_indexable: data.get('is_indexable') === 'on', seo_title: data.get('seo_title') || null, seo_description: data.get('seo_description') || null, kind: 'type', status: 'active' }); setMessage(result.success ? 'Đã tạo Taxon.' : ('message' in result ? result.message : 'Dữ liệu Taxon không hợp lệ.')); if (result.success) event.currentTarget.reset() }) }}>
                <div><Label htmlFor="taxon-name">Tên</Label><Input id="taxon-name" name="name" required /></div>
                <div><Label htmlFor="taxon-slug">Slug</Label><Input id="taxon-slug" name="slug" required /></div>
                <div><Label htmlFor="taxon-path">Canonical path</Label><Input id="taxon-path" name="canonical_path" placeholder="thiet-bi-ve-sinh/bon-cau" required /></div>
                <div><Label htmlFor="taxon-depth">Depth</Label><Input id="taxon-depth" name="depth" type="number" min="0" defaultValue="0" required /></div>
                <div><Label htmlFor="taxon-parent">Parent ID (optional)</Label><Input id="taxon-parent" name="parent_id" type="number" min="1" /></div>
                <div><Label htmlFor="taxon-seo-title">SEO title</Label><Input id="taxon-seo-title" name="seo_title" maxLength={200} /></div>
                <div><Label htmlFor="taxon-seo-description">SEO description</Label><Input id="taxon-seo-description" name="seo_description" maxLength={500} /></div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_indexable" defaultChecked /> Indexable</label>
                <Button type="submit" disabled={pending}>{pending ? 'Đang lưu…' : 'Tạo Taxon'}</Button>{message && <p className="text-sm text-muted-foreground">{message}</p>}
            </form>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Taxons hiện có</CardTitle></CardHeader><CardContent><div className="divide-y">{taxons.map((taxon) => <div key={taxon.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span><strong className="mr-2">#{taxon.id}</strong>{taxon.canonical_path}<span className="ml-2 text-muted-foreground">{taxon.name}</span></span><Button variant="ghost" size="sm" disabled={pending} onClick={() => startTransition(async () => { const result = await setCatalogTaxonState(taxon.id, { is_active: !taxon.is_active, is_listing_enabled: !taxon.is_listing_enabled }); setMessage(result.success ? 'Đã cập nhật trạng thái Taxon.' : ('message' in result ? result.message : 'Không thể cập nhật Taxon.')) })}><span className={taxon.is_active && taxon.is_listing_enabled ? 'text-emerald-600' : 'text-amber-600'}>{taxon.is_active && taxon.is_listing_enabled ? 'listing' : 'restricted'}</span></Button></div>)}</div></CardContent></Card>
    </div>
}
