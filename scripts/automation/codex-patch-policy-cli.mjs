#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

import { validatePatchText } from './codex-patch-policy.mjs'

const [dispatchPath, patchPath] = process.argv.slice(2)
if (!dispatchPath || !patchPath) {
  throw new Error('Usage: codex-patch-policy-cli.mjs <dispatch.json> <codex.patch>')
}

const dispatch = JSON.parse(await readFile(dispatchPath, 'utf8'))
const patch = await readFile(patchPath, 'utf8')
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

if (head !== dispatch.base_sha) {
  throw new Error('PATCH_BASE_SHA_MISMATCH')
}

const files = validatePatchText(patch, dispatch.task)
process.stdout.write(`${JSON.stringify({ base_sha: head, files })}\n`)
