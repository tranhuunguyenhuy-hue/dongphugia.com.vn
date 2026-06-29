'use client'

import { useEffect, useMemo, useState } from 'react'
import { getVariantDisplayColor } from '@/lib/variant-color-display'

type ColorValue = {
    name: string
    hex_code: string | null
} | null

interface ProductVariantMetaPillsProps {
    initialSku: string
    initialColor?: ColorValue
    initialVariantOptions?: unknown
}

export function ProductVariantMetaPills({
    initialSku,
    initialColor,
    initialVariantOptions,
}: ProductVariantMetaPillsProps) {
    const initialDisplayColor = useMemo(
        () => getVariantDisplayColor({ variantOptions: initialVariantOptions, fallbackColor: initialColor }),
        [initialVariantOptions, initialColor]
    )
    const [sku, setSku] = useState(initialSku)
    const [displayColor, setDisplayColor] = useState<ColorValue>(initialDisplayColor)

    useEffect(() => {
        setSku(initialSku)
        setDisplayColor(initialDisplayColor)
    }, [initialSku, initialDisplayColor])

    useEffect(() => {
        const handleSelection = (event: Event) => {
            const detail = (event as CustomEvent<{ sku?: string; color?: string; variantOptions?: unknown }>).detail
            if (!detail) return

            if (detail.sku) setSku(detail.sku)
            setDisplayColor(getVariantDisplayColor({
                variantOptions: detail.variantOptions,
                fallbackColor: detail.color ? { name: detail.color, hex_code: initialDisplayColor?.hex_code || null } : initialColor,
            }))
        }

        window.addEventListener('product-variant-selection', handleSelection)
        return () => window.removeEventListener('product-variant-selection', handleSelection)
    }, [initialColor, initialDisplayColor?.hex_code])

    return (
        <>
            {displayColor?.name && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-50 border border-stone-200/60">
                    <span
                        className="w-3 h-3 rounded-full border border-black/10 shadow-sm"
                        style={{ backgroundColor: displayColor.hex_code || '#ccc' }}
                    />
                    <span className="font-medium text-stone-700">{displayColor.name}</span>
                </div>
            )}

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-100">
                <span className="text-stone-500">Mã SP:</span>
                <span className="font-mono font-bold text-stone-800">{sku}</span>
            </div>
        </>
    )
}
