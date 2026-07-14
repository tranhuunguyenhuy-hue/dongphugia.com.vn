'use client'

import { createContext, useContext } from 'react'
import type { InstallOption } from '@/lib/order-pricing'

interface ProductOptionsContextType {
    installOption: InstallOption
    setInstallOption: (opt: InstallOption) => void
    installationFee: number
    onlineDiscountAmount: number
}

export const ProductOptionsContext = createContext<ProductOptionsContextType | null>(null)

export function useProductOptions() {
    return useContext(ProductOptionsContext)
}
