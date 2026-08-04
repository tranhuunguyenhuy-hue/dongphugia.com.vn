'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    saveProposalDescription,
    setProposalImageDecision,
    transitionContentReview,
    type ContentReviewActionResult,
} from '@/lib/content-review/actions'
import type {
    ReviewImage,
    ReviewImageDecision,
    ReviewTransition,
    SerializedReviewDetail,
} from '@/lib/content-review/types'

function DiffView({ before, after }: { before: string; after: string }) {
    const beforeLines = before.replace(/></g, '>\n<').split('\n')
    const afterLines = after.replace(/></g, '>\n<').split('\n')
    const length = Math.max(beforeLines.length, afterLines.length)
    return (
        <div className="grid gap-px overflow-hidden rounded-lg border bg-slate-200 lg:grid-cols-2">
            <div className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">Before</div>
            <div className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">After</div>
            {Array.from({ length }, (_, index) => {
                const left = beforeLines[index] || ''
                const right = afterLines[index] || ''
                const changed = left !== right
                return [
                    <pre key={`l-${index}`} className={`overflow-x-auto whitespace-pre-wrap px-3 py-1 text-xs ${changed ? 'bg-red-50 text-red-800' : 'bg-white text-slate-600'}`}>{left || ' '}</pre>,
                    <pre key={`r-${index}`} className={`overflow-x-auto whitespace-pre-wrap px-3 py-1 text-xs ${changed ? 'bg-emerald-50 text-emerald-800' : 'bg-white text-slate-600'}`}>{right || ' '}</pre>,
                ]
            })}
        </div>
    )
}

function ImageDecisionRow({
    image,
    decisionId,
    impactedProducts,
    canMutate,
    paused,
    onResult,
}: {
    image: ReviewImage
    decisionId: number
    impactedProducts: number[]
    canMutate: boolean
    paused: boolean
    onResult: (result: ContentReviewActionResult) => void
}) {
    const [decision, setDecision] = useState<ReviewImageDecision>(image.decision)
    const [reason, setReason] = useState('PM image review')
    const [replacement, setReplacement] = useState(image.replacementUrl || '')
    const [pending, startTransition] = useTransition()
    const choices: ReviewImageDecision[] = image.policy === 'KEEP_EXISTING_BUNNY'
        ? ['KEEP', 'REMOVE', 'REPLACE']
        : ['HUMAN_REVIEW', 'REMOVE', 'REPLACE']

    return (
        <div className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{image.kind}</Badge>
                <Badge className={image.policy === 'KEEP_EXISTING_BUNNY' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                    {image.policy}
                </Badge>
                <code className="text-xs text-slate-400">{image.fingerprint.slice(0, 12)}</code>
            </div>
            <p className="break-all rounded bg-slate-50 p-2 text-xs text-slate-600">{image.normalizedUrl}</p>
            <p className="text-xs text-slate-500">
                Hash dùng chung trên {impactedProducts.length} sản phẩm: {impactedProducts.join(', ') || 'chỉ sản phẩm này'}.
                Console không tải/hotlink ảnh nguồn.
            </p>
            {canMutate && !paused && (
                <div className="grid gap-2 md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <select value={decision} onChange={event => setDecision(event.target.value as ReviewImageDecision)} className="h-9 rounded-md border px-2 text-sm">
                        {choices.map(choice => <option key={choice}>{choice}</option>)}
                    </select>
                    <Input value={reason} onChange={event => setReason(event.target.value)} placeholder="Lý do audit" />
                    <Input
                        value={replacement}
                        onChange={event => setReplacement(event.target.value)}
                        placeholder="Existing Bunny URL nếu REPLACE"
                        disabled={decision !== 'REPLACE'}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        disabled={pending}
                        onClick={() => startTransition(async () => onResult(await setProposalImageDecision(
                            decisionId,
                            image.fingerprint,
                            decision,
                            reason,
                            replacement,
                        )))}
                    >Lưu ảnh</Button>
                </div>
            )}
        </div>
    )
}

export function ContentReviewConsole({ detail, canMutate }: { detail: SerializedReviewDetail; canMutate: boolean }) {
    const router = useRouter()
    const [tab, setTab] = useState<'before' | 'after' | 'diff' | 'preview'>('diff')
    const [description, setDescription] = useState(detail.proposal.after.descriptionHtml)
    const [editReason, setEditReason] = useState('PM description edit')
    const [transitionReason, setTransitionReason] = useState('PM review decision')
    const [message, setMessage] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()
    const paused = detail.proposal.workflow.paused

    function handleResult(result: ContentReviewActionResult) {
        setMessage(result.success ? 'Đã lưu proposal. Public product không thay đổi.' : result.error)
        if (result.success) router.refresh()
    }

    function runTransition(transition: ReviewTransition) {
        startTransition(async () => handleResult(await transitionContentReview(detail.decisionId, transition, transitionReason)))
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold text-slate-900">{detail.proposal.product.name}</h1>
                        <Badge>{detail.proposal.product.sku}</Badge>
                        <Badge variant="outline">{detail.proposal.source}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                        Proposal v{detail.proposal.version} · {detail.proposal.proposalHash} · state {detail.state}
                    </p>
                    {detail.proposal.workflow.paused && <p className="mt-2 text-sm font-medium text-amber-700">Paused: {detail.proposal.workflow.pauseReason}</p>}
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
                    Review-only: actions cannot write products, product_images or product_descriptions.
                </div>
            </div>

            <section className="rounded-xl border bg-white p-5">
                <div className="mb-4 flex flex-wrap gap-2">
                    {(['before', 'after', 'diff', 'preview'] as const).map(value => (
                        <Button key={value} type="button" size="sm" variant={tab === value ? 'default' : 'outline'} onClick={() => setTab(value)}>
                            {value[0].toUpperCase() + value.slice(1)}
                        </Button>
                    ))}
                </div>
                {tab === 'before' && <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{detail.proposal.before.descriptionHtml}</pre>}
                {tab === 'after' && <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{detail.proposal.after.descriptionHtml}</pre>}
                {tab === 'diff' && <DiffView before={detail.proposal.before.descriptionHtml} after={detail.proposal.after.descriptionHtml} />}
                {tab === 'preview' && (
                    <div className="prose max-w-none rounded-lg border p-5" dangerouslySetInnerHTML={{ __html: detail.previewHtml }} />
                )}
            </section>

            <section className="space-y-3 rounded-xl border bg-white p-5">
                <h2 className="font-semibold text-slate-900">Chỉnh proposal mô tả</h2>
                <Textarea value={description} onChange={event => setDescription(event.target.value)} className="min-h-56 font-mono text-xs" disabled={!canMutate || paused} />
                {canMutate && !paused && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Input value={editReason} onChange={event => setEditReason(event.target.value)} placeholder="Lý do audit" />
                        <Button
                            type="button"
                            disabled={pending}
                            onClick={() => startTransition(async () => handleResult(await saveProposalDescription(detail.decisionId, description, editReason)))}
                        >Lưu proposal</Button>
                    </div>
                )}
                <p className="text-xs text-slate-500">Mỗi edit tăng version, tạo hash mới và invalidates approval cũ về needs_review.</p>
            </section>

            <section className="space-y-3 rounded-xl border bg-white p-5">
                <div>
                    <h2 className="font-semibold text-slate-900">Quyết định từng ảnh</h2>
                    <p className="text-xs text-slate-500">Bunny hiện có mặc định KEEP; mọi Hita-hosted asset mặc định HUMAN_REVIEW.</p>
                </div>
                {detail.proposal.after.images.length === 0
                    ? <p className="text-sm text-slate-500">Không có ảnh trong proposal.</p>
                    : detail.proposal.after.images.map((image, index) => (
                        <ImageDecisionRow
                            key={`${image.kind}-${image.fingerprint}-${index}`}
                            image={image}
                            decisionId={detail.decisionId}
                            impactedProducts={detail.duplicateProductIdsByFingerprint[image.fingerprint] || []}
                            canMutate={canMutate}
                            paused={paused}
                            onResult={handleResult}
                        />
                    ))}
            </section>

            <section className="space-y-3 rounded-xl border bg-white p-5">
                <h2 className="font-semibold text-slate-900">Review decision</h2>
                {!canMutate ? (
                    <p className="text-sm text-slate-500">Bạn có quyền đọc queue; chỉ role admin được approve/block/reject.</p>
                ) : paused ? (
                    <div className="space-y-3">
                        <p className="text-sm font-medium text-amber-700">Proposal đang Pause. Resume là action duy nhất được phép trước khi tiếp tục review hoặc edit.</p>
                        <Input value={transitionReason} onChange={event => setTransitionReason(event.target.value)} placeholder="Lý do bắt buộc cho audit" />
                        <Button disabled={pending} onClick={() => runTransition('resume')}>Resume</Button>
                    </div>
                ) : (
                    <>
                        <Input value={transitionReason} onChange={event => setTransitionReason(event.target.value)} placeholder="Lý do bắt buộc cho audit" />
                        <div className="flex flex-wrap gap-2">
                            {detail.state === 'draft' && <Button disabled={pending} onClick={() => runTransition('submit')}>Gửi duyệt</Button>}
                            {detail.state === 'needs_review' && <Button disabled={pending} onClick={() => runTransition('approve')}>Approve</Button>}
                            {detail.state === 'approved' && <Button disabled={pending} onClick={() => runTransition('ready')}>Mark ready_to_apply</Button>}
                            {['draft', 'needs_review', 'approved'].includes(detail.state) && (
                                <>
                                    <Button variant="outline" disabled={pending} onClick={() => runTransition('pause')}>Pause</Button>
                                    <Button variant="outline" disabled={pending} onClick={() => runTransition('block')}>Block</Button>
                                    <Button variant="destructive" disabled={pending} onClick={() => runTransition('reject')}>Reject</Button>
                                </>
                            )}
                        </div>
                    </>
                )}
                {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
            </section>
        </div>
    )
}
