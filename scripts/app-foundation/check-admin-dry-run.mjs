import { readdir, access } from 'node:fs/promises'
import path from 'node:path'

const [root, output] = process.argv.slice(2)
if (!root || !output) throw new Error('ADMIN_RELEASE_DRY_RUN_INPUT_INVALID')
async function files(dir, prefix = '') {
  const result = []
  for (const entry of await readdir(path.join(dir, prefix), { withFileTypes: true })) {
    const child = path.join(prefix, entry.name)
    if (entry.isSymbolicLink()) throw new Error('ADMIN_RELEASE_DRY_RUN_SYMLINK')
    if (entry.isDirectory()) result.push(...await files(dir, child))
    else if (entry.isFile()) result.push(child.split(path.sep).join('/'))
    else throw new Error('ADMIN_RELEASE_DRY_RUN_ENTRY_INVALID')
  }
  return result
}
const generated = await files(output)
if (generated.some((file) => file.startsWith('assets/'))) throw new Error('ADMIN_RELEASE_ASSET_ATTACHED_AS_MODULE')
for (const side of ['public', 'admin']) {
  const dir = path.join(root, 'combined', side, 'server')
  for (const file of await files(dir)) {
    if (/\.(?:mjs|js|cjs|wasm|txt|bin)$/i.test(file)) {
      try { await access(path.join(output, side, 'server', file)) } catch { throw new Error('ADMIN_RELEASE_MODULE_MISSING_FROM_DRY_RUN') }
    }
  }
}
process.stdout.write('ADMIN_RELEASE_DRY_RUN_MODULES_VERIFIED\n')
