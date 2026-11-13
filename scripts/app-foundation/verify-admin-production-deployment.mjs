const account = 'd54f3402b9d112ab64d6135e0e3f1fb1'
const { CLOUDFLARE_API_TOKEN: token, SOURCE_SHA: sha, ROLLBACK_VERSION: rollback } = process.env
if (!token || !/^[a-f0-9]{40}$/.test(sha || '') || !rollback) throw new Error('ADMIN_RELEASE_SMOKE_INPUT_INVALID')
let response
try { response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/dongphugia-v1-public-production/deployments`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) }) } catch { throw new Error('ADMIN_RELEASE_DEPLOYMENT_READ_FAILED') }
if (!response.ok) throw new Error('ADMIN_RELEASE_DEPLOYMENT_READ_FAILED')
const body = await response.json()
const deployment = body?.result?.deployments?.[0]
if (body?.success !== true || deployment?.annotations?.['workers/message'] !== `DPG admin source ${sha}` || deployment?.versions?.length !== 1 || deployment.versions[0]?.percentage !== 100 || deployment.versions[0]?.version_id === rollback) throw new Error('ADMIN_RELEASE_DEPLOYMENT_IDENTITY_INVALID')
for (const pathname of ['/', '/admin/login']) {
  let page
  try { page = await fetch(`https://www.dongphugia.vn${pathname}`, { redirect: 'manual', signal: AbortSignal.timeout(15000) }) } catch { throw new Error('ADMIN_RELEASE_HTTP_SMOKE_FAILED') }
  if (page.status !== 200) throw new Error('ADMIN_RELEASE_HTTP_SMOKE_FAILED')
}
process.stdout.write(`${JSON.stringify({ status: 'ADMIN_RELEASE_SHELL_SMOKE_PASSED', deploymentId: deployment.id, versionId: deployment.versions[0].version_id })}\n`)
