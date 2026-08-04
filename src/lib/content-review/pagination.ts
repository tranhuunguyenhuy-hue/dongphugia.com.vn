/**
 * Read every source row with an id cursor. There is intentionally no maximum
 * page count: a short page is the only completion signal. A repeated or
 * descending cursor fails closed instead of silently omitting proposals.
 */
export const CONTENT_REVIEW_READ_BATCH_SIZE = 100

export async function readAllContentReviewPages<T extends { id: number }>(
    readPage: (cursor?: number) => Promise<T[]>,
): Promise<T[]> {
    const rows: T[] = []
    const seen = new Set<number>()
    let cursor: number | undefined

    while (true) {
        const batch = await readPage(cursor)
        if (batch.length === 0) break

        let previousId = cursor ?? -Infinity
        for (const row of batch) {
            if (!Number.isInteger(row.id) || row.id <= previousId || seen.has(row.id)) {
                throw new Error('Content review pagination stalled; refusing a partial read')
            }
            seen.add(row.id)
            rows.push(row)
            previousId = row.id
        }

        const nextCursor = batch[batch.length - 1].id
        if (nextCursor === cursor) throw new Error('Content review pagination cursor repeated')
        cursor = nextCursor
        if (batch.length < CONTENT_REVIEW_READ_BATCH_SIZE) break
    }

    return rows
}
