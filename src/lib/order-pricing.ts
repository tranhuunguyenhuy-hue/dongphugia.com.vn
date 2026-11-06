import { resolveProductCommerce } from './product-commerce'

export type InstallOption = 'none' | 'install' | 'replace'

export const INSTALLATION_FEES: Record<InstallOption, number | null> = {
    none: 0,
    install: null,
    replace: null,
}

export function getInstallationFee(option: InstallOption): number | null {
    return INSTALLATION_FEES[option]
}

interface OrderUnitPriceInput {
    listPrice?: number | null
    originalPrice: number | null
    salePrice: number | null
    compatibilityPrice: number | null
    stockStatus: string | null
    installOption: InstallOption
}

export function calculateOrderUnitPrice({
    listPrice,
    originalPrice,
    salePrice,
    compatibilityPrice,
    stockStatus,
}: OrderUnitPriceInput): number | null {
    const commerce = resolveProductCommerce({
        listPrice,
        originalPrice,
        salePrice,
        compatibilityPrice,
        stockStatus,
    })
    const authoritativePrice = commerce.displayPrice

    if (
        !commerce.canAddToCart
        || authoritativePrice === null
        || !Number.isFinite(authoritativePrice)
        || authoritativePrice <= 0
    ) {
        return null
    }

    // Installation is an intent on the request, not a confirmed commercial
    // fact. Keep it out of the provisional product amount until staff confirms.
    return Math.round(authoritativePrice * 100) / 100
}
