import { readFile, writeFile } from 'node:fs/promises'

const PRODUCTION_ORIGIN = 'https://www.dongphugia.vn'
const SHA = /^[a-f0-9]{40}$/
const M3_RUN = /^\d+$/

function fail(code) {
  throw new Error(code)
}

function validateSnapshot(snapshot) {
  if (snapshot?.status !== 'ok' || snapshot?.application !== 'public'
    || snapshot?.catalogueMode !== 'verified-snapshot'
    || !SHA.test(snapshot?.catalogueCheckpoint || '')
    || !Number.isSafeInteger(snapshot?.publicProducts) || snapshot.publicProducts < 1
    || !Number.isSafeInteger(snapshot?.listingProducts) || snapshot.listingProducts < 1
    || !M3_RUN.test(snapshot?.m3RunId || '')) {
    fail('ENVIRONMENT_WORKER_PRODUCTION_BASELINE_INVALID')
  }
  return snapshot
}

async function fetchJson(fetchImpl, url) {
  let response
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    })
  } catch {
    fail('ENVIRONMENT_WORKER_PRODUCTION_BASELINE_REQUEST_FAILED')
  }
  if (response.status !== 200) fail('ENVIRONMENT_WORKER_PRODUCTION_BASELINE_REQUEST_FAILED')
  try {
    return await response.json()
  } catch {
    fail('ENVIRONMENT_WORKER_PRODUCTION_BASELINE_RESPONSE_INVALID')
  }
}

export async function readProductionPublicBaseline({ fetchImpl = fetch } = {}) {
  const [health, manifest] = await Promise.all([
    fetchJson(fetchImpl, `${PRODUCTION_ORIGIN}/api/health`),
    fetchJson(fetchImpl, `${PRODUCTION_ORIGIN}/__catalogue/v1/manifest.json`),
  ])
  const snapshot = validateSnapshot({
    status: health.status,
    application: health.application,
    catalogueMode: health.catalogueMode,
    catalogueCheckpoint: health.catalogueCheckpoint,
    publicProducts: health.publicProducts,
    listingProducts: health.listingProducts,
    m3RunId: health.m3RunId,
  })
  if (manifest.contract !== 'dpg:public-catalogue-snapshot:v1'
    || manifest.checkpoint !== snapshot.catalogueCheckpoint
    || String(manifest.m3RunId) !== snapshot.m3RunId) {
    fail('ENVIRONMENT_WORKER_PRODUCTION_BASELINE_MANIFEST_MISMATCH')
  }
  return snapshot
}

export async function compareProductionPublicBaseline({
  expectedSnapshot,
  fetchImpl = fetch,
}) {
  validateSnapshot(expectedSnapshot)
  const currentSnapshot = await readProductionPublicBaseline({ fetchImpl })
  if (JSON.stringify(currentSnapshot) !== JSON.stringify(expectedSnapshot)) {
    fail('ENVIRONMENT_WORKER_PRODUCTION_BASELINE_CHANGED')
  }
  return { status: 'ENVIRONMENT_WORKER_PRODUCTION_BASELINE_UNCHANGED', snapshot: currentSnapshot }
}

async function main() {
  const [mode, baselinePath] = process.argv.slice(2)
  if (!baselinePath || !['capture', 'compare'].includes(mode)) {
    fail('USAGE: verify-production-public-baseline <capture|compare> <baseline-path>')
  }
  if (mode === 'capture') {
    const snapshot = await readProductionPublicBaseline()
    await writeFile(baselinePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
    process.stdout.write(`${JSON.stringify({ status: 'ENVIRONMENT_WORKER_PRODUCTION_BASELINE_CAPTURED', snapshot })}\n`)
    return
  }
  const expectedSnapshot = JSON.parse(await readFile(baselinePath, 'utf8'))
  const result = await compareProductionPublicBaseline({ expectedSnapshot })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    process.stderr.write(`ENVIRONMENT_WORKER_PRODUCTION_BASELINE_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}\n`)
    process.exitCode = 1
  })
}
