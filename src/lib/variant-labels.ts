function normalizeText(value: string | null | undefined): string {
    return String(value || '').replace(/\s+/g, ' ').trim()
}

function normalizedSkuBase(sku: string | null | undefined): string {
    return normalizeText(sku).toUpperCase().split('/')[0]
}

function baseModelFromSku(sku: string | null | undefined): string {
    return normalizedSkuBase(sku).replace(/#.+$/, '')
}

function isApronBathVariant(name: string, sku: string): boolean {
    const normalizedSku = normalizedSkuBase(sku)
    if (/^(AT|MT)\d+/i.test(normalizedSku)) return /A$/i.test(baseModelFromSku(normalizedSku))
    return /chân yếm|co yếm|có yếm|yếm/i.test(name) || /A$/i.test(baseModelFromSku(sku))
}

function buildBathConfigLabel(name: string, sku: string): string | null {
    const normalizedName = normalizeText(name)
    const normalizedSku = normalizedSkuBase(sku)
    if (!/(bồn tắm|bon tam)/i.test(normalizedName) && !/^(AT|MT)\d+/i.test(normalizedSku)) return null

    const parts = [isApronBathVariant(normalizedName, normalizedSku) ? 'Chân yếm' : 'Bồn xây']
    if (/massage/i.test(normalizedName) || /^MT\d+/i.test(normalizedSku)) parts.push('Massage')
    return parts.join(', ')
}

function buildCs988Label(name: string, sku: string): string | null {
    const normalizedName = normalizeText(name)
    const normalizedSku = normalizedSkuBase(sku)
    if (!/^CS988/i.test(normalizedSku) && !/neorest/i.test(normalizedName)) return null
    if (/PVT/i.test(normalizedSku)) return 'Neorest DH (Thoát ngang)'
    if (/CS988VT/i.test(normalizedSku) || /T53P100VR/i.test(normalizedSku)) return 'Neorest DH (Thoát sàn)'
    return 'Neorest DH'
}

function buildWashletS2Label(name: string, sku: string): string | null {
    const normalizedName = normalizeText(name)
    if (!/washlet\s*s2/i.test(normalizedName)) return null

    const label = 'Washlet S2'
    if (/giấu dây|giau day/i.test(normalizedName)) return `${label} (Giấu dây)`

    const series = normalizedName.match(/\((W\d+|T\d+|E\d+)\)/i)?.[1]
    if (series) return `${label} (${series.toUpperCase()})`

    if (/TCF33320/i.test(normalizedSkuBase(sku))) return `${label} (Tiêu chuẩn)`
    return label
}

function buildInaxBfvLabel(sku: string): string | null {
    const normalizedSku = normalizedSkuBase(sku)
    if (!/^BFV-81SE/i.test(normalizedSku)) return null
    return normalizedSku
}

function buildCottoC920Label(name: string, sku: string): string | null {
    const normalizedName = normalizeText(name)
    const match = normalizedSkuBase(sku).match(/C920\d/i)
    if (!match || !/COTTO/i.test(normalizedName)) return null
    return `Nắp điện tử ${match[0].toUpperCase()}`
}

function buildSeatLabel(name: string, sku: string): string | null {
    const text = `${normalizeText(name)} ${normalizeText(sku)}`
    const suffix = normalizeText(sku).match(/\+([A-Z0-9-]+)$/i)?.[1]
    if (/nắp điện tử/i.test(text)) return ['Nắp điện tử', suffix].filter(Boolean).join(' ')
    if (/nắp rửa cơ/i.test(text)) return ['Nắp rửa cơ', suffix].filter(Boolean).join(' ')
    if (/nắp (?:đóng )?êm/i.test(text)) return ['Nắp êm', suffix].filter(Boolean).join(' ')
    if (suffix) return suffix
    return null
}

function labelReferencesDifferentSku(label: string, sku: string): boolean {
    const normalizedLabel = normalizeText(label).toUpperCase()
    const normalizedSku = normalizedSkuBase(sku)
    const skuTokens = normalizedLabel.match(/\b[A-Z]{1,5}\d{2,}[A-Z0-9-]*\b/g) || []
    return skuTokens.length > 0 && !skuTokens.some((token) => normalizedSku.includes(token))
}

export function variantLabelLooksSuspicious(label: string | null | undefined, name: string, sku: string): boolean {
    const normalizedLabel = normalizeText(label)
    if (!normalizedLabel) return true
    if (labelReferencesDifferentSku(normalizedLabel, sku)) return true

    const normalizedName = normalizeText(name)
    if (/massage/i.test(normalizedName) && !/massage/i.test(normalizedLabel)) return true
    if (isApronBathVariant(normalizedName, sku) && /bồn xây/i.test(normalizedLabel) && !/chân yếm/i.test(normalizedLabel)) return true
    if (/washlet\s*s2/i.test(normalizedName) && normalizedLabel === normalizedSkuBase(sku)) return true
    return false
}

export function deriveSemanticVariantLabel(name: string, sku: string): string | null {
    return (
        buildCs988Label(name, sku)
        || buildWashletS2Label(name, sku)
        || buildBathConfigLabel(name, sku)
        || buildCottoC920Label(name, sku)
        || buildInaxBfvLabel(sku)
        || buildSeatLabel(name, sku)
        || null
    )
}

export function getPreferredVariantLabel(params: {
    explicitLabel?: string | null
    name: string
    sku: string
    fallbackLabel?: string | null
}): string | null {
    const explicitLabel = normalizeText(params.explicitLabel)
    const fallbackLabel = normalizeText(params.fallbackLabel)
    const inferredLabel = deriveSemanticVariantLabel(params.name, params.sku)

    if (explicitLabel && !variantLabelLooksSuspicious(explicitLabel, params.name, params.sku)) {
        return explicitLabel
    }

    if (inferredLabel) return inferredLabel
    if (explicitLabel) return explicitLabel
    if (fallbackLabel) return fallbackLabel
    return null
}
