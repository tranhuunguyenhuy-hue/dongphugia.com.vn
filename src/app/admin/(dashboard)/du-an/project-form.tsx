'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createProject, updateProject } from '@/lib/project-actions'
import { toast } from 'sonner'
import { Loader2, Save, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImageUploader } from '@/components/ui/image-uploader'

const CATEGORY_OPTIONS = ['Biệt thự', 'Khách sạn', 'Resort', 'Nhà ở', 'Chung cư', 'Văn phòng', 'Khác']

interface ProjectFormProps {
    project?: any
}

export function ProjectForm({ project }: ProjectFormProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const isEdit = !!project

    const [form, setForm] = useState({
        title: project?.title || '',
        location: project?.location || '',
        thumbnail_url: project?.thumbnail_url || '',
        description: project?.description || '',
        category: project?.category || '',
        tags: (project?.tags as string[]) || [],
        is_featured: project?.is_featured ?? false,
        is_active: project?.is_active ?? true,
        sort_order: project?.sort_order?.toString() || '0',
    })
    const [tagInput, setTagInput] = useState('')

    const set = (key: string, value: any) => setForm(p => ({ ...p, [key]: value }))

    const addTag = () => {
        const t = tagInput.trim()
        if (t && !form.tags.includes(t)) {
            set('tags', [...form.tags, t])
        }
        setTagInput('')
    }

    const removeTag = (tag: string) => set('tags', form.tags.filter(t => t !== tag))

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            const payload = { ...form, sort_order: parseInt(form.sort_order) || 0 }
            const result = isEdit
                ? await updateProject(project.id, payload)
                : await createProject(payload)
            if (result?.errors || result?.message) {
                toast.error(result.message || 'Vui lòng kiểm tra lại dữ liệu')
            } else {
                toast.success(isEdit ? 'Đã cập nhật dự án' : 'Đã thêm dự án')
                router.push('/admin/du-an')
            }
        })
    }

    const inputCls = "w-full h-10 px-3 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white"
    const labelCls = "block text-sm font-medium text-[#3C4E56] mb-1.5"

    return (
        <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
            <div className="bg-white rounded-2xl border border-[#E4EEF2] p-6 space-y-5">
                <div>
                    <label className={labelCls}>Tên dự án *</label>
                    <input required className={inputCls} value={form.title}
                        onChange={e => set('title', e.target.value)} placeholder="Tên dự án..." />
                </div>
                <div>
                    <ImageUploader label="Ảnh dự án *" value={form.thumbnail_url}
                        onChange={v => set('thumbnail_url', v as string)} folder="projects" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Vị trí / Địa điểm</label>
                        <input className={inputCls} value={form.location}
                            onChange={e => set('location', e.target.value)} placeholder="VD: Đà Lạt, Lâm Đồng" />
                    </div>
                    <div>
                        <label className={labelCls}>Danh mục</label>
                        <select className={inputCls} value={form.category} onChange={e => set('category', e.target.value)}>
                            <option value="">-- Chọn danh mục --</option>
                            {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
                <div>
                    <label className={labelCls}>Mô tả ngắn</label>
                    <textarea className={`${inputCls} h-24 py-2 resize-none`} value={form.description}
                        onChange={e => set('description', e.target.value)} placeholder="Mô tả về dự án..." />
                </div>
                <div>
                    <label className={labelCls}>Tags (vật liệu sử dụng)</label>
                    <div className="flex gap-2">
                        <input className={`${inputCls} flex-1`} value={tagInput}
                            onChange={e => setTagInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                            placeholder="VD: Gạch ốp lát, Thiết bị vệ sinh..." />
                        <Button type="button" variant="outline" size="sm" onClick={addTag}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    {form.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {form.tags.map(tag => (
                                <span key={tag} className="flex items-center gap-1 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-medium">
                                    {tag}
                                    <button type="button" onClick={() => removeTag(tag)}>
                                        <X className="h-3 w-3 text-slate-400 hover:text-red-500" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <div>
                    <label className={labelCls}>Thứ tự hiển thị</label>
                    <input type="number" className={inputCls} value={form.sort_order}
                        onChange={e => set('sort_order', e.target.value)} min={0} />
                </div>
                <div className="flex gap-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.is_featured}
                            onChange={e => set('is_featured', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary" />
                        <span className="text-sm font-medium text-[#3C4E56]">Nổi bật (hiển thị homepage)</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.is_active}
                            onChange={e => set('is_active', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary" />
                        <span className="text-sm font-medium text-[#3C4E56]">Hiển thị</span>
                    </label>
                </div>
            </div>

            <div className="flex items-center gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => router.back()}>Huỷ</Button>
                <Button type="submit" disabled={isPending} className="gap-2">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isEdit ? 'Cập nhật' : 'Thêm dự án'}
                </Button>
            </div>
        </form>
    )
}
