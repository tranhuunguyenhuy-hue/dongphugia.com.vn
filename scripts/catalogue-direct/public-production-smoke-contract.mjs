export function isExpectedProductionResponse(response, sourceSha, { staticAsset = false } = {}) {
  return response.status === 200
    && (staticAsset || response.headers.get('x-dpg-source-sha') === sourceSha)
    && !response.headers.has('set-cookie')
}

export function isExpectedPublicSnapshotManifest(snapshot, checkpoint) {
  return snapshot?.contract === 'dpg:public-catalogue-snapshot:v1'
    && snapshot.checkpoint === checkpoint
    && snapshot.products === 5223
    && snapshot.listingProducts === 4853
    && snapshot.contentPolicy === 'canonical-public-content-v4'
    && snapshot.searchProducts > 0
    && snapshot.contentStats?.publicPrices > 0
}
