'use client'

import { useMemo, useState, useTransition } from 'react'
import { addProductDocument, removeProductDocument, updateProductDocument, upsertProductSpecValues } from '@/lib/pim-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type SpecDefinition = {
    id: number
    key: string
    label: string
    data_type: string
    unit: string | null
    spec_options: { id: number; value: string }[]
}

type ProductSpecValue = {
    spec_definition_id: number
    option_id: number | null
    value_text: string | null
    value_number: number | null
}

type ProductDocument = {
    id: number
    name: string
    url: string
    document_type: string
    sort_order: number
}

export function NormalizedPimPanel({
    productId,
    definitions,
    initialValues,
    initialDocuments,
}: {
    productId?: number
    definitions: SpecDefinition[]
    initialValues: ProductSpecValue[]
    initialDocuments: ProductDocument[]
}) {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState('')
    const [values, setValues] = useState<Record<number, { option_id: number | null; value_text: string }>>(() => {
        const initial: Record<number, { option_id: number | null; value_text: string }> = {}
        initialValues.forEach((value) => {
            initial[value.spec_definition_id] = {
                option_id: value.option_id,
                value_text: value.value_text ?? (value.value_number === null ? '' : String(value.value_number)),
            }
        })
        return initial
    })
    const [documents, setDocuments] = useState(initialDocuments)
    const [documentName, setDocumentName] = useState('')
    const [documentUrl, setDocumentUrl] = useState('')

    const normalizedValues = useMemo(() => definitions.flatMap((definition, index) => {
        const value = values[definition.id]
        if (!value || (!value.option_id && !value.value_text.trim())) return []
        return [{
            spec_definition_id: definition.id,
            option_id: value.option_id,
            value_text: definition.data_type === 'number' ? null : value.value_text || null,
            value_number: definition.data_type === 'number' ? Number(value.value_text) : null,
            raw_key: definition.key,
            raw_value: value.value_text || null,
            sort_order: index,
        }]
    }), [definitions, values])

    if (!productId) {
        return <Card><CardHeader><CardTitle className="text-base">Normalized Specifications & Documents</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Lưu Product trước để nhập normalized specifications và document references.</CardContent></Card>
    }

    return <div className="space-y-6">
        <Card>
            <CardHeader><CardTitle className="text-base">Normalized Specifications</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                {definitions.length === 0 && <p className="text-sm text-muted-foreground">Chưa có Specification Definition.</p>}
                {definitions.map((definition) => {
                    const value = values[definition.id] ?? { option_id: null, value_text: '' }
                    return <div key={definition.id} className="grid gap-2 md:grid-cols-[220px_1fr] md:items-center">
                        <Label>{definition.label}{definition.unit ? ' (' + definition.unit + ')' : ''}</Label>
                        {definition.spec_options.length > 0 ? <select className="h-10 rounded-md border bg-background px-3 text-sm" value={value.option_id ?? ''} onChange={(event) => setValues((current) => ({ ...current, [definition.id]: { value_text: event.target.options[event.target.selectedIndex]?.text ?? '', option_id: event.target.value ? Number(event.target.value) : null } }))}><option value="">Chọn giá trị</option>{definition.spec_options.map((option) => <option key={option.id} value={option.id}>{option.value}</option>)}</select> : <Input value={value.value_text} onChange={(event) => setValues((current) => ({ ...current, [definition.id]: { option_id: null, value_text: event.target.value } }))} placeholder={definition.data_type} />}
                    </div>
                })}
                <Button disabled={pending} onClick={() => startTransition(async () => { const result = await upsertProductSpecValues(productId, normalizedValues); setMessage(result.success ? 'Đã lưu normalized specifications.' : ('message' in result ? String(result.message ?? '') : 'Dữ liệu specification không hợp lệ.')) })}>{pending ? 'Đang lưu…' : 'Lưu Specifications'}</Button>
            </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle className="text-base">Product Documents</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2"><div><Label>Tên tài liệu</Label><Input value={documentName} onChange={(event) => setDocumentName(event.target.value)} /></div><div><Label>HTTPS URL</Label><Input value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} placeholder="https://cdn..." /></div></div>
                <Button disabled={pending || !documentName || !documentUrl} onClick={() => startTransition(async () => { const result = await addProductDocument(productId, { name: documentName, url: documentUrl, document_type: 'DOCUMENT', sort_order: documents.length }); if (result.success && 'id' in result && result.id) { setDocuments((current) => [...current, { id: result.id, name: documentName, url: documentUrl, document_type: 'DOCUMENT', sort_order: current.length }]); setDocumentName(''); setDocumentUrl(''); setMessage('Đã thêm document reference.') } else setMessage('message' in result ? String(result.message ?? '') : 'Document không hợp lệ.') })}>Thêm Document</Button>
                <div className="divide-y">{documents.map((document) => <div key={document.id} className="grid gap-2 py-3 md:grid-cols-[1fr_1.5fr_auto_auto] md:items-center"><Input value={document.name} onChange={(event) => setDocuments((current) => current.map((item) => item.id === document.id ? { ...item, name: event.target.value } : item))} aria-label="Tên document" /><Input value={document.url} onChange={(event) => setDocuments((current) => current.map((item) => item.id === document.id ? { ...item, url: event.target.value } : item))} aria-label="URL document" /><Button variant="ghost" size="sm" disabled={pending} onClick={() => startTransition(async () => { const result = await updateProductDocument(document.id, { name: document.name, url: document.url, document_type: document.document_type, sort_order: document.sort_order }); setMessage(result.success ? 'Đã cập nhật document.' : ('message' in result ? result.message : 'Không thể cập nhật document.')) })}>Lưu</Button><Button variant="ghost" size="sm" disabled={pending} onClick={() => startTransition(async () => { const result = await removeProductDocument(document.id); if (result.success) setDocuments((current) => current.filter((item) => item.id !== document.id)); else setMessage('message' in result ? result.message : 'Không thể xóa document.') })}>Xóa</Button></div>)}</div>
                {message && <p className="text-sm text-muted-foreground">{message}</p>}
            </CardContent>
        </Card>
    </div>
}
