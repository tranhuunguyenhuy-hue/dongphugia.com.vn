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
    price: number | null
    salePrice: number | null
    onlineDiscountAmount: number | null
    installOption: InstallOption
}

export function calculateOrderUnitPrice({
    price,
    salePrice,
    onlineDiscountAmount,
    installOption,
}: OrderUnitPriceInput): number | null {
    const authoritativePrice = salePrice ?? price
    const discount = onlineDiscountAmount ?? 0

    if (
        authoritativePrice === null
        || !Number.isFinite(authoritativePrice)
        || authoritativePrice <= 0
        || !Number.isFinite(discount)
        || discount < 0
        || discount > authoritativePrice
    ) {
        return null
    }

    const unitPrice = authoritativePrice - discount + getInstallationFee(installOption)
    return Math.round(unitPrice * 100) / 100
}
