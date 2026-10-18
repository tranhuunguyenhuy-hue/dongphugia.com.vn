import { describe, expect, it } from 'vitest'

import { validatePatchText } from './codex-patch-policy.mjs'

describe('Codex publisher patch policy', () => {
  it('accepts a bounded text patch confined to the authorized source paths', () => {
    const patch = `diff --git a/docs/agents/example.md b/docs/agents/example.md
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/docs/agents/example.md
@@ -0,0 +1 @@
+safe source-only change
`

    expect(
      validatePatchText(patch, {
        allowed_paths: ['docs/agents/'],
      }),
    ).toEqual(['docs/agents/example.md'])
  })

  it('rejects symlink changes even when their path is otherwise authorized', () => {
    const patch = `diff --git a/docs/agents/link b/docs/agents/link
deleted file mode 120000
index 1111111..0000000
--- a/docs/agents/link
+++ /dev/null
@@ -1 +0,0 @@
-../../AGENTS.md
`

    expect(() =>
      validatePatchText(patch, { allowed_paths: ['docs/agents/'] }),
    ).toThrowError('PATCH_CONTENT_INVALID')
  })

  it('rejects gitlink and submodule changes inside an authorized directory', () => {
    const patch = `diff --git a/docs/agents/vendor b/docs/agents/vendor
new file mode 160000
index 0000000..1111111
--- /dev/null
+++ b/docs/agents/vendor
@@ -0,0 +1 @@
+Subproject commit 1111111111111111111111111111111111111111
`

    expect(() =>
      validatePatchText(patch, { allowed_paths: ['docs/agents/'] }),
    ).toThrowError('PATCH_CONTENT_INVALID')
  })

  it('rejects a protected file even if a forged task scope contains its parent', () => {
    const patch = `diff --git a/docs/deploy/offline-catalogue-rehearsal.md b/docs/deploy/offline-catalogue-rehearsal.md
index 1111111..2222222 100644
--- a/docs/deploy/offline-catalogue-rehearsal.md
+++ b/docs/deploy/offline-catalogue-rehearsal.md
@@ -1 +1 @@
-protected
+tampered
`

    expect(() =>
      validatePatchText(patch, { allowed_paths: ['docs/deploy/'] }),
    ).toThrowError('PATCH_PROTECTED_PATH')
  })
})
