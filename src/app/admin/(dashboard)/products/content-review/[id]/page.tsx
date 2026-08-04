import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getContentReviewDetail } from '@/lib/content-review/queries'
import { ContentReviewConsole } from './review-console'

export const dynamic = 'force-dynamic'

export default async function ContentReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const decisionId = Number(id)
    if (!Number.isInteger(decisionId) || decisionId <= 0) notFound()
    const [detail, user] = await Promise.all([
        getContentReviewDetail(decisionId),
        getCurrentUser(),
    ])
    if (!detail || !user) notFound()

    return (
        <div className="space-y-5">
            <Link href="/admin/products/content-review" className="text-sm font-medium text-slate-500 hover:text-slate-900">
                ← Quay lại review queue
            </Link>
            <ContentReviewConsole detail={detail} canMutate={user.role === 'admin'} />
        </div>
    )
}
