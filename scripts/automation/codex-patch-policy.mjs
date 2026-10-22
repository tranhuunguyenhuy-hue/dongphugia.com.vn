import { isAllowedPath } from './codex-dispatch-preflight.mjs'

const MAX_PATCH_BYTES = 1024 * 1024
const MAX_FILES = 50

function pathMatchesScope(path, allowedPath) {
  return allowedPath.endsWith('/') ? path.startsWith(allowedPath) : path === allowedPath
}

export function validatePatchText(patch, task) {
  if (typeof patch !== 'string' || Buffer.byteLength(patch) > MAX_PATCH_BYTES) {
    throw new Error('PATCH_SIZE_INVALID')
  }
  if (
    patch.includes('GIT binary patch') ||
    /(?:^|\n)(?:new file mode|deleted file mode|old mode|new mode) (?:120000|160000)(?:\n|$)/.test(
      patch,
    )
  ) {
    throw new Error('PATCH_CONTENT_INVALID')
  }

  const files = []
  for (const line of patch.split('\n')) {
    if (!line.startsWith('diff --git ')) continue
    const match = /^diff --git a\/([^\s]+) b\/([^\s]+)$/.exec(line)
    if (!match || match[1] !== match[2]) {
      throw new Error('PATCH_PATH_INVALID')
    }
    files.push(match[1])
  }

  if (files.length === 0 || files.length > MAX_FILES || new Set(files).size !== files.length) {
    throw new Error('PATCH_FILE_COUNT_INVALID')
  }
  if (!files.every(isAllowedPath)) {
    throw new Error('PATCH_PROTECTED_PATH')
  }
  if (
    !files.every((file) =>
      task.allowed_paths.some((allowedPath) => pathMatchesScope(file, allowedPath)),
    )
  ) {
    throw new Error('PATCH_OUTSIDE_AUTHORIZED_SCOPE')
  }

  return files
}
