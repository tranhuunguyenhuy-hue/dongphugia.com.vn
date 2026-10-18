#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'

const [dispatchPath, outputPath] = process.argv.slice(2)
if (!dispatchPath || !outputPath) {
  throw new Error('Usage: codex-build-prompt.mjs <dispatch.json> <output.md>')
}

const dispatch = JSON.parse(await readFile(dispatchPath, 'utf8'))
const task = dispatch.task

const prompt = `# Validated source-only GitHub task

Dispatch ID: ${dispatch.dispatch_id}
Issue: #${dispatch.issue_number}
Base commit: ${dispatch.base_sha}

## Task

${task.task}

## Acceptance

${task.acceptance.map((item) => `- ${item}`).join('\n')}

## Authorized paths

${task.allowed_paths.map((item) => `- \`${item}\``).join('\n')}

## Non-negotiable controls

- Edit only the authorized paths above. Do not alter workflows, agent authority files, dispatcher code, backup/offline-rehearsal code, or any external system.
- Source-only: no deploy, merge, remote mutation, secret access, backup access, infrastructure action, Production action, or paid-service action.
- Do not commit, push, create a pull request, or post to GitHub. A separate deterministic publisher owns those writes.
- Do not use sudo or Docker. Keep all edits inside the workspace-write sandbox.
- Run focused local tests that do not need secrets or external services. Report every unrun check as UNKNOWN.
- Finish with a concise summary of changed files, tests, exclusions, remaining risk, and the next approval gate.
`

await writeFile(outputPath, prompt, { mode: 0o600 })
