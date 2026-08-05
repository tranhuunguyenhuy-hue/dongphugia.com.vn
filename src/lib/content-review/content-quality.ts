import * as cheerio from 'cheerio'

export interface EditorialQualityMetrics {
    beforeCharacters: number
    afterCharacters: number
    ratio: number
    paragraphCount: number
    buyerBenefitSignals: number
    technicalTableDump: boolean
    repeatedOpeningKey: string
    shortSourceException: boolean
    editorialReview: 'PASS' | 'HUMAN_REVIEW'
    editorialReviewReason: string | null
    flags: string[]
}

const BUYER_BENEFIT_SIGNALS = [
    'giúp', 'phù hợp', 'tiện', 'dễ', 'hỗ trợ', 'lựa chọn', 'lắp đặt', 'sử dụng',
    'vệ sinh', 'đối chiếu', 'cân nhắc', 'kiểm tra', 'bảo quản', 'bảo trì',
]

function visibleText(html: string): string {
    return cheerio.load(html || '', {}, false).text().replace(/\s+/g, ' ').trim()
}

function openingKey(html: string): string {
    const firstParagraph = cheerio.load(html || '', {}, false)('p').first().text().replace(/\s+/g, ' ').trim()
    return firstParagraph.slice(0, 100).toLocaleLowerCase()
}

export function getEditorialQualityMetrics(beforeHtml: string, afterHtml: string): EditorialQualityMetrics {
    const beforeText = visibleText(beforeHtml)
    const afterText = visibleText(afterHtml)
    const lowerAfter = afterText.toLocaleLowerCase()
    const ratio = beforeText.length ? afterText.length / beforeText.length : 0
    const paragraphCount = cheerio.load(afterHtml || '', {}, false)('p').length
    const buyerBenefitSignals = BUYER_BENEFIT_SIGNALS.filter(signal => lowerAfter.includes(signal)).length
    const technicalTableDump = cheerio.load(afterHtml || '', {}, false)('table').length > 0
        || (cheerio.load(afterHtml || '', {}, false)('ul').length > 0 && paragraphCount < 3)
    const flags: string[] = []
    const shortSourceException = beforeText.length < 260
    if (ratio < 0.7 || ratio > 1.2) flags.push(`length_ratio_out_of_range:${ratio.toFixed(3)}`)
    if (paragraphCount < 3) flags.push(`too_few_narrative_paragraphs:${paragraphCount}`)
    if (buyerBenefitSignals < 2) flags.push(`too_few_buyer_benefit_signals:${buyerBenefitSignals}`)
    if (technicalTableDump) flags.push('technical_table_dump')
    if (!lowerAfter.includes('chính hãng')) flags.push('missing_chinh_hang')
    const editorialReview = flags.length === 0
        ? 'PASS'
        : shortSourceException && flags.every(flag => flag.startsWith('length_ratio_out_of_range'))
            ? 'HUMAN_REVIEW'
            : 'HUMAN_REVIEW'
    const editorialReviewReason = editorialReview === 'PASS'
        ? null
        : shortSourceException && flags.every(flag => flag.startsWith('length_ratio_out_of_range'))
            ? `Sparse Before source (${beforeText.length} normalized characters) requires human review of the shorter editorial rewrite.`
            : flags.join(', ')
    return {
        beforeCharacters: beforeText.length,
        afterCharacters: afterText.length,
        ratio,
        paragraphCount,
        buyerBenefitSignals,
        technicalTableDump,
        repeatedOpeningKey: openingKey(afterHtml),
        shortSourceException,
        editorialReview,
        editorialReviewReason,
        flags,
    }
}

export function assertEditorialQuality(beforeHtml: string, afterHtml: string, productId: number | string): EditorialQualityMetrics {
    const metrics = getEditorialQualityMetrics(beforeHtml, afterHtml)
    const permittedShortSourceReview = metrics.shortSourceException
        && metrics.flags.length > 0
        && metrics.flags.every(flag => flag.startsWith('length_ratio_out_of_range'))
    if (metrics.flags.length > 0 && !permittedShortSourceReview) {
        throw new Error(`Editorial quality failed for product ${productId}: ${metrics.flags.join(', ')}`)
    }
    return metrics
}
