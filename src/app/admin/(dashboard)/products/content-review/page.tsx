import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getContentReviewQueue } from '@/lib/content-review/queries'
import type { ReviewState } from '@/lib/content-review/types'

export const dynamic = 'force-dynamic'

const STATES: Array<{ value: ReviewState | ''; label: string }> = [
    { value: '', label: 'Tất cả' },
    { value: 'draft', label: 'Draft' },
    { value: 'needs_review', label: 'Cần duyệt' },
    { value: 'approved', label: 'Đã duyệt' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'ready_to_apply', label: 'Ready' },
]

function stateClass(state: ReviewState) {
    if (state === 'approved' || state === 'ready_to_apply') return 'bg-emerald-100 text-emerald-800'
    if (state === 'blocked' || state === 'rejected') return 'bg-red-100 text-red-800'
    if (state === 'needs_review') return 'bg-amber-100 text-amber-800'
    return 'bg-slate-100 text-slate-700'
}

export default async function ContentReviewPage({
    searchParams,
}: {
    searchParams: Promise<{ state?: string; search?: string; page?: string; pageSize?: string }>
}) {
    const params = await searchParams
    const selectedState = STATES.some(item => item.value === params.state)
        ? (params.state || undefined) as ReviewState | undefined
        : undefined
    const queue = await getContentReviewQueue({
        state: selectedState,
        search: params.search,
        page: Number(params.page || 1),
        pageSize: Number(params.pageSize || 50),
    })

    function pageHref(page: number) {
        const query = new URLSearchParams()
        if (params.search) query.set('search', params.search)
        if (selectedState) query.set('state', selectedState)
        query.set('page', String(page))
        query.set('pageSize', String(queue.pageSize))
        return `/admin/products/content-review?${query.toString()}`
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <Link href="/admin/products" className="hover:text-slate-700">Sản phẩm</Link>
                    <span>/</span>
                    <span>Review Console</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Duyệt đề xuất nội dung</h1>
                <p className="max-w-3xl text-sm text-slate-500">
                    Queue source-only <code>hita_cleanup_v1</code>. Duyệt tại đây chỉ thay đổi proposal;
                    không cập nhật mô tả hoặc ảnh đang public.
                </p>
            </div>

            <form className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row" method="get">
                <Input name="search" defaultValue={params.search} placeholder="Tìm SKU hoặc tên sản phẩm" />
                <select
                    name="state"
                    defaultValue={selectedState || ''}
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                    {STATES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <Button type="submit">Lọc queue</Button>
            </form>

            <div className="overflow-hidden rounded-xl border bg-white">
                <div className="grid grid-cols-[minmax(0,1fr)_120px_110px_120px] gap-4 border-b bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span>Sản phẩm</span>
                    <span>Trạng thái</span>
                    <span>Ảnh</span>
                    <span>Cập nhật</span>
                </div>
                {queue.items.length === 0 ? (
                    <div className="px-5 py-14 text-center text-sm text-slate-500">
                        Chưa có proposal phù hợp. Generator mặc định dry-run và không tự ghi dữ liệu.
                    </div>
                ) : queue.items.map(item => (
                    <Link
                        key={item.id}
                        href={`/admin/products/content-review/${item.id}`}
                        className="grid grid-cols-[minmax(0,1fr)_120px_110px_120px] gap-4 border-b px-5 py-4 text-sm transition-colors last:border-0 hover:bg-slate-50"
                    >
                        <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-900">{item.name}</div>
                            <div className="mt-1 flex gap-2 text-xs text-slate-500">
                                <span>{item.sku}</span>
                                <span>v{item.version}</span>
                                <span title={item.proposalHash}>{item.proposalHash.slice(0, 10)}</span>
                            </div>
                        </div>
                        <div>
                            <Badge className={stateClass(item.state)}>{item.paused ? 'paused' : item.state}</Badge>
                        </div>
                        <div className="text-xs text-slate-600">
                            <div>{item.totalImages} tổng</div>
                            <div className={item.pendingImages ? 'text-amber-700' : 'text-emerald-700'}>
                                {item.pendingImages} chờ duyệt
                            </div>
                            {item.duplicateProducts > 1 && <div>{item.duplicateProducts} SP trùng</div>}
                        </div>
                        <time className="text-xs text-slate-500" dateTime={item.updatedAt}>
                            {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.updatedAt))}
                        </time>
                    </Link>
                ))}
            </div>
            <div className="flex flex-col justify-between gap-3 text-sm text-slate-500 sm:flex-row sm:items-center">
                <span>
                    {queue.total === 0
                        ? '0 proposal'
                        : `Đang xem ${(queue.page - 1) * queue.pageSize + 1}–${Math.min(queue.page * queue.pageSize, queue.total)} / ${queue.total} proposal`}
                </span>
                <div className="flex items-center gap-2">
                    {queue.page > 1
                        ? <Link className="rounded-md border px-3 py-1.5 hover:bg-white" href={pageHref(queue.page - 1)}>← Trước</Link>
                        : <span className="rounded-md border px-3 py-1.5 text-slate-300">← Trước</span>}
                    <span>Trang {queue.page} / {queue.totalPages}</span>
                    {queue.page < queue.totalPages
                        ? <Link className="rounded-md border px-3 py-1.5 hover:bg-white" href={pageHref(queue.page + 1)}>Sau →</Link>
                        : <span className="rounded-md border px-3 py-1.5 text-slate-300">Sau →</span>}
                </div>
            </div>
        </div>
    )
}
