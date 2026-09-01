import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ProductV1MediaBundle } from '../../src/lib/media/v1/processor'

const require = createRequire(import.meta.url)
const { processProductV1Media } = require('../../src/lib/media/v1/processor.ts') as typeof import('../../src/lib/media/v1/processor')
const { MAX_MEDIA_BYTES, MediaContractError } = require('../../src/lib/media/v1/contract.ts') as typeof import('../../src/lib/media/v1/contract')

function argument(name: string): string {
    const index = process.argv.indexOf(name)
    const value = index >= 0 ? process.argv[index + 1] : undefined
    if (!value || value.startsWith('--')) throw new Error(`ARGUMENT_REQUIRED:${name}`)
    return value
}

function optionalArgument(name: string): string | undefined {
    const index = process.argv.indexOf(name)
    const value = index >= 0 ? process.argv[index + 1] : undefined
    if (value?.startsWith('--')) throw new Error(`ARGUMENT_REQUIRED:${name}`)
    return value
}

function manifestFor(bundle: ProductV1MediaBundle) {
    return {
        contract: 'dongphugia:product-v1-media-processor',
        kind: bundle.kind,
        profileVersion: bundle.profileVersion,
        source: {
            sha256: bundle.source.sha256,
            byteSize: bundle.source.byteSize,
            mimeType: bundle.source.mimeType,
            widthPx: bundle.kind === 'IMAGE' ? bundle.source.widthPx : null,
            heightPx: bundle.kind === 'IMAGE' ? bundle.source.heightPx : null,
        },
        original: {
            key: bundle.original.key,
            sha256: bundle.original.sha256,
            byteSize: bundle.original.byteSize,
            mimeType: bundle.original.mimeType,
        },
        delivery: bundle.kind === 'IMAGE'
            ? bundle.variants.map((variant) => ({
                key: variant.key,
                sha256: variant.sha256,
                byteSize: variant.byteSize,
                mimeType: variant.mimeType,
                targetWidthPx: variant.targetWidthPx,
                widthPx: variant.widthPx,
                heightPx: variant.heightPx,
            }))
            : [{
                key: bundle.primaryVariant.key,
                sha256: bundle.primaryVariant.sha256,
                byteSize: bundle.primaryVariant.byteSize,
                mimeType: bundle.primaryVariant.mimeType,
                widthPx: null,
                heightPx: null,
            }],
        primaryDeliveryObjectKey: bundle.primaryVariant.key,
    }
}

async function writeObject(outputDir: string, object: { key: string; bytes: Buffer }) {
    const target = path.join(outputDir, object.key)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, object.bytes)
}

async function main() {
    const inputPath = argument('--input')
    const kind = argument('--kind')
    const declaredMime = argument('--mime')
    const outputDir = optionalArgument('--output-dir')
    if (kind !== 'IMAGE' && kind !== 'DOCUMENT') throw new Error('KIND_UNSUPPORTED')
    const inputStat = await stat(inputPath)
    if (!inputStat.isFile() || inputStat.size > MAX_MEDIA_BYTES) {
        throw new MediaContractError('MEDIA_BYTES_OUT_OF_BOUNDS')
    }

    const bundle = await processProductV1Media(
        await readFile(inputPath),
        kind,
        declaredMime,
    )
    const manifest = manifestFor(bundle)
    if (outputDir) {
        await mkdir(outputDir, { recursive: true })
        await writeObject(outputDir, bundle.original)
        for (const object of bundle.variants) await writeObject(outputDir, object)
        if (bundle.kind === 'DOCUMENT') {
            await writeObject(outputDir, bundle.primaryVariant)
        }
        await writeFile(
            path.join(outputDir, 'manifest.json'),
            `${JSON.stringify(manifest, null, 2)}\n`,
        )
    } else {
        process.stdout.write(`${JSON.stringify(manifest)}\n`)
    }
    process.stderr.write(
        `MEDIA_PROCESSOR status=PASS kind=${bundle.kind} variants=${bundle.variants.length}\n`,
    )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    main().catch((error: unknown) => {
        const code = error instanceof MediaContractError ? error.code : 'PROCESS_FAILED'
        process.stderr.write(`MEDIA_PROCESSOR status=FAIL code=${code}\n`)
        process.exitCode = 1
    })
}
