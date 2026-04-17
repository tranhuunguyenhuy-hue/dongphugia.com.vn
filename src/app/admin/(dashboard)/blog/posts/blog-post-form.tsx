'use client'

import { useState, useTransition, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBlogPost, updateBlogPost } from '@/lib/blog-actions'
import { slugify } from '@/lib/utils'
import { toast } from 'sonner'
import {
    Loader2, Save, ChevronDown, ChevronUp, Eye, Sparkles,
    Clock, BookOpen, ExternalLink, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImageUploader } from '@/components/ui/image-uploader'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import Image from 'next/image'

interface BlogPostFormProps {
    post?: any
    categories: { id: number; name: string }[]
    tags: { id: number; name: string; slug: string }[]
}

// Calculate estimated reading time from HTML content
function calcReadingTime(html: string): number {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const words = text.split(' ').filter(Boolean).length
    return Math.max(1, Math.ceil(words / 200)) // avg 200 wpm Vietnamese
}

// Count visible characters in textarea
function CharCount({ value, max, warn = 0.85 }: { value: string; max: number; warn?: number }) {
    const len = value.length
    const pct = len / max
    const color = pct >= 1 ? 'text-red-500' : pct >= warn ? 'text-amber-500' : 'text-muted-foreground'
    return (
        <span className={`text-xs ${color} mt-1 block text-right`}>
            {len}/{max}
        </span>
    )
}

// SEO Preview Card
function SeoPreview({ title, description, slug }: { title: string; description: string; slug: string }) {
    const displayTitle = title || 'Tiêu đề bài viết'
    const displayDesc = description || 'Mô tả SEO sẽ hiển thị tại đây...'
    const displayUrl = `dongphugia.com.vn/blog/.../${slug || 'slug-bai-viet'}`

    return (
        <div className="rounded-xl border border-[#E4EEF2] bg-white p-4 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" /> Xem trước Google
            </p>
            <p className="text-xs text-green-700 truncate">{displayUrl}</p>
            <p className="text-[15px] font-medium text-blue-700 leading-snug line-clamp-2 hover:underline cursor-pointer">
                {displayTitle.length > 60 ? displayTitle.slice(0, 60) + '...' : displayTitle}
            </p>
            <p className="text-xs text-[#545454] line-clamp-2 leading-relaxed">
                {displayDesc.length > 160 ? displayDesc.slice(0, 160) + '...' : displayDesc}
            </p>
        </div>
    )
}

export function BlogPostForm({ post, categories, tags }: BlogPostFormProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const isEdit = !!post
    const [showSlug, setShowSlug] = useState(false) // slug hidden by default for marketing
    const [showSeoPreview, setShowSeoPreview] = useState(false)

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

    // Auto-update reading time when content changes
    useEffect(() => {
        if (form.content) {
            const rt = calcReadingTime(form.content)
            setForm((prev) => ({ ...prev, reading_time: rt.toString() }))
        }
    }, [form.content])

    const toggleTag = (tagId: number) => {
        setForm((prev) => ({
            ...prev,
            tag_ids: prev.tag_ids.includes(tagId)
                ? prev.tag_ids.filter((id) => id !== tagId)
                : [...prev.tag_ids, tagId],
        }))
    }

    // Auto-fill SEO from title + excerpt
    const autoFillSeo = useCallback(() => {
        setForm((prev) => ({
            ...prev,
            seo_title: prev.title.slice(0, 70),
            seo_description: prev.excerpt.slice(0, 160) || prev.title,
        }))
        toast.success('Đã tự động điền SEO từ tiêu đề & tóm tắt')
    }, [])

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

    // Word count in content
    const wordCount = form.content
        ? form.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length
        : 0
    const estReadingTime = form.reading_time || calcReadingTime(form.content).toString()

    return (
        <form onSubmit={onSubmit} className="space-y-6 pb-24">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ─── Main content — left 2/3 ─── */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Basic info card */}
                    <div className="bg-white rounded-2xl border border-[#E4EEF2] p-6 space-y-5">
                        <h2 className="text-base font-semibold flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-primary" />
                            Nội dung bài viết
                        </h2>

                        {/* Title */}
                        <div>
                            <label className={labelCls}>
                                Tiêu đề bài viết <span className="text-red-500">*</span>
                            </label>
                            <input
                                className={inputCls}
                                value={form.title}
                                onChange={(e) => {
                                    set('title', e.target.value)
                                    if (!isEdit) set('slug', slugify(e.target.value))
                                }}
                                required
                                placeholder="VD: Top 5 xu hướng gạch ốp lát 2026 đẹp nhất"
                            />
                            <CharCount value={form.title} max={100} warn={0.7} />
                        </div>

                        {/* Excerpt */}
                        <div>
                            <label className={labelCls}>Tóm tắt</label>
                            <textarea
                                className="w-full px-3 py-2 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-y min-h-[80px]"
                                value={form.excerpt}
                                onChange={(e) => set('excerpt', e.target.value)}
                                placeholder="Tóm tắt 1-2 câu hiển thị trên trang listing và Google Search. Nên từ 120-160 ký tự."
                                maxLength={300}
                            />
                            <CharCount value={form.excerpt} max={300} warn={0.53} />
                        </div>

                        {/* Slug — collapsed by default */}
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowSlug((v) => !v)}
                                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showSlug ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                Slug URL (nâng cao)
                            </button>
                            {showSlug && (
                                <div className="mt-2">
                                    <input
                                        className={inputCls + ' font-mono text-xs'}
                                        value={form.slug}
                                        onChange={(e) => set('slug', e.target.value)}
                                        required
                                        placeholder="slug-bai-viet"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Tự động tạo từ tiêu đề. Chỉ chỉnh nếu thực sự cần.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Content editor */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className={labelCls + ' !mb-0'}>Nội dung</label>
                                {wordCount > 0 && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {wordCount} từ · {estReadingTime} phút đọc
                                    </span>
                                )}
                            </div>
                            <RichTextEditor
                                value={form.content}
                                onChange={(v) => set('content', v)}
                                placeholder="Bắt đầu viết nội dung bài... Dùng toolbar để thêm ảnh, tiêu đề, danh sách."
                            />
                        </div>
                    </div>

                    {/* SEO card */}
                    <div className="bg-white rounded-2xl border border-[#E4EEF2] p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-semibold">SEO</h2>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={autoFillSeo}
                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
                                >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Tự điền từ tiêu đề
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowSeoPreview((v) => !v)}
                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#E4EEF2] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                >
                                    <Eye className="h-3.5 w-3.5" />
                                    Xem trước
                                </button>
                            </div>
                        </div>

                        {/* SEO Preview */}
                        {showSeoPreview && (
                            <SeoPreview
                                title={form.seo_title || form.title}
                                description={form.seo_description || form.excerpt}
                                slug={form.slug}
                            />
                        )}

                        <div>
                            <label className={labelCls}>
                                SEO Title
                                <span className="ml-1.5 text-xs font-normal text-muted-foreground">(nếu để trống sẽ dùng tiêu đề)</span>
                            </label>
                            <input
                                className={inputCls}
                                value={form.seo_title}
                                onChange={(e) => set('seo_title', e.target.value)}
                                placeholder="Tiêu đề hiển thị trên Google (dưới 60 ký tự tốt nhất)"
                                maxLength={120}
                            />
                            <CharCount value={form.seo_title} max={60} />
                        </div>
                        <div>
                            <label className={labelCls}>SEO Description</label>
                            <textarea
                                className="w-full px-3 py-2 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-y min-h-[80px]"
                                value={form.seo_description}
                                onChange={(e) => set('seo_description', e.target.value)}
                                placeholder="Mô tả hiển thị trên Google (120-160 ký tự)"
                                maxLength={500}
                            />
                            <CharCount value={form.seo_description} max={160} />
                        </div>
                        <div>
                            <label className={labelCls}>Keywords</label>
                            <input
                                className={inputCls}
                                value={form.seo_keywords}
                                onChange={(e) => set('seo_keywords', e.target.value)}
                                placeholder="gạch, toto, phòng tắm (phân cách bằng dấu phẩy)"
                            />
                        </div>
                    </div>
                </div>

                {/* ─── Sidebar — right 1/3 ─── */}
                <div className="space-y-5">

                    {/* Publish settings */}
                    <div className="bg-white rounded-2xl border border-[#E4EEF2] p-5 space-y-4">
                        <h2 className="text-base font-semibold">Xuất bản</h2>

                        {/* Status with color indicator */}
                        <div>
                            <label className={labelCls}>Trạng thái</label>
                            <div className="relative">
                                <select
                                    className={inputCls + ' pr-8'}
                                    value={form.status}
                                    onChange={(e) => set('status', e.target.value)}
                                >
                                    <option value="draft">📝 Nháp</option>
                                    <option value="published">✅ Đã đăng</option>
                                    <option value="scheduled">🕐 Lên lịch</option>
                                </select>
                            </div>
                            {form.status === 'draft' && (
                                <p className="text-xs text-amber-600 mt-1">Bài này chưa hiển thị trên website.</p>
                            )}
                            {form.status === 'published' && (
                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Bài viết đang live trên website.
                                </p>
                            )}
                        </div>

                        <div>
                            <label className={labelCls}>Chuyên mục <span className="text-red-500">*</span></label>
                            <select
                                className={inputCls}
                                value={form.category_id}
                                onChange={(e) => set('category_id', e.target.value)}
                                required
                            >
                                <option value="">-- Chọn chuyên mục --</option>
                                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className={labelCls}>Tác giả</label>
                            <input className={inputCls} value={form.author_name} onChange={(e) => set('author_name', e.target.value)} />
                        </div>

                        {/* Reading time — auto calculated, read-only like */}
                        <div>
                            <label className={labelCls + ' flex items-center gap-1.5'}>
                                <Clock className="h-3.5 w-3.5" />
                                Thời gian đọc
                                <span className="text-xs font-normal text-green-600">(tự tính)</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    className={inputCls}
                                    value={form.reading_time}
                                    onChange={(e) => set('reading_time', e.target.value)}
                                    min={1} max={60}
                                    placeholder="5"
                                />
                                <span className="text-sm text-muted-foreground shrink-0">phút</span>
                            </div>
                        </div>

                        <div className="space-y-3 pt-1">
                            {[
                                { key: 'is_featured', label: '⭐ Bài viết nổi bật', desc: 'Hiển thị ở trang chủ' },
                                { key: 'is_pinned', label: '📌 Ghim lên đầu', desc: 'Luôn hiện đầu danh sách' },
                            ].map(({ key, label, desc }) => (
                                <label key={key} className="flex items-start gap-2.5 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={(form as any)[key]}
                                        onChange={(e) => set(key, e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary mt-0.5"
                                    />
                                    <div>
                                        <span className="text-sm text-[#3C4E56] font-medium">{label}</span>
                                        <p className="text-xs text-muted-foreground">{desc}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Tags */}
                    {tags.length > 0 && (
                        <div className="bg-white rounded-2xl border border-[#E4EEF2] p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-base font-semibold">Tags</h2>
                                <a href="/admin/blog/tags" className="text-xs text-primary hover:underline" target="_blank">
                                    + Thêm tag
                                </a>
                            </div>
                            {form.tag_ids.length > 0 && (
                                <p className="text-xs text-primary font-medium">
                                    Đã chọn: {form.tag_ids.length} tag
                                </p>
                            )}
                            <div className="flex flex-wrap gap-2">
                                {tags.map((tag) => (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        onClick={() => toggleTag(tag.id)}
                                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${form.tag_ids.includes(tag.id)
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                            }`}
                                    >
                                        {form.tag_ids.includes(tag.id) ? '✓ ' : ''}{tag.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Images */}
                    <div className="bg-white rounded-2xl border border-[#E4EEF2] p-5 space-y-5">
                        <h2 className="text-base font-semibold">Hình ảnh</h2>

                        {/* Thumbnail */}
                        <div>
                            <ImageUploader
                                label="Ảnh thumbnail"
                                value={form.thumbnail_url}
                                onChange={(v) => set('thumbnail_url', v as string)}
                                folder="blog"
                            />
                            {form.thumbnail_url && (
                                <div className="mt-2 rounded-lg overflow-hidden border border-[#E4EEF2] aspect-[16/9] relative bg-muted">
                                    <Image src={form.thumbnail_url} alt="thumbnail" fill className="object-cover" unoptimized />
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1.5">
                                Hiển thị ở listing blog. Tỉ lệ 16:9 tốt nhất. (VD: 1200×675px)
                            </p>
                        </div>

                        {/* Cover */}
                        <div>
                            <ImageUploader
                                label="Ảnh cover (banner bài viết)"
                                value={form.cover_image_url}
                                onChange={(v) => set('cover_image_url', v as string)}
                                folder="blog"
                            />
                            {form.cover_image_url && (
                                <div className="mt-2 rounded-lg overflow-hidden border border-[#E4EEF2] aspect-[21/9] relative bg-muted">
                                    <Image src={form.cover_image_url} alt="cover" fill className="object-cover" unoptimized />
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1.5">
                                Banner đầu trang chi tiết. Tỉ lệ 21:9, nằm ngang rộng. (VD: 1920×823px)
                            </p>
                        </div>
                    </div>

                    {/* Preview link if editing published post */}
                    {isEdit && post?.status === 'published' && post?.slug && (
                        <a
                            href={`/blog/${post?.blog_categories?.slug ?? ''}/${post.slug}`}
                            target="_blank"
                            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[#E4EEF2] text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        >
                            <ExternalLink className="h-4 w-4" />
                            Xem bài viết trên website
                        </a>
                    )}
                </div>
            </div>

            {/* ─── Sticky save bar ─── */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-t border-[#E4EEF2] px-6 py-3 flex items-center justify-between shadow-lg">
                <div className="text-sm text-muted-foreground">
                    {wordCount > 0
                        ? <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{wordCount} từ · ~{estReadingTime} phút đọc</span>
                        : <span>Chưa có nội dung</span>
                    }
                </div>
                <div className="flex items-center gap-3">
                    {/* Quick draft save */}
                    {form.status !== 'draft' && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isPending}
                            onClick={() => {
                                set('status', 'draft')
                                setTimeout(() => document.querySelector('form')?.requestSubmit(), 100)
                            }}
                        >
                            Lưu nháp
                        </Button>
                    )}
                    <Button type="button" variant="outline" onClick={() => router.back()}>Huỷ</Button>
                    <Button type="submit" disabled={isPending} className="gap-2 min-w-[140px]">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {form.status === 'published' ? '✅ Đăng bài viết' : isEdit ? 'Cập nhật' : 'Lưu bài viết'}
                    </Button>
                </div>
            </div>
        </form>
    )
}
