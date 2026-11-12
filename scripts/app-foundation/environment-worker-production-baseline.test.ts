import { describe, expect, it, vi } from 'vitest'

import {
  compareProductionPublicBaseline,
  readProductionPublicBaseline,
} from './verify-production-public-baseline.mjs'

const snapshot = {
  status: 'ok',
  application: 'public',
  catalogueMode: 'verified-snapshot',
  catalogueCheckpoint: 'a'.repeat(40),
  publicProducts: 5223,
  listingProducts: 4853,
  m3RunId: '40739074902',
}
const health = {
  ...snapshot,
  unrelatedPublicHealthValue: 'ignored',
}
const manifest = {
  contract: 'dpg:public-catalogue-snapshot:v1',
  checkpoint: snapshot.catalogueCheckpoint,
  m3RunId: Number(snapshot.m3RunId),
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function productionResponses(healthBody = health, manifestBody = manifest) {
  return vi.fn()
    .mockResolvedValueOnce(jsonResponse(healthBody))
    .mockResolvedValueOnce(jsonResponse(manifestBody))
}

describe('read-only Production baseline protection', () => {
  it('reads only fixed public GET endpoints and extracts a minimal catalogue snapshot', async () => {
    const fetchImpl = productionResponses()
    await expect(readProductionPublicBaseline({ fetchImpl })).resolves.toEqual(snapshot)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ['https://www.dongphugia.vn/api/health', 'GET'],
      ['https://www.dongphugia.vn/__catalogue/v1/manifest.json', 'GET'],
    ])
  })

  it('accepts a stable baseline and rejects a changed checkpoint or mismatched manifest', async () => {
    await expect(compareProductionPublicBaseline({
      expectedSnapshot: snapshot,
      fetchImpl: productionResponses(),
    })).resolves.toMatchObject({ status: 'ENVIRONMENT_WORKER_PRODUCTION_BASELINE_UNCHANGED', snapshot })

    const changedHealth = { ...health, catalogueCheckpoint: 'b'.repeat(40) }
    const changedManifest = { ...manifest, checkpoint: changedHealth.catalogueCheckpoint }
    await expect(compareProductionPublicBaseline({
      expectedSnapshot: snapshot,
      fetchImpl: productionResponses(changedHealth, changedManifest),
    })).rejects.toThrow('ENVIRONMENT_WORKER_PRODUCTION_BASELINE_CHANGED')

    await expect(readProductionPublicBaseline({
      fetchImpl: productionResponses(health, { ...manifest, checkpoint: 'c'.repeat(40) }),
    })).rejects.toThrow('ENVIRONMENT_WORKER_PRODUCTION_BASELINE_MANIFEST_MISMATCH')
  })

  it('fails closed on unavailable or invalid public health data', async () => {
    await expect(readProductionPublicBaseline({
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ error: true }, 503)),
    })).rejects.toThrow('ENVIRONMENT_WORKER_PRODUCTION_BASELINE_REQUEST_FAILED')
    await expect(readProductionPublicBaseline({
      fetchImpl: productionResponses({ ...health, publicProducts: 0 }),
    })).rejects.toThrow('ENVIRONMENT_WORKER_PRODUCTION_BASELINE_INVALID')
  })
})
