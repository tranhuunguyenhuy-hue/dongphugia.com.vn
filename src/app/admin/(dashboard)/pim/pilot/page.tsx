import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/admin/page-header'
import { getPimPilotParityReport } from '@/lib/pim-actions'

export const dynamic = 'force-dynamic'

export default async function PimPilotPage({ searchParams }: { searchParams: Promise<{ take?: string; category_id?: string }> }) {
    const params = await searchParams
    const take = Math.min(Math.max(Number(params.take) || 100, 1), 500)
    const categoryId = params.category_id ? Number(params.category_id) : undefined
    const result = await getPimPilotParityReport({ take, ...(categoryId && Number.isInteger(categoryId) ? { category_id: categoryId } : {}) })
    if (!result.success || !result.report) return <p className="text-sm text-destructive">Không thể tạo pilot report.</p>
    const { report } = result
    return <div className="space-y-6">
        <PageHeader title="PIM Pilot parity" description="Read-only cohort report; không import, backfill hoặc thay đổi dữ liệu." />
        <form className="flex flex-wrap items-end gap-3" method="get"><label className="grid gap-1 text-sm"><span className="text-muted-foreground">Cohort size</span><input className="h-10 w-28 rounded-md border px-3" name="take" type="number" min="1" max="500" defaultValue={take} /></label><label className="grid gap-1 text-sm"><span className="text-muted-foreground">Category ID (optional)</span><input className="h-10 w-36 rounded-md border px-3" name="category_id" type="number" min="1" defaultValue={categoryId ?? ''} /></label><button className="h-10 rounded-md border px-4 text-sm" type="submit">Chạy report</button></form>
        <div className="grid gap-4 md:grid-cols-4">
            <Metric title="Cohort" value={report.total} />
            <Metric title="Ready" value={report.ready} />
            <Metric title="Manual review" value={report.manualReview} />
            <Metric title="Reasons" value={Object.keys(report.reasonCounts).length} />
        </div>
        <Card><CardHeader><CardTitle className="text-base">Review reasons</CardTitle></CardHeader><CardContent><div className="divide-y text-sm">{Object.entries(report.reasonCounts).map(([reason, count]) => <div key={reason} className="flex justify-between py-2"><span>{reason}</span><strong>{count}</strong></div>)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Manual review queue (read-only)</CardTitle></CardHeader><CardContent><div className="divide-y text-sm">{report.results.filter((item) => item.disposition === 'manual_review').map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-3 py-2"><span>Product #{item.id}</span><span className="text-muted-foreground">{item.reasons.join(', ')}</span></div>)}{report.manualReview === 0 && <p className="text-muted-foreground">Không có Product cần review trong cohort.</p>}</div></CardContent></Card>
    </div>
}

function Metric({ title, value }: { title: string; value: number }) {
    return <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{title}</p><p className="text-2xl font-semibold">{value}</p></CardContent></Card>
}
