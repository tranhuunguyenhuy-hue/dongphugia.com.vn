'use client'

import { useState, useTransition } from 'react'
import { createBlogTag, deleteBlogTag } from '@/lib/blog-actions'
import { slugify } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TagItem {
    id: number
    name: string
    slug: string
    post_count: number
}

export function TagsClient({ initialTags }: { initialTags: TagItem[] }) {
    const [tags, setTags] = useState(initialTags)
    const [name, setName] = useState('')
    const [slug, setSlug] = useState('')
    const [isPending, startTransition] = useTransition()
    const [deletingId, setDeletingId] = useState<number | null>(null)

    const handleCreate = () => {
        if (!name.trim()) return
        startTransition(async () => {
            const result = await createBlogTag({ name: name.trim(), slug: slug || slugify(name) })
            if (result?.message) {
                toast.error(result.message)
            } else if (result?.success) {
                toast.success('Đã thêm tag')
                setTags((prev) => [...prev, { id: result.id!, name: name.trim(), slug: slug || slugify(name), post_count: 0 }].sort((a, b) => a.name.localeCompare(b.name)))
                setName('')
                setSlug('')
            }
        })
    }

    const handleDelete = (id: number, tagName: string) => {
        setDeletingId(id)
        startTransition(async () => {
            const result = await deleteBlogTag(id)
            if (result?.message) {
                toast.error(result.message)
            } else {
                toast.success(`Đã xóa tag "${tagName}"`)
                setTags((prev) => prev.filter((t) => t.id !== id))
            }
            setDeletingId(null)
        })
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
            {/* Create form */}
            <div className="bg-white rounded-2xl border border-[#E4EEF2] p-6 space-y-4">
                <h2 className="text-base font-semibold">Thêm tag mới</h2>
                <div>
                    <label className="block text-sm font-medium text-[#3C4E56] mb-1.5">Tên tag</label>
                    <input
                        className="w-full h-10 px-3 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value)
                            setSlug(slugify(e.target.value))
                        }}
                        placeholder="Tên tag..."
                        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-[#3C4E56] mb-1.5">Slug</label>
                    <input
                        className="w-full h-10 px-3 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="ten-tag"
                    />
                </div>
                <Button onClick={handleCreate} disabled={isPending || !name.trim()} className="w-full gap-2">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Thêm tag
                </Button>
            </div>

            {/* Tags list */}
            <div className="bg-white rounded-2xl border border-[#E4EEF2] p-6">
                <h2 className="text-base font-semibold mb-4">Danh sách tags ({tags.length})</h2>
                {tags.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                        <Tag className="h-8 w-8 opacity-30" />
                        <p className="text-sm">Chưa có tag nào</p>
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {tags.map((tag) => (
                            <li key={tag.id} className="flex items-center justify-between py-2 border-b border-[#E4EEF2] last:border-0">
                                <div>
                                    <span className="text-sm font-medium">{tag.name}</span>
                                    <span className="text-xs text-muted-foreground ml-2">#{tag.slug}</span>
                                    {tag.post_count > 0 && (
                                        <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded-full">{tag.post_count} bài</span>
                                    )}
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDelete(tag.id, tag.name)}
                                    disabled={isPending && deletingId === tag.id}
                                >
                                    {isPending && deletingId === tag.id
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        : <Trash2 className="h-3.5 w-3.5" />
                                    }
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}
