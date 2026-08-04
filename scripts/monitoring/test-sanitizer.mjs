#!/usr/bin/env node

import assert from 'node:assert/strict'
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = path.resolve(new URL('../..', import.meta.url).pathname)
const collector = path.join(root, 'infra/monitoring/sanitize-docker-observation.sh')
const sandbox = await mkdtemp(path.join(tmpdir(), 'dpg-monitor-sanitizer-'))
const bin = path.join(sandbox, 'bin')
const output = path.join(sandbox, 'aggregate.jsonl')
const missingOutput = path.join(sandbox, 'missing.jsonl')

try {
  await mkdir(bin)
  const fakeDocker = `#!/bin/sh
case "$1" in
  inspect)
    [ "$2" = "app" ]
    ;;
  logs)
    printf '%s\\n' \
      'request status 500' \
      'Prisma database error' \
      'TLS certificate handshake' \
      'OOM killed process' \
      'health check failed' \
      'RAW_TEST_MARKER_DO_NOT_FORWARD'
    ;;
  *)
    exit 1
    ;;
esac
`
  const dockerPath = path.join(bin, 'docker')
  await writeFile(dockerPath, fakeDocker, 'utf8')
  await chmod(dockerPath, 0o755)

  const baseEnv = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH || ''}`,
    DPG_MONITOR_WINDOW_SECONDS: '90',
  }
  const observed = spawnSync('sh', [collector], {
    env: { ...baseEnv, DPG_MONITOR_CONTAINERS: 'app', DPG_MONITOR_OUTPUT: output },
    encoding: 'utf8',
  })
  assert.equal(observed.status, 0)

  const runtimeRecord = JSON.parse((await readFile(output, 'utf8')).trim())
  assert.equal(runtimeRecord.event, 'runtime_observation')
  assert.equal(runtimeRecord.container_count, 1)
  assert.equal(runtimeRecord.missing_container_count, 0)
  assert.equal(runtimeRecord.http_5xx_count, 1)
  assert.equal(runtimeRecord.db_error_count, 1)
  assert.equal(runtimeRecord.tls_error_count, 1)
  assert.equal(runtimeRecord.oom_count, 1)
  assert.equal(runtimeRecord.health_failure_count, 1)
  assert.equal(JSON.stringify(runtimeRecord).includes('RAW_TEST_MARKER_DO_NOT_FORWARD'), false)

  const missing = spawnSync('sh', [collector], {
    env: { ...baseEnv, DPG_MONITOR_CONTAINERS: 'missing', DPG_MONITOR_OUTPUT: missingOutput },
    encoding: 'utf8',
  })
  assert.equal(missing.status, 2)
  const missingRecord = JSON.parse((await readFile(missingOutput, 'utf8')).trim())
  assert.equal(missingRecord.event, 'monitoring_configuration_missing')
  assert.equal(missingRecord.container_count, 1)
  assert.equal(missingRecord.missing_container_count, 1)

  console.log(JSON.stringify({ ok: true, cases: ['aggregate_only', 'missing_allowlist_target'] }))
} finally {
  await rm(sandbox, { recursive: true, force: true })
}
