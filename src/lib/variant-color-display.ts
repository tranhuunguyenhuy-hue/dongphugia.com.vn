type VariantOption = {
    axis?: string
    value?: string
}

type ColorValue = {
    name: string
    hex_code: string | null
} | null

function parseOptions(value: unknown): VariantOption[] {
    if (!Array.isArray(value)) return []
    return value
        .map((item) => item as Record<string, unknown>)
        .map((item) => ({
            axis: item.axis ? String(item.axis) : undefined,
            value: item.value ? String(item.value) : undefined,
        }))
}

function inferColorHex(name: string | null, fallback?: string | null) {
    if (!name) return fallback || '#ccc'

    const normalized = name.toLowerCase()
    if (normalized.includes('đen')) return '#111827'
    if (normalized.includes('đỏ')) return '#b91c1c'
    if (normalized.includes('vàng')) return '#d4a017'
    if (normalized.includes('xám')) return '#9ca3af'
    if (normalized.includes('chrome') || normalized.includes('crom') || normalized.includes('niken')) return '#e5e7eb'
    if (normalized.includes('trắng') || normalized.includes('white')) return '#ffffff'

    return fallback || '#ccc'
}

export function getVariantDisplayColor(params: {
    variantOptions?: unknown
    fallbackColor?: ColorValue
}): ColorValue {
    const optionColor = parseOptions(params.variantOptions).find((option) => option.axis === 'color')?.value?.trim()
    if (optionColor) {
        return {
            name: optionColor,
            hex_code: inferColorHex(optionColor, params.fallbackColor?.hex_code),
        }
    }

    return params.fallbackColor ?? null
}
