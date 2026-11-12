import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const NAMESPACE = 'dpg-rsc0'
const GLOBALS = [
  '__vite_rsc_client_require__',
  '__vite_rsc_require__',
  '__vite_rsc_server_require__',
]

function fail(code) {
  throw new Error(code)
}

async function visit(root, relative, replacements) {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true })
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const child = path.join(relative, entry.name)
    const file = path.join(root, child)
    if (entry.isSymbolicLink()) fail('ADMIN_VITE_RSC_NAMESPACE_SYMLINK_FORBIDDEN')
    if (entry.isDirectory()) {
      await visit(root, child, replacements)
      continue
    }
    if (!entry.isFile() || !/\.(?:m?js)$/.test(entry.name)) continue

    const original = await readFile(file, 'utf8')
    let transformed = original
    for (const globalName of GLOBALS) {
      const matches = original.match(new RegExp(globalName, 'g')) ?? []
      if (matches.length === 0) continue
      replacements[globalName] += matches.length
      // Keep the generated identifier width unchanged so its existing source
      // map column offsets remain valid.
      transformed = transformed.replaceAll(globalName, globalName.replace('__vite_rsc_', '__dpg_rsc0_'))
    }
    if (transformed !== original) await writeFile(file, transformed, 'utf8')
  }
}

/**
 * Give the Admin app its own Vite RSC loader globals before the Public and
 * Admin bundles are evaluated in one Worker isolate. Both frameworks register
 * these names on globalThis; without separate names the last app request
 * replaces the loader used by the other app's cached entrypoint.
 */
export async function namespaceAdminViteRscGlobals(roots) {
  const replacements = Object.fromEntries(GLOBALS.map((name) => [name, 0]))
  if (!Array.isArray(roots) || roots.length === 0) fail('ADMIN_VITE_RSC_NAMESPACE_ROOTS_REQUIRED')
  for (const root of roots) await visit(path.resolve(root), '', replacements)
  if (GLOBALS.some((name) => replacements[name] === 0)) fail('ADMIN_VITE_RSC_RUNTIME_GLOBAL_MISSING')
  return {
    namespace: NAMESPACE,
    globals: GLOBALS.map((name) => name.replace('__vite_rsc_', '__dpg_rsc0_')),
    replacements,
  }
}
