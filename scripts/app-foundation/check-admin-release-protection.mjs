import { verifyAdminProductionProtection } from './admin-production-protection.mjs'

if (process.env.GITHUB_REPOSITORY !== 'tranhuunguyenhuy-hue/dongphugia.com.vn' || !process.env.GITHUB_TOKEN || !/^[a-f0-9]{40}$/.test(process.env.SOURCE_SHA || '')) throw new Error('ADMIN_RELEASE_PROTECTION_INPUT_INVALID')
const base = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}`
async function get(suffix) {
  const response = await fetch(`${base}${suffix}`, { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' }, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error('ADMIN_RELEASE_PROTECTION_REQUEST_FAILED')
  return response.json()
}
const [environment, policies, main] = await Promise.all([get('/environments/Production'), get('/environments/Production/deployment-branch-policies'), get('/commits/main')])
verifyAdminProductionProtection(environment, policies)
if (main.sha !== process.env.SOURCE_SHA) throw new Error('ADMIN_RELEASE_MAIN_CHANGED')
process.stdout.write('ADMIN_RELEASE_PROTECTION_VERIFIED\n')
