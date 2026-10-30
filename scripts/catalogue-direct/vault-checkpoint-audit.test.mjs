// @vitest-environment node
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { it } from 'vitest'
import {
  auditCheckpointVault, formatAuditSummary, runAuditCli,
} from './vault-checkpoint-audit.mjs'
import { CHECKPOINT_CEILING, CONTRACT, RECOVERY_ID, SOURCE, TARGET } from './contract.mjs'

const OWNER = 'tranhuunguyenhuy-hue'
const REPOSITORY = `${OWNER}/private-checkpoint-fixture`
const TOKEN_SENTINEL = 'fixture-token-must-not-be-logged'
const PART_BYTES = 16_000_000
const SHA = (character) => character.repeat(40)
const HASH = (character) => character.repeat(64)

function makeCheckpoint({ partSizes = [PART_BYTES, 3], treeSizeAdjustment = 0, receiptSizeOverride } = {}) {
  const receipt = {
    contract: CONTRACT,
    recoveryId: RECOVERY_ID,
    kind: 'source',
    source: SOURCE,
    target: TARGET,
    codeSha: SHA('a'),
    bytes: partSizes.reduce((sum, value) => sum + value, 0),
    hash: HASH('b'),
    parts: partSizes.map((bytes, index) => ({
      path: `${String(index).padStart(4, '0')}.agepart`, bytes, hash: HASH(String(index + 1)),
    })),
  }
  const receiptBytes = Buffer.from(JSON.stringify(receipt))
  const receiptSha = SHA('c')
  const partShas = partSizes.map((_, index) => SHA(String(index + 2)))
  return {
    receipt,
    receiptSha,
    receiptBytes,
    receiptSizeOverride,
    refSha: SHA('d'),
    treeSha: SHA('e'),
    tree: [
      { path: 'receipt.json', mode: '100644', type: 'blob', sha: receiptSha, size: receiptSizeOverride ?? receiptBytes.length },
      ...partSizes.map((size, index) => ({
        path: receipt.parts[index].path,
        mode: '100644',
        type: 'blob',
        sha: partShas[index],
        size: size + (index === 0 ? treeSizeAdjustment : 0),
      })),
    ],
    partShas,
  }
}

function makeFixture({ checkpoint = makeCheckpoint(), privateRepo = true, refs, secondPage = [] } = {}) {
  const matchingRefs = refs ?? [{
    ref: `refs/heads/direct-${RECOVERY_ID}-source`,
    object: { type: 'commit', sha: checkpoint.refSha },
  }]
  const calls = []
  const fetchImpl = async (input, options) => {
    const url = new URL(input)
    calls.push({ url, options })
    const base = `/repos/${REPOSITORY}`
    assert.equal(url.origin, 'https://api.github.com')
    assert.ok(url.pathname.startsWith(base))
    const apiPath = url.pathname.slice(base.length) + url.search
    let payload
    if (apiPath === '') payload = { private: privateRepo, owner: { login: OWNER } }
    else if (apiPath.includes('/git/matching-refs/')) payload = Number(url.searchParams.get('page')) === 2 ? secondPage : matchingRefs
    else if (apiPath === `/git/commits/${checkpoint.refSha}`) {
      payload = { sha: checkpoint.refSha, tree: { sha: checkpoint.treeSha }, parents: [] }
    } else if (apiPath === `/git/trees/${checkpoint.treeSha}?recursive=1`) {
      payload = { truncated: false, tree: checkpoint.tree }
    } else if (apiPath === `/git/blobs/${checkpoint.receiptSha}`) {
      payload = {
        sha: checkpoint.receiptSha,
        size: checkpoint.receiptSizeOverride ?? checkpoint.receiptBytes.length,
        encoding: 'base64',
        content: checkpoint.receiptBytes.toString('base64'),
      }
    } else {
      assert.fail(`Unexpected API endpoint ${apiPath}`)
    }
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return { calls, fetchImpl, refs: matchingRefs, checkpoint }
}

function runnerEnv(extra = {}) {
  return {
    GITHUB_ACTIONS: 'true',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_REPOSITORY: `${OWNER}/dongphugia.com.vn`,
    GITHUB_REF: 'refs/heads/main',
    GITHUB_ACTOR: OWNER,
    GITHUB_RUN_ATTEMPT: '1',
    GITHUB_SHA: SHA('f'),
    DIRECT_VAULT_REPOSITORY: REPOSITORY,
    DIRECT_VAULT_TOKEN: TOKEN_SENTINEL,
    ...extra,
  }
}

it('inventories payload bytes from receipt and Git tree metadata using GET only', async () => {
  const fixture = makeFixture()
  const report = await auditCheckpointVault({
    repository: REPOSITORY,
    token: TOKEN_SENTINEL,
    fetchImpl: fixture.fetchImpl,
  })

  assert.deepEqual(report, {
    status: 'PASS',
    checkpointCount: 1,
    verifiedCheckpointPayloadBytes: PART_BYTES + 3,
    internalCheckpointCapBytes: CHECKPOINT_CEILING,
    internalCheckpointCapBytesRemaining: CHECKPOINT_CEILING - PART_BYTES - 3,
    vaultFreeBytes: null,
    vaultFreeBytesStatus: 'NOT_EXPOSED_BY_GITHUB_API',
  })
  assert.ok(fixture.calls.length >= 4)
  assert.ok(fixture.calls.every(({ options }) => options.method === 'GET' && options.body === undefined))
  assert.ok(fixture.calls.every(({ options }) => options.headers.Authorization === `Bearer ${TOKEN_SENTINEL}`))
  const blobCalls = fixture.calls.filter(({ url }) => url.pathname.includes('/git/blobs/'))
  assert.deepEqual(blobCalls.map(({ url }) => url.pathname.split('/').at(-1)), [fixture.checkpoint.receiptSha])
  assert.equal(fixture.calls.some(({ url }) => fixture.checkpoint.partShas.includes(url.pathname.split('/').at(-1))), false)
  assert.equal(fixture.calls.some(({ url }) => url.href.includes('.agepart')), false)
})

it('summary reports internal cap separately and leaves actual free bytes unknown', () => {
  const summary = formatAuditSummary({ checkpointCount: 2, verifiedCheckpointPayloadBytes: 1234, internalCheckpointCapBytesRemaining: 199998766 })
  assert.match(summary, /Verified checkpoint payload bytes .*: 1234/)
  assert.match(summary, /Actual vault free bytes: UNKNOWN/)
  assert.match(summary, /ciphertext part contents were not downloaded/)
  assert.doesNotMatch(summary, /private-checkpoint-fixture|\.agepart|receipt\.json/)
})

it('rejects a public vault without revealing the configured repository or token', async () => {
  const fixture = makeFixture({ privateRepo: false })
  const stdout = []
  const stderr = []
  const result = await runAuditCli({
    env: runnerEnv(), fetchImpl: fixture.fetchImpl,
    stdout: (line) => stdout.push(line), stderr: (line) => stderr.push(line),
  })
  assert.equal(result, 1)
  assert.deepEqual(stdout, [])
  assert.deepEqual(stderr, ['VAULT_AUDIT_FAIL OWNER_PRIVATE_VAULT_REQUIRED'])
  assert.equal(stderr.join('\n').includes(REPOSITORY), false)
  assert.equal(stderr.join('\n').includes(TOKEN_SENTINEL), false)
})

it('rejects dot-segment repository names before constructing API requests', async () => {
  const fixture = makeFixture()
  await assert.rejects(
    auditCheckpointVault({ repository: `${OWNER}/..`, token: TOKEN_SENTINEL, fetchImpl: fixture.fetchImpl }),
    /VAULT_CONFIGURATION/,
  )
  assert.equal(fixture.calls.length, 0)
})

it('fails closed when inventory exceeds the existing 100-ref bound', async () => {
  const refs = Array.from({ length: 100 }, (_, index) => ({
    ref: `refs/heads/direct-${RECOVERY_ID}-checkpoint-${String(index).padStart(3, '0')}`,
    object: { type: 'commit', sha: SHA(index.toString(16).padStart(1, '0').slice(-1)) },
  }))
  const fixture = makeFixture({ refs, secondPage: [{ ref: `refs/heads/direct-${RECOVERY_ID}-overflow`, object: { type: 'commit', sha: SHA('1') } }] })
  await assert.rejects(
    auditCheckpointVault({ repository: REPOSITORY, token: TOKEN_SENTINEL, fetchImpl: fixture.fetchImpl }),
    /CHECKPOINT_REF_LIMIT/,
  )
  assert.equal(fixture.calls.filter(({ url }) => url.pathname.includes('/git/commits/')).length, 0)
})

it('rejects receipt sizes that disagree with Git tree blob metadata', async () => {
  const fixture = makeFixture({ checkpoint: makeCheckpoint({ treeSizeAdjustment: 1 }) })
  await assert.rejects(
    auditCheckpointVault({ repository: REPOSITORY, token: TOKEN_SENTINEL, fetchImpl: fixture.fetchImpl }),
    /CHECKPOINT_PART_SIZE_MISMATCH/,
  )
})

it('rejects oversized receipt metadata before downloading its blob', async () => {
  const fixture = makeFixture({ checkpoint: makeCheckpoint({ receiptSizeOverride: 65_537 }) })
  await assert.rejects(
    auditCheckpointVault({ repository: REPOSITORY, token: TOKEN_SENTINEL, fetchImpl: fixture.fetchImpl }),
    /CHECKPOINT_RECEIPT_SIZE/,
  )
  assert.equal(fixture.calls.some(({ url }) => url.pathname.includes('/git/blobs/')), false)
})

it('fails closed outside the exact owner-only first-attempt main dispatch', async () => {
  const fixture = makeFixture()
  const stderr = []
  const result = await runAuditCli({
    env: runnerEnv({ GITHUB_RUN_ATTEMPT: '2' }), fetchImpl: fixture.fetchImpl,
    stderr: (line) => stderr.push(line), stdout: () => assert.fail('must not report'),
  })
  assert.equal(result, 1)
  assert.deepEqual(stderr, ['VAULT_AUDIT_FAIL AUDIT_EXECUTION_AUTHORITY'])
  assert.equal(fixture.calls.length, 0)
})

it('sanitizes network exceptions before writing logs', async () => {
  const sentinel = `${REPOSITORY} ${TOKEN_SENTINEL} ${SHA('a')}`
  const stderr = []
  const result = await runAuditCli({
    env: runnerEnv(), fetchImpl: async () => { throw new Error(sentinel) },
    stderr: (line) => stderr.push(line), stdout: () => assert.fail('must not report'),
  })
  assert.equal(result, 1)
  assert.deepEqual(stderr, ['VAULT_AUDIT_FAIL VAULT_API_UNAVAILABLE'])
  assert.equal(stderr.join('\n').includes(sentinel), false)
})

it('bounds every GitHub API response before JSON parsing', async () => {
  const stderr = []
  const result = await runAuditCli({
    env: runnerEnv(),
    fetchImpl: async () => new Response('x'.repeat(1_048_577), { status: 200 }),
    stderr: (line) => stderr.push(line), stdout: () => assert.fail('must not report'),
  })
  assert.equal(result, 1)
  assert.deepEqual(stderr, ['VAULT_AUDIT_FAIL VAULT_API_RESPONSE_TOO_LARGE'])
})

it('workflow is manual-only, pinned, read-scoped, Environment-bound and secret-scoped to the audit step', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/catalogue-checkpoint-vault-audit.yml', import.meta.url), 'utf8')
  assert.match(workflow, /^on:\n  workflow_dispatch:\s*$/m)
  assert.doesNotMatch(workflow, /^\s*(?:push|pull_request|pull_request_target|schedule|workflow_run):/m)
  assert.match(workflow, /permissions:\n  contents: read/)
  assert.match(workflow, /environment: catalogue-direct-migration/)
  assert.match(workflow, /group: catalogue-direct-migration/)
  assert.match(workflow, /persist-credentials: false/)
  assert.match(workflow, /run:\s*\|[\s\S]*?node scripts\/catalogue-direct\/vault-checkpoint-audit\.mjs/)
  assert.equal((workflow.match(/secrets\.DIRECT_VAULT_REPOSITORY/g) ?? []).length, 1)
  assert.equal((workflow.match(/secrets\.DIRECT_VAULT_TOKEN/g) ?? []).length, 1)
  assert.match(workflow, /- name: Read-only protected checkpoint inventory[\s\S]*?DIRECT_VAULT_REPOSITORY:[^\n]+\n\s+DIRECT_VAULT_TOKEN:/)
  assert.doesNotMatch(workflow, /actions\/upload-artifact|CLOUDFLARE|SUPABASE|DIRECT_SOURCE_DATABASE_URL|DIRECT_TARGET_IMPORT_DATABASE_URL|run\.mjs/)
})
