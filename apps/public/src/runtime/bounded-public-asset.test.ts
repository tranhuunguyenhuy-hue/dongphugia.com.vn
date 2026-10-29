import { describe, expect, it, vi } from 'vitest'
import { readBoundedPublicAssetText } from './bounded-public-asset'

describe('bounded public asset read', () => {
  it('reads a chunked public JSON asset within the byte limit', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"name":"'))
        controller.enqueue(encoder.encode('Thiết bị bếp"}'))
        controller.close()
      },
    })
    expect(await readBoundedPublicAssetText(new Response(stream))).toBe('{"name":"Thiết bị bếp"}')
  })

  it('cancels a chunked response as soon as the byte bound is crossed', async () => {
    const cancel = vi.fn()
    let delivered = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        delivered++
        controller.enqueue(new Uint8Array(1_000_001))
      },
      cancel,
    }, { highWaterMark: 0 })
    await expect(readBoundedPublicAssetText(new Response(stream))).rejects.toThrow('PUBLIC_CATALOGUE_UNAVAILABLE')
    expect(delivered).toBe(2)
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('rejects a single oversized chunk and invalid UTF-8', async () => {
    await expect(readBoundedPublicAssetText(new Response(new Uint8Array(2_000_001))))
      .rejects.toThrow('PUBLIC_CATALOGUE_UNAVAILABLE')
    await expect(readBoundedPublicAssetText(new Response(new Uint8Array([0xff]))))
      .rejects.toThrow('PUBLIC_CATALOGUE_UNAVAILABLE')
  })

  it('fails closed when the stream read throws', async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { controller.error(new Error('upstream failed')) },
    })
    await expect(readBoundedPublicAssetText(new Response(stream)))
      .rejects.toThrow('PUBLIC_CATALOGUE_UNAVAILABLE')
  })
})
