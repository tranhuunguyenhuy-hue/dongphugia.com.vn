'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBlogPost, updateBlogPost } from '@/lib/blog-actions'
import { slugify } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImageUploader } from '@/components/ui/image-uploader'
import { RichTextEditor } from '@/components/ui/rich-text-editor'

interface BlogPostFormProps {
    post?: any
    categories: { id: number; name: string }[]
    tags: { id: number; name: string; slug: string }[]
}

export function BlogPostForm({ post, categories, tags }: BlogPostFormProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const isEdit = !!post

    const existingTagIds: number[] = post?.blog_post_tags?.map((pt: any) => pt.tag_id) ?? []

    const [form, setForm] = useState({
        title: post?.title ?? '',
        slug: post?.slug ?? '',
        excerpt: post?.excerpt ?? '',
        content: post?.content ?? '',
        category_id: post?.category_id?.toString() ?? '',
        thumbnail_url: post?.thumbnail_url ?? '',
        cover_image_url: post?.cover_image_url ?? '',
        seo_title: post?.seo_title ?? '',
        seo_description: post?.seo_description ?? '',
        seo_keywords: post?.seo_keywords ?? '',
        reading_time: post?.reading_time?.toString() ?? '',
        status: post?.status ?? 'draft',
        author_name: post?.author_name ?? 'Đông Phú Gia',
        is_featured: post?.is_featured ?? false,
        is_pinned: post?.is_pinned ?? false,
        tag_ids: existingTagIds,
    })

    const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }))

    const toggleTag = (tagId: number) => {
        setForm((prev) => ({
            ...prev,
            tag_ids: prev.tag_ids.includes(tagId)
                ? prev.tag_ids.filter((id) => id !== tagId)
                : [...prev.tag_ids, tagId],
        }))
    }

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            const payload = {
                ...form,
                category_id: parseInt(form.category_id) || 0,
                reading_time: form.reading_time ? parseInt(form.reading_time) : null,
            }
            const result = isEdit
                ? await updateBlogPost(post.id, payload)
                : await createBlogPost(payload)

            if (result?.errors || result?.message) {
                toast.error(result.message || 'Vui lòng kiểm tra lại dữ liệu')
            } else {
                toast.success(isEdit ? 'Đã cập nhật bài viết' : 'Đã tạo bài viết')
                router.push('/admin/blog/posts')
            }
        })
    }

    const inputCls = 'w-full h-10 px-3 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white'
    const labelCls = 'block text-sm font-medium text-[#3C4E56] mb-1.5'

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main content — left 2/3 */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Basic info */}
                    <div className="bg-white rounded-2xl border border-[#E4EEF2] p-6 space-y-5">
                        <h2 className="text-base font-semibold">Nội dung bài viết</h2>

                        <div>
                            <label className={labelCls}>Tiêu đề <span className="text-red-500">*</span></label>
                            <input
                                className={inputCls}
                                value={form.title}
                                onChange={(e) => {
                                    set('title', e.target.value)
                                    if (!isEdit) set('slug', slugify(e.target.value))
                                }}
                                required
                                placeholder="Tiêu đề bài viết..."
                            />
                        </div>

                        <div>
                            <label className={labelCls}>Slug <span className="text-red-500">*</span></label>
                            <input
                                className={inputCls}
                                value={form.slug}
                                onChange={(e) => set('slug', e.target.value)}
                                required
                                placeholder="slug-bai-viet"
                            />
                        </div>

                        <div>
                            <label className={labelCls}>Tóm tắt</label>
                            <textarea
                                className="w-full px-3 py-2 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-y min-h-[80px]"
                                value={form.excerpt}
                                onChange={(e) => set('excerpt', e.target.value)}
                                placeholder="Tóm tắt ngắn hiển thị trên listing..."
                            />
                        </div>

                        <div>
                            <label className={labelCls}>Nội dung</label>
                            <RichTextEditor
                                value={form.content}
                                onChange={(v) => set('content', v)}
                                placeholder="Bắt đầu viết nội dung bài..."
                            />
                        </div>
                    </div>

                    {/* SEO */}
                    <div className="bg-white rounded-2xl border border-[#E4EEF2] p-6 space-y-5">
                        <h2 className="text-base font-semibold">SEO</h2>
                        <div>
                            <label className={labelCls}>SEO Title</label>
                            <input className={inputCls} value={form.seo_title} onChange={(e) => set('seo_title', e.target.value)} placeholder="Tự động dùng tiêu đề nếu để trống" maxLength={200} />
                        </div>
                        <div>
                            <label className={labelCls}>SEO Description</label>
                            <textarea
                                className="w-full px-3 py-2 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-y min-h-[80px]"
                                value={form.seo_description}
                                onChange={(e) => set('seo_description', e.target.value)}
                                placeholder="Mô tả SEO (max 500 ký tự)"
                                maxLength={500}
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Keywords</label>
                            <input className={inputCls} value={form.seo_keywords} onChange={(e) => set('seo_keywords', e.target.value)} placeholder="gạch, toto, phòng tắm (phân cách bằng dấu phẩy)" />
                        </div>
                    </div>
                </div>

                {/* Sidebar — right 1/3 */}
                <div className="space-y-6">

                    {/* Publish settings */}
                    <div className="bg-white rounded-2xl border border-[#E4EEF2] p-5 space-y-4">
                        <h2 className="text-base font-semibold">Xuất bản</h2>
                        <div>
                            <label className={labelCls}>Trạng thái</label>
                            <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value)}>
                                <option value="draft">Nháp</option>
                                <option value="published">Đã đăng</option>
                                <option value="scheduled">Lên lịch</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Chuyên mục <span className="text-red-500">*</span></label>
                            <select className={inputCls} value={form.category_id} onChange={(e) => set('category_id', e.target.value)} required>
                                <option value="">-- Chọn chuyên mục --</option>
                                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Tác giả</label>
                            <input className={inputCls} value={form.author_name} onChange={(e) => set('author_name', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelCls}>Thời gian đọc (phút)</label>
                            <input type="number" className={inputCls} value={form.reading_time} onChange={(e) => set('reading_time', e.target.value)} min={1} max={60} placeholder="5" />
                        </div>
                        <div className="space-y-2">
                            {[
                                { key: 'is_featured', label: 'Bài viết nổi bật' },
                                { key: 'is_pinned', label: 'Ghim lên đầu' },
                            ].map(({ key, label }) => (
                                <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={(form as any)[key]}
                                        onChange={(e) => set(key, e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary"
                                    />
                                    <span className="text-sm text-[#3C4E56]">{label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Tags */}
                    {tags.length > 0 && (
                        <div className="bg-white rounded-2xl border border-[#E4EEF2] p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-base font-semibold">Tags</h2>
                                <a href="/admin/blog/tags" className="text-xs text-primary hover:underline" target="_blank">Quản lý tags</a>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {tags.map((tag) => (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        onClick={() => toggleTag(tag.id)}
                                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                            form.tag_ids.includes(tag.id)
                                                ? 'bg-primary text-white'
                                                : 'bg-muted text-muted-foreground hover:bg-accent'
                                        }`}
                                    >
                                        {tag.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Images */}
                    <div className="bg-white rounded-2xl border border-[#E4EEF2] p-5 space-y-4">
                        <h2 className="text-base font-semibold">Hình ảnh</h2>
                        <ImageUploader
                            label="Ảnh thumbnail (listing)"
                            value={form.thumbnail_url}
                            onChange={(v) => set('thumbnail_url', v as string)}
                            folder="blog"
                        />
                        <ImageUploader
                            label="Ảnh cover (banner bài viết)"
                            value={form.cover_image_url}
                            onChange={(v) => set('cover_image_url', v as string)}
                            folder="blog"
                        />
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => router.back()}>Huỷ</Button>
                <Button type="submit" disabled={isPending} className="gap-2 min-w-[120px]">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isEdit ? 'Cập nhật' : 'Lưu bài viết'}
                </Button>
            </div>
        </form>
    )
}
