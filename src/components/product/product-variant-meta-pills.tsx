'use client'

import { useEffect, useMemo, useState } from 'react'

type ColorValue = {
    name: string
    hex_code: string | null
} | null

type VariantOption = {
    axis?: string
    value?: string
}

interface ProductVariantMetaPillsProps {
    initialSku: string
    initialColor?: ColorValue
    initialVariantOptions?: unknown
}

function parseOptions(value: unknown): VariantOption[] {
    if (!Array.isArray(value)) return []
    return value
        .map((item) => item as Record<string, unknown>)
        .map((item) => ({
            axis: item.axis ? String(item.axis) : undefined,
            value: item.value ? String(item.value) : undefined,
        }))
}

function colorFromOptions(value: unknown): string | null {
    return parseOptions(value).find((option) => option.axis === 'color')?.value || null
}

function colorHex(name: string | null, fallback?: string | null) {
    if (!name) return fallback || '#ccc'

    const normalized = name.toLowerCase()
    if (normalized.includes('đen')) return '#111827'
    if (normalized.includes('đỏ')) return '#b91c1c'
    if (normalized.includes('vàng')) return '#d4a017'
    if (normalized.includes('xám')) return '#9ca3af'
    if (normalized.includes('chrome') || normalized.includes('crom')) return '#e5e7eb'

    return fallback || '#ccc'
}

export function ProductVariantMetaPills({
    initialSku,
    initialColor,
    initialVariantOptions,
}: ProductVariantMetaPillsProps) {
    const initialOptionColor = useMemo(() => colorFromOptions(initialVariantOptions), [initialVariantOptions])
    const [sku, setSku] = useState(initialSku)
    const [colorName, setColorName] = useState(initialOptionColor || initialColor?.name || null)

    useEffect(() => {
        setSku(initialSku)
        setColorName(initialOptionColor || initialColor?.name || null)
    }, [initialSku, initialOptionColor, initialColor?.name])

    useEffect(() => {
        const handleSelection = (event: Event) => {
            const detail = (event as CustomEvent<{ sku?: string; color?: string; variantOptions?: unknown }>).detail
            if (!detail) return

            if (detail.sku) setSku(detail.sku)
            const nextColor = colorFromOptions(detail.variantOptions) || detail.color
            setColorName(nextColor || null)
        }

        window.addEventListener('product-variant-selection', handleSelection)
        return () => window.removeEventListener('product-variant-selection', handleSelection)
    }, [])

    return (
        <>
            {colorName && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-50 border border-stone-200/60">
                    <span
                        className="w-3 h-3 rounded-full border border-black/10 shadow-sm"
                        style={{ backgroundColor: colorHex(colorName, initialColor?.hex_code) }}
                    />
                    <span className="font-medium text-stone-700">{colorName}</span>
                </div>
            )}

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-100">
                <span className="text-stone-500">Mã SP:</span>
                <span className="font-mono font-bold text-stone-800">{sku}</span>
            </div>
        </>
    )
}
