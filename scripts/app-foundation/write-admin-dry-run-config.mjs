import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildAdminWranglerConfig } from './prepare-admin-release.mjs'
const root = process.argv[2]
if (!root) throw new Error('ADMIN_RELEASE_DRY_RUN_INPUT_INVALID')
await writeFile(path.join(root, 'trusted-dry-run.json'), JSON.stringify(buildAdminWranglerConfig('0'.repeat(32))), { flag: 'wx', mode: 0o600 })
