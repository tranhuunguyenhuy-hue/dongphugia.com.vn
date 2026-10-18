#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'

const [dispatchPath, titlePath, bodyPath] = process.argv.slice(2)
if (!dispatchPath || !titlePath || !bodyPath) {
  throw new Error(
    'Usage: codex-publish-metadata.mjs <dispatch.json> <title.txt> <body.md>',
  )
}

const dispatch = JSON.parse(await readFile(dispatchPath, 'utf8'))
const title = `codex: ${dispatch.task.title}`.slice(0, 100).replace(/[\r\n]/g, ' ')
const runUrl = process.env.DISPATCH_RUN_URL || 'UNKNOWN'
const body = `## Automated source-only draft

Implements the validated task from #${dispatch.issue_number}, comment ${dispatch.source_comment_id}.

- Dispatch ID: \`${dispatch.dispatch_id}\`
- Exact base: \`${dispatch.base_sha}\`
- Workflow evidence: ${runUrl}
- Production: **not authorized**
- Merge: **Owner approval required**

The Codex executor had no GitHub write token. A separate deterministic publisher validated the patch scope and opened this draft PR. Required CI and human review remain independent gates.
`

await writeFile(titlePath, `${title}\n`, { mode: 0o600 })
await writeFile(bodyPath, body, { mode: 0o600 })
