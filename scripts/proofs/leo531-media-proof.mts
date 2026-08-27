import { randomBytes } from 'node:crypto'
import sharp from 'sharp'
const mediaModule = await import('../../src/lib/publishing/media')
const resolvedMediaModule = (mediaModule.PUBLISHING_MEDIA_MAX_BYTES
  ? mediaModule
  : mediaModule.default as typeof mediaModule)
const { processPublishingImage, PUBLISHING_MEDIA_MAX_BYTES, PUBLISHING_MEDIA_PROFILES } = resolvedMediaModule

const width = 2_400
const height = 1_800
const raw = randomBytes(width * height * 3)
let quality = 98
let source = await sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality }).toBuffer()
while (source.byteLength > PUBLISHING_MEDIA_MAX_BYTES && quality > 70) {
  quality -= 2
  source = await sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality }).toBuffer()
}
if (source.byteLength > PUBLISHING_MEDIA_MAX_BYTES || source.byteLength < 4 * 1024 * 1024) {
  throw new Error(`Could not create representative near-limit image: ${source.byteLength}`)
}

const results: Record<string, unknown> = {}
for (const purpose of Object.keys(PUBLISHING_MEDIA_PROFILES) as Array<keyof typeof PUBLISHING_MEDIA_PROFILES>) {
  const processed = await processPublishingImage(source, 'image/jpeg', purpose)
  results[purpose] = {
    source: { width: processed.sourceWidth, height: processed.sourceHeight, bytes: source.byteLength },
    variants: processed.variants.map(({ targetWidth, width: variantWidth, height: variantHeight, bytes, format }) => ({
      targetWidth,
      width: variantWidth,
      height: variantHeight,
      bytes,
      format,
      proposedBunnySuffix: `.${purpose}.w${targetWidth}.webp`,
    })),
  }
}

process.stdout.write(`${JSON.stringify({
  currentContractReference: results,
  cloudflareImagesBindingMapping: Object.fromEntries(
    Object.entries(PUBLISHING_MEDIA_PROFILES).map(([purpose, profile]) => [purpose, {
      input: 'ReadableStream up to 20 MB; current application cap remains 5 MiB',
      transforms: profile.widths.map((targetWidth) => ({
        width: targetWidth,
        ...(profile.aspectRatio ? { height: Math.round(targetWidth / profile.aspectRatio), fit: 'cover' } : { fit: 'scale-down' }),
        format: 'image/webp',
        quality: profile.quality,
      })),
      destination: 'PUT deterministic existing variant paths to Bunny, then commit DB metadata',
    }]),
  ),
  failureContract: [
    'validate MIME and dimensions before transform',
    'do not commit ready DB metadata until every Bunny PUT succeeds',
    'retry by deterministic media id and variant path',
    'record failed status and safe error code; never expose Bunny credential',
  ],
  externalCloudflareTransformExecuted: false,
})}\n`)
