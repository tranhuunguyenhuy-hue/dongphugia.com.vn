/**
 * The only V1 responsive image profile. Keep this module free of Node or
 * provider imports so the upload-time Worker and the offline processor share
 * the same profile contract.
 */
export const PRODUCT_V1_PROFILE = Object.freeze({
    version: 'product-v1',
    format: 'webp',
    widths: Object.freeze([320, 640, 1280]),
    quality: 82,
    withoutEnlargement: true,
})

export type ProductV1ProfileVersion = typeof PRODUCT_V1_PROFILE.version
