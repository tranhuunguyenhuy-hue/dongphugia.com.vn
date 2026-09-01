import { createHash } from 'node:crypto'

import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
    MediaContractError,
    PRODUCT_V1_PROFILE,
    assertGeneratedObjectKey,
    publicImageObjectKey,
    validateImageSource,
    validatePdfSource,
} from '../contract'
import { transformProductV1WithCloudflareImages } from '../cloudflare-images'
import {
    mediaRegistrationInput,
    MediaObjectNotFoundError,
    providerVerificationInput,
    storeAndVerifyProductV1Bundle,
} from '../provider'
import { processProductV1Media } from '../processor'

function sha256(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex')
}

async function samplePng(width = 1600, height = 800): Promise<Buffer> {
    return sharp({
        create: {
            width,
            height,
            channels: 4,
            background: { r: 36, g: 116, b: 142, alpha: 1 },
        },
    }).png().toBuffer()
}

class FakeStore {
    readonly objects = new Map<string, { bytes: Buffer; mimeType: string }>()
    putCalls = 0
    throwAfterPut = false

    async put(object: { key: string; bytes: Buffer; mimeType: string }) {
        this.putCalls += 1
        this.objects.set(object.key, { bytes: Buffer.from(object.bytes), mimeType: object.mimeType })
        if (this.throwAfterPut) throw new Error('synthetic ambiguous network result')
    }

    async read(key: string) {
        const object = this.objects.get(key)
        if (!object) {
            throw new MediaObjectNotFoundError()
        }
        return {
            key,
            bytes: object.bytes,
            sha256: sha256(object.bytes),
            byteSize: object.bytes.byteLength,
            mimeType: object.mimeType,
        }
    }
}

describe('LEO-565 V1 media foundation', () => {
    it('uses one locked product-v1 profile and deterministically regenerates variants', async () => {
        const input = await samplePng()
        const first = await processProductV1Media(input, 'IMAGE', 'image/png')
        const second = await processProductV1Media(input, 'IMAGE', 'image/png')

        expect(PRODUCT_V1_PROFILE.version).toBe('product-v1')
        expect(PRODUCT_V1_PROFILE.widths).toEqual([320, 640, 1280])
        expect(first.variants).toHaveLength(3)
        expect(first.variants.map((variant) => variant.targetWidthPx)).toEqual([320, 640, 1280])
        expect(first.variants.map((variant) => variant.sha256))
            .toEqual(second.variants.map((variant) => variant.sha256))
        expect(first.variants.map((variant) => variant.bytes))
            .toEqual(second.variants.map((variant) => variant.bytes))
        expect(first.variants.every((variant) => (variant.widthPx ?? 0) <= 1600)).toBe(true)
        expect(first.primaryVariant.key).toBe(publicImageObjectKey(first.source.sha256, 1280))
        expect(first.original.key).toContain(`private/originals/v1/${first.source.sha256.slice(0, 2)}`)
        expect(() => assertGeneratedObjectKey('public/images/product-v1/not-content-addressed.webp'))
            .toThrowError(new MediaContractError('MEDIA_OBJECT_KEY_INVALID'))
    })

    it('does not upscale a small source and keeps the variant count bounded', async () => {
        const input = await samplePng(200, 100)
        const bundle = await processProductV1Media(input, 'IMAGE', 'image/png')

        expect(bundle.variants).toHaveLength(1)
        expect(bundle.variants[0]).toMatchObject({ targetWidthPx: 320, widthPx: 200, heightPx: 100 })
    })

    it('requires declared MIME and decoded bytes to agree', async () => {
        const input = await samplePng()

        await expect(validateImageSource(input, 'image/jpeg')).rejects.toMatchObject({
            code: 'MEDIA_SIGNATURE_MISMATCH',
        })
        await expect(validateImageSource(Buffer.from('not-an-image'), 'image/png'))
            .rejects.toMatchObject({ code: 'MEDIA_SIGNATURE_MISMATCH' })
    })

    it('validates PDFs without creating transformed variants', async () => {
        const input = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n')
        const bundle = await processProductV1Media(input, 'DOCUMENT', 'application/pdf')

        expect(bundle.variants).toEqual([])
        expect(bundle.profileVersion).toBeNull()
        expect(bundle.primaryVariant.key).toBe(`public/documents/v1/${sha256(input)}/document.pdf`)
        expect(validatePdfSource(input, 'application/pdf').sha256).toBe(sha256(input))
        expect(() => validatePdfSource(Buffer.from('%PDF-1.7\n'), 'application/pdf'))
            .toThrowError(new MediaContractError('PDF_SIGNATURE_INVALID'))
    })

    it('reconciles ambiguous writes and rejects different bytes at an immutable key', async () => {
        const input = await samplePng()
        const bundle = await processProductV1Media(input, 'IMAGE', 'image/png')
        const originals = new FakeStore()
        const delivery = new FakeStore()
        originals.throwAfterPut = true

        const verification = await storeAndVerifyProductV1Bundle(bundle, { originals, delivery })
        expect(verification.provider).toBe('bunny')
        expect(providerVerificationInput(verification).original.sha256).toBe(bundle.source.sha256)
        const registration = mediaRegistrationInput(bundle)
        expect(registration).toMatchObject({ kind: 'IMAGE', profile_version: 'product-v1' })
        expect(registration).not.toHaveProperty('state')

        const originalPutCalls = originals.putCalls
        await storeAndVerifyProductV1Bundle(bundle, { originals, delivery })
        expect(originals.putCalls).toBe(originalPutCalls)

        const different = Buffer.from(bundle.original.bytes)
        different[0] ^= 1
        originals.objects.set(bundle.original.key, {
            bytes: different,
            mimeType: bundle.original.mimeType,
        })
        await expect(storeAndVerifyProductV1Bundle(bundle, { originals, delivery }))
            .rejects.toMatchObject({ code: 'MEDIA_STORAGE_CONFLICT' })
    })

    it('uses Cloudflare Images only as an injected upload-time transform', async () => {
        const input = await samplePng(500, 250)
        const binding = {
            info: async () => ({ width: 500, height: 250, format: 'png' }),
            input: (bytes: Uint8Array) => ({
                transform: ({ width }: { width: number; fit: 'scale-down' }) => ({
                    output: () => ({
                        response: async () => new Response(
                            await sharp(bytes).resize({ width, withoutEnlargement: true }).webp().toBuffer(),
                            { status: 200 },
                        ),
                    }),
                }),
            }),
        }

        const variants = await transformProductV1WithCloudflareImages(
            binding,
            input,
            'image/png',
        )
        expect(variants.map((variant) => variant.targetWidthPx)).toEqual([320])
        expect(variants[0]?.widthPx).toBe(320)
        expect(variants[0]?.key).toMatch(/^public\/images\/product-v1\/[a-f0-9]{64}\/w320\.webp$/)
    })
})
