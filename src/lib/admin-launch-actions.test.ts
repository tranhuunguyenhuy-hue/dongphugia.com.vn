import { describe, expect, it } from 'vitest'
import {
    assignQuote,
    completeQuote,
    updateQuoteData,
} from '../app/admin/(dashboard)/quote-requests/[id]/builder/actions'
import { saveCustomer } from '../app/admin/(dashboard)/customers/actions'
import { saveUser } from '../app/admin/(dashboard)/users/actions'
import {
    createBanner,
    deleteBanner,
    updateBanner,
    updateCategoryBanner,
    updateQuoteRequestStatus,
} from './actions'
import {
    getDashboardStats,
    getPendingOrders,
    getPendingQuotes,
    getRevenueChart,
    getTopProductsByQuotes,
    getTopProductsBySales,
} from './admin-dashboard-queries'
import { assertAdminLaunchModuleEnabled } from './admin-launch-scope'
import { createBlogTag, deleteBlogTag } from './blog-actions'
import {
    assignOrder,
    createOrder,
    createQuoteFromOrder,
    getAdminOrderById,
    getAdminOrders,
    getOrderByNumber,
    getOrderStats,
    updateOrderData,
    updateOrderStatus,
    updatePaymentStatus,
} from './order-actions'
import { createPartner, deletePartner, updatePartner } from './partner-actions'
import {
    addProductDocument,
    createBrand,
    createCatalogTaxon,
    createProductSubType,
    createProductType,
    createSpecDefinition,
    createSpecOption,
    getPimPilotParityReport,
    removeProductDocument,
    setBrandActive,
    setCatalogTaxonState,
    setProductSubTypeActive,
    setProductTaxonomy,
    setProductTypeActive,
    updateBrand,
    updateCatalogTaxon,
    updateProductCommerce,
    updateProductDocument,
    updateProductSeo,
    updateProductSubType,
    updateProductType,
    updateProductVisibility,
    updateSpecDefinition,
    upsertProductSpecValues,
} from './pim-actions'
import { createProject, deleteProject, updateProject } from './project-actions'

type Action = (...args: never[]) => Promise<unknown>
const actions: Array<[string, Action]> = [
    ['saveCustomer', saveCustomer],
    ['updateQuoteData', updateQuoteData], ['completeQuote', completeQuote], ['assignQuote', assignQuote],
    ['saveUser', saveUser],
    ['createBanner', createBanner], ['updateBanner', updateBanner], ['deleteBanner', deleteBanner],
    ['updateCategoryBanner', updateCategoryBanner], ['updateQuoteRequestStatus', updateQuoteRequestStatus],
    ['getDashboardStats', getDashboardStats], ['getRevenueChart', getRevenueChart], ['getPendingQuotes', getPendingQuotes],
    ['getPendingOrders', getPendingOrders], ['getTopProductsBySales', getTopProductsBySales], ['getTopProductsByQuotes', getTopProductsByQuotes],
    ['createBlogTag', createBlogTag], ['deleteBlogTag', deleteBlogTag],
    ['createOrder', createOrder], ['updateOrderStatus', updateOrderStatus], ['updatePaymentStatus', updatePaymentStatus],
    ['getOrderByNumber', getOrderByNumber], ['getAdminOrders', getAdminOrders], ['getAdminOrderById', getAdminOrderById],
    ['getOrderStats', getOrderStats], ['createQuoteFromOrder', createQuoteFromOrder], ['updateOrderData', updateOrderData], ['assignOrder', assignOrder],
    ['createPartner', createPartner], ['updatePartner', updatePartner], ['deletePartner', deletePartner],
    ['createBrand', createBrand], ['updateBrand', updateBrand], ['setBrandActive', setBrandActive],
    ['createCatalogTaxon', createCatalogTaxon], ['updateCatalogTaxon', updateCatalogTaxon], ['setCatalogTaxonState', setCatalogTaxonState],
    ['setProductTaxonomy', setProductTaxonomy], ['createProductType', createProductType], ['updateProductType', updateProductType],
    ['setProductTypeActive', setProductTypeActive], ['createProductSubType', createProductSubType], ['updateProductSubType', updateProductSubType],
    ['setProductSubTypeActive', setProductSubTypeActive], ['createSpecDefinition', createSpecDefinition], ['updateSpecDefinition', updateSpecDefinition],
    ['createSpecOption', createSpecOption], ['upsertProductSpecValues', upsertProductSpecValues], ['addProductDocument', addProductDocument],
    ['updateProductDocument', updateProductDocument], ['removeProductDocument', removeProductDocument], ['updateProductCommerce', updateProductCommerce],
    ['updateProductVisibility', updateProductVisibility], ['updateProductSeo', updateProductSeo], ['getPimPilotParityReport', getPimPilotParityReport],
    ['createProject', createProject], ['updateProject', updateProject], ['deleteProject', deleteProject],
]

describe('Admin launch action scope', () => {
    it('keeps Product and Blog post modules enabled', () => {
        expect(() => assertAdminLaunchModuleEnabled('products')).not.toThrow()
        expect(() => assertAdminLaunchModuleEnabled('blog-posts')).not.toThrow()
    })

    it.each(actions)('denies deferred action %s before it can read or write data', async (_name, action) => {
        await expect(action()).rejects.toThrow('ADMIN_LAUNCH_SCOPE_DENIED')
    })
})
