'use client'

import { useState, useTransition } from 'react'
import { createSpecDefinition, createSpecOption } from '@/lib/pim-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Definition = { id: number; key: string; label: string; data_type: string; is_filterable: boolean; is_pdp_visible: boolean; spec_options: { id: number; value: string; slug: string }[] }

export function SpecificationManager({ definitions }: { definitions: Definition[] }) {
    const [pending, startTransition] = useTransition(); const [message, setMessage] = useState('')
    return <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">Thêm Specification Definition</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const d = new FormData(event.currentTarget); startTransition(async () => { const result = await createSpecDefinition({ key: d.get('key'), label: d.get('label'), data_type: d.get('data_type') || 'text', is_filterable: d.get('is_filterable') === 'on', is_pdp_visible: true, is_reserved: false, sort_order: 0, normalize_rule: {} }); setMessage(result.success ? 'Đã tạo Definition.' : ('message' in result ? result.message : 'Dữ liệu Definition không hợp lệ.')) }) }}><div><Label>Key</Label><Input name="key" required /></div><div><Label>Label</Label><Input name="label" required /></div><div><Label>Data type</Label><Input name="data_type" defaultValue="text" required /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_filterable" /> Cho phép filter</label><Button disabled={pending}>{pending ? 'Đang lưu…' : 'Tạo Definition'}</Button>{message && <p className="text-sm text-muted-foreground">{message}</p>}</form></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Definitions hiện có</CardTitle></CardHeader><CardContent><div className="divide-y">{definitions.map((definition) => <div key={definition.id} className="py-3 text-sm"><div><strong>#{definition.id}</strong> {definition.label} <span className="text-muted-foreground">{definition.key}</span></div><div className="mt-1 text-xs text-muted-foreground">{definition.data_type} · {definition.is_filterable ? 'filterable' : 'PDP only'} · {definition.spec_options.length} options</div></div>)}</div></CardContent></Card>
        <Card className="lg:col-span-2"><CardHeader><CardTitle className="text-base">Thêm Option</CardTitle></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-4" onSubmit={(event) => { event.preventDefault(); const d = new FormData(event.currentTarget); startTransition(async () => { const result = await createSpecOption({ spec_definition_id: Number(d.get('spec_definition_id')), value: d.get('value'), slug: d.get('slug'), sort_order: 0, aliases: [], is_active: true }); setMessage(result.success ? 'Đã tạo Option.' : ('message' in result ? result.message : 'Dữ liệu Option không hợp lệ.')) }) }}><div><Label>Definition ID</Label><Input name="spec_definition_id" type="number" min="1" required /></div><div><Label>Value</Label><Input name="value" required /></div><div><Label>Slug</Label><Input name="slug" required /></div><div className="flex items-end"><Button disabled={pending}>{pending ? 'Đang lưu…' : 'Tạo Option'}</Button></div></form></CardContent></Card>
    </div>
}
