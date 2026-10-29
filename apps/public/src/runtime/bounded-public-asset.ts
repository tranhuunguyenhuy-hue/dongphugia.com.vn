const MAX_PUBLIC_ASSET_BYTES = 2_000_000

export async function readBoundedPublicAssetText(response: Response): Promise<string> {
  if (!response.body) throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_PUBLIC_ASSET_BYTES) throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
      chunks.push(value)
    }
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    await reader.cancel().catch(() => {})
    throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  } finally {
    reader.releaseLock()
  }
}
