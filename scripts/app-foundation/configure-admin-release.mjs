import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { prepareAdminRelease } from './prepare-admin-release.mjs'

const accountId = 'd54f3402b9d112ab64d6135e0e3f1fb1'
const { CLOUDFLARE_API_TOKEN: deploymentToken, CLOUDFLARE_HYPERDRIVE_READ_TOKEN: readToken, EXPECTED_TOKEN_ID: tokenId, HYPERDRIVE_ID: id, HYPERDRIVE_HOST: host, HYPERDRIVE_DATABASE: database, SOURCE_SHA: sourceSha, ARTIFACT_SHA256: artifactSha256, ARTIFACT_ROOT: root, ROLLBACK_VERSION: rollbackVersion } = process.env
if (!deploymentToken || !readToken || !/^[a-f0-9]{32}$/.test(tokenId || '') || !/^[a-f0-9]{32}$/.test(id || '') || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(rollbackVersion || '') || !root) throw new Error('ADMIN_RELEASE_CONFIGURATION_INPUT_INVALID')
async function get(endpoint, token) {
  let response
  try { response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/${endpoint}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }) } catch { throw new Error('ADMIN_RELEASE_CLOUDFLARE_REQUEST_FAILED') }
  if (!response.ok) throw new Error('ADMIN_RELEASE_CLOUDFLARE_REQUEST_FAILED')
  const body = await response.json()
  if (body?.success !== true) throw new Error('ADMIN_RELEASE_CLOUDFLARE_RESPONSE_INVALID')
  return body.result
}
const identity = await get('tokens/verify', deploymentToken)
if (identity?.id !== tokenId || identity.status !== 'active') throw new Error('ADMIN_RELEASE_TOKEN_IDENTITY_MISMATCH')
const deployments = await get('workers/scripts/dongphugia-v1-public-production/deployments', deploymentToken)
const active = deployments?.deployments?.[0]?.versions
if (!Array.isArray(active) || active.length !== 1 || active[0]?.version_id !== rollbackVersion || active[0]?.percentage !== 100) throw new Error('ADMIN_RELEASE_ROLLBACK_BASELINE_MISMATCH')
const hyperdrive = await get(`hyperdrive/configs/${id}`, readToken)
const config = await prepareAdminRelease({ root, sourceSha, artifactSha256, accountId, hyperdrive, expectedHyperdrive: { id, host, database, user: 'dpg_admin_runtime_login' } })
await writeFile(path.join(root, 'trusted-wrangler.json'), `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
process.stdout.write('ADMIN_RELEASE_CONFIGURATION_PREPARED\n')
