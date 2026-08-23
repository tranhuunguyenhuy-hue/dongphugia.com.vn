import { resolveProductCommerce } from './product-commerce'

export type InstallOption = 'none' | 'install' | 'replace'

export const INSTALLATION_FEES: Record<InstallOption, number> = {
    none: 0,
    install: 200_000,
    replace: 350_000,
}

export function getInstallationFee(option: InstallOption): number {
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
    installOption,
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

    const unitPrice = authoritativePrice + getInstallationFee(installOption)
    return Math.round(unitPrice * 100) / 100
}
