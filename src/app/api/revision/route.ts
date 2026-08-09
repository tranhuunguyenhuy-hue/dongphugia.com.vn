export const dynamic = 'force-dynamic'

export async function GET() {
    const sourceRevision = process.env.DPG_SOURCE_REVISION
    const buildRunId = process.env.DPG_BUILD_RUN_ID

    if (!/^[0-9a-f]{40}$/.test(sourceRevision ?? '') || !/^\d+$/.test(buildRunId ?? '')) {
        return Response.json(
            { ok: false, error: 'revision_unavailable' },
            { status: 503, headers: { 'Cache-Control': 'no-store' } },
        )
    }

    return Response.json(
        {
            ok: true,
            sourceRevision,
            buildRunId,
            stagingPreview: process.env.DPG_STAGING_PREVIEW === 'true',
        },
        { headers: { 'Cache-Control': 'no-store' } },
    )
}
