#!/usr/bin/env node

import { appendFile, readFile } from 'node:fs/promises'

import { validateDispatchEvent } from './codex-dispatch-preflight.mjs'

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`REQUIRED_ENV_MISSING:${name}`)
  return value
}

const apiUrl = required('GITHUB_API_URL').replace(/\/$/, '')
const token = required('GITHUB_TOKEN')
const event = JSON.parse(await readFile(required('GITHUB_EVENT_PATH'), 'utf8'))

async function githubApi(path) {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  return { status: response.status, data }
}

const dispatch = await validateDispatchEvent({
  event,
  githubApi,
  repository: required('GITHUB_REPOSITORY'),
  repositoryId: Number(required('EXPECTED_REPOSITORY_ID')),
  ref: required('GITHUB_REF'),
  sha: required('GITHUB_SHA'),
})

const output = process.env.GITHUB_OUTPUT
if (output) {
  await appendFile(
    output,
    [
      `issue_number=${dispatch.issue_number}`,
      `source_comment_id=${dispatch.source_comment_id}`,
      `base_sha=${dispatch.base_sha}`,
      `branch=${dispatch.branch}`,
      `dispatch_id=${dispatch.dispatch_id}`,
      '',
    ].join('\n'),
  )
}

process.stdout.write(`${JSON.stringify(dispatch, null, 2)}\n`)
