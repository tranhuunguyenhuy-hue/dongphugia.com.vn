import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { isExpectedProductionResponse, isExpectedPublicSnapshotManifest } from './public-production-smoke-contract.mjs'

const sourceSha = 'a'.repeat(40)
const checkpoint = 'b'.repeat(40)

describe('Production smoke response contract', () => {
  it('accepts a public static manifest without a Worker identity header', () => {
    const response = new Response('{"contract":"dpg:public-catalogue-snapshot:v1"}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
    assert.equal(isExpectedProductionResponse(response, sourceSha, { staticAsset: true }), true)
    assert.equal(isExpectedProductionResponse(response, sourceSha), false)
  })

  it('requires exact Worker identity and rejects cookies or failed responses', () => {
    const matching = new Response('ok', { status: 200, headers: { 'x-dpg-source-sha': sourceSha } })
    const mismatched = new Response('ok', { status: 200, headers: { 'x-dpg-source-sha': 'c'.repeat(40) } })
    const cookie = new Response('ok', { status: 200, headers: { 'x-dpg-source-sha': sourceSha, 'set-cookie': 'session=private' } })
    const failed = new Response('missing', { status: 404 })
    assert.equal(isExpectedProductionResponse(matching, sourceSha), true)
    assert.equal(isExpectedProductionResponse(mismatched, sourceSha), false)
    assert.equal(isExpectedProductionResponse(cookie, sourceSha), false)
    assert.equal(isExpectedProductionResponse(failed, sourceSha, { staticAsset: true }), false)
  })

  it('accepts only the expected restored catalogue snapshot', () => {
    const manifest = {
      contract: 'dpg:public-catalogue-snapshot:v1',
      checkpoint,
      products: 5223,
      listingProducts: 4853,
      contentPolicy: 'canonical-public-content-v4',
      searchProducts: 5000,
      contentStats: { publicPrices: 4500 },
    }
    assert.equal(isExpectedPublicSnapshotManifest(manifest, checkpoint), true)
    assert.equal(isExpectedPublicSnapshotManifest({ ...manifest, checkpoint: 'd'.repeat(40) }, checkpoint), false)
    assert.equal(isExpectedPublicSnapshotManifest({ ...manifest, contentPolicy: 'legacy' }, checkpoint), false)
  })
})
