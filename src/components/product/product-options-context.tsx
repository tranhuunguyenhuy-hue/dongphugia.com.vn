'use client'

import { createContext, useContext } from 'react'

interface ProductOptionsContextType {
    installOption: 'none' | 'install' | 'replace'
    setInstallOption: (opt: 'none' | 'install' | 'replace') => void
    installationFee: number
    onlineDiscountAmount: number
}

export const ProductOptionsContext = createContext<ProductOptionsContextType | null>(null)

export function useProductOptions() {
    return useContext(ProductOptionsContext)
}
