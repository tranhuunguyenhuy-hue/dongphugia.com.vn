import { appendFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  CHECKPOINT_CEILING, CONTRACT, HASH, RECOVERY_ID, SHA, SOURCE, TARGET,
} from './contract.mjs'

const API_ROOT = 'https://api.github.com/repos/'
const EXPECTED_OWNER = 'tranhuunguyenhuy-hue'
const EXPECTED_REPOSITORY = 'tranhuunguyenhuy-hue/dongphugia.com.vn'
const PART_BYTES = 16_000_000
const MAX_PARTS = 13
const MAX_REFS = 100
const MAX_RECEIPT_BYTES = 65_536
const MAX_API_RESPONSE_BYTES = 1_048_576
const REF_PREFIX = `refs/heads/direct-${RECOVERY_ID}-`

class AuditError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

function requireAudit(condition, code) {
  if (!condition) throw new AuditError(code)
}

function safeAdd(left, right, code) {
  const sum = left + right
  requireAudit(Number.isSafeInteger(sum), code)
  return sum
}

function validateRepository(repository) {
  requireAudit(typeof repository === 'string'
    && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)
    && repository.split('/')[0] === EXPECTED_OWNER
    && !['.', '..'].includes(repository.split('/')[1]), 'VAULT_CONFIGURATION')
  return repository
}

function validateRunner(env) {
  requireAudit(env.GITHUB_ACTIONS === 'true'
    && env.GITHUB_EVENT_NAME === 'workflow_dispatch'
    && env.GITHUB_REPOSITORY === EXPECTED_REPOSITORY
    && env.GITHUB_REF === 'refs/heads/main'
    && env.GITHUB_ACTOR === EXPECTED_OWNER
    && env.GITHUB_RUN_ATTEMPT === '1'
    && SHA.test(env.GITHUB_SHA ?? ''), 'AUDIT_EXECUTION_AUTHORITY')
}

async function getJson(fetchImpl, repository, token, path) {
  let response
  try {
    response = await fetchImpl(`${API_ROOT}${repository}${path}`, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
  } catch {
    throw new AuditError('VAULT_API_UNAVAILABLE')
  }
  requireAudit(response?.ok === true, 'VAULT_API_RESPONSE_INVALID')
  const contentLength = response.headers?.get?.('content-length')
  if (contentLength !== null && contentLength !== undefined) {
    const declaredLength = Number(contentLength)
    requireAudit(Number.isSafeInteger(declaredLength) && declaredLength >= 0
      && declaredLength <= MAX_API_RESPONSE_BYTES, 'VAULT_API_RESPONSE_TOO_LARGE')
  }
  const reader = response.body?.getReader?.()
  requireAudit(reader, 'VAULT_API_RESPONSE_INVALID')
  const chunks = []
  let totalBytes = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes = safeAdd(totalBytes, value.byteLength, 'VAULT_API_RESPONSE_TOO_LARGE')
      if (totalBytes > MAX_API_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {})
        throw new AuditError('VAULT_API_RESPONSE_TOO_LARGE')
      }
      chunks.push(Buffer.from(value))
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, totalBytes)))
  } catch (error) {
    if (error instanceof AuditError) throw error
    throw new AuditError('VAULT_API_RESPONSE_INVALID')
  }
}

async function listCheckpointRefs(fetchImpl, repository, token) {
  const endpoint = `/git/matching-refs/heads/direct-${RECOVERY_ID}-`
  const firstPage = await getJson(fetchImpl, repository, token, `${endpoint}?per_page=${MAX_REFS}&page=1`)
  requireAudit(Array.isArray(firstPage) && firstPage.length <= MAX_REFS, 'CHECKPOINT_REF_LIST_INVALID')
  if (firstPage.length === MAX_REFS) {
    const secondPage = await getJson(fetchImpl, repository, token, `${endpoint}?per_page=${MAX_REFS}&page=2`)
    requireAudit(Array.isArray(secondPage) && secondPage.length === 0, 'CHECKPOINT_REF_LIMIT')
  }

  const seen = new Set()
  for (const item of firstPage) {
    requireAudit(typeof item?.ref === 'string' && item.ref.startsWith(REF_PREFIX)
      && /^[A-Za-z0-9-]{1,100}$/.test(item.ref.slice(REF_PREFIX.length))
      && !seen.has(item.ref)
      && item.object?.type === 'commit' && SHA.test(item.object.sha ?? ''), 'CHECKPOINT_REF_INVALID')
    seen.add(item.ref)
  }
  return firstPage
}

function decodeReceiptBlob(blob, expectedSize) {
  requireAudit(blob?.encoding === 'base64' && typeof blob.content === 'string'
    && Number.isSafeInteger(blob.size) && blob.size === expectedSize
    && blob.size > 0 && blob.size <= MAX_RECEIPT_BYTES, 'CHECKPOINT_RECEIPT_SIZE')
  const compact = blob.content.replace(/\s/g, '')
  requireAudit(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(compact),
    'CHECKPOINT_RECEIPT_ENCODING')
  const bytes = Buffer.from(compact, 'base64')
  requireAudit(bytes.length === expectedSize && bytes.toString('base64') === compact, 'CHECKPOINT_RECEIPT_SIZE')
  try {
    return JSON.parse(bytes.toString('utf8'))
  } catch {
    throw new AuditError('CHECKPOINT_RECEIPT_INVALID')
  }
}

function validateReceipt(receipt, entries) {
  requireAudit(receipt?.contract === CONTRACT && receipt.recoveryId === RECOVERY_ID
    && receipt.source === SOURCE && receipt.target === TARGET
    && ['source', 'target-before'].includes(receipt.kind)
    && SHA.test(receipt.codeSha ?? '') && HASH.test(receipt.hash ?? '')
    && Number.isSafeInteger(receipt.bytes) && receipt.bytes > 0
    && receipt.bytes <= CHECKPOINT_CEILING
    && Array.isArray(receipt.parts) && receipt.parts.length > 0 && receipt.parts.length <= MAX_PARTS,
  'CHECKPOINT_RECEIPT_INVALID')

  const kindCeiling = receipt.kind === 'source' ? 190_000_000 : 10_000_000
  requireAudit(receipt.bytes <= kindCeiling
    && receipt.parts.length === Math.ceil(receipt.bytes / PART_BYTES), 'CHECKPOINT_RECEIPT_CAPACITY')

  let partBytes = 0
  for (const [index, part] of receipt.parts.entries()) {
    requireAudit(part?.path === `${String(index).padStart(4, '0')}.agepart`
      && Number.isSafeInteger(part.bytes) && part.bytes > 0 && part.bytes <= PART_BYTES
      && HASH.test(part.hash ?? ''), 'CHECKPOINT_PART_INVALID')
    if (index < receipt.parts.length - 1) requireAudit(part.bytes === PART_BYTES, 'CHECKPOINT_PART_INVALID')
    const entry = entries.find((candidate) => candidate.path === part.path)
    requireAudit(entry?.type === 'blob' && entry.mode === '100644' && SHA.test(entry.sha ?? '')
      && Number.isSafeInteger(entry.size) && entry.size === part.bytes, 'CHECKPOINT_PART_SIZE_MISMATCH')
    partBytes = safeAdd(partBytes, part.bytes, 'CHECKPOINT_RECEIPT_INVALID')
  }
  requireAudit(partBytes === receipt.bytes, 'CHECKPOINT_RECEIPT_INVALID')
  return receipt.bytes
}

async function inventoryCheckpoint(fetchImpl, repository, token, ref) {
  const sha = ref.object.sha
  const commit = await getJson(fetchImpl, repository, token, `/git/commits/${sha}`)
  requireAudit(commit?.sha === sha && SHA.test(commit.tree?.sha ?? '')
    && Array.isArray(commit.parents) && commit.parents.length === 0, 'CHECKPOINT_COMMIT_INVALID')
  const tree = await getJson(fetchImpl, repository, token, `/git/trees/${commit.tree.sha}?recursive=1`)
  requireAudit(tree?.truncated === false && Array.isArray(tree.tree)
    && tree.tree.length >= 2 && tree.tree.length <= MAX_PARTS + 1, 'CHECKPOINT_TREE_INVALID')
  const paths = new Set()
  for (const entry of tree.tree) {
    requireAudit(typeof entry?.path === 'string' && !paths.has(entry.path), 'CHECKPOINT_TREE_INVALID')
    paths.add(entry.path)
  }
  const receiptEntries = tree.tree.filter((entry) => entry.path === 'receipt.json' && entry.type === 'blob')
  const partEntries = tree.tree.filter((entry) => /^\d{4}\.agepart$/.test(entry.path) && entry.type === 'blob')
  requireAudit(receiptEntries.length === 1 && partEntries.length === tree.tree.length - 1
    && partEntries.length > 0, 'CHECKPOINT_TREE_INVALID')
  const receiptEntry = receiptEntries[0]
  requireAudit(Number.isSafeInteger(receiptEntry.size) && receiptEntry.size > 0
    && receiptEntry.size <= MAX_RECEIPT_BYTES && SHA.test(receiptEntry.sha ?? ''), 'CHECKPOINT_RECEIPT_SIZE')

  // Read only the small receipt blob. Ciphertext part blobs are never requested.
  const blob = await getJson(fetchImpl, repository, token, `/git/blobs/${receiptEntry.sha}`)
  const receipt = decodeReceiptBlob(blob, receiptEntry.size)
  const bytes = validateReceipt(receipt, tree.tree)
  requireAudit(partEntries.length === receipt.parts.length, 'CHECKPOINT_TREE_INVALID')
  return bytes
}

export async function auditCheckpointVault({ repository, token, fetchImpl = globalThis.fetch }) {
  repository = validateRepository(repository)
  requireAudit(typeof token === 'string' && token.length > 0 && token.trim() === token,
    'VAULT_CREDENTIALS_REQUIRED')
  requireAudit(typeof fetchImpl === 'function', 'VAULT_API_UNAVAILABLE')

  const metadata = await getJson(fetchImpl, repository, token, '')
  requireAudit(metadata?.private === true && metadata.owner?.login === EXPECTED_OWNER,
    'OWNER_PRIVATE_VAULT_REQUIRED')
  const refs = await listCheckpointRefs(fetchImpl, repository, token)
  let verifiedCheckpointPayloadBytes = 0
  for (const ref of refs) {
    const bytes = await inventoryCheckpoint(fetchImpl, repository, token, ref)
    verifiedCheckpointPayloadBytes = safeAdd(verifiedCheckpointPayloadBytes, bytes, 'CHECKPOINT_TOTAL_INVALID')
  }
  requireAudit(verifiedCheckpointPayloadBytes <= CHECKPOINT_CEILING, 'CHECKPOINT_CAPACITY_EXCEEDED')

  return {
    status: 'PASS',
    checkpointCount: refs.length,
    verifiedCheckpointPayloadBytes,
    internalCheckpointCapBytes: CHECKPOINT_CEILING,
    internalCheckpointCapBytesRemaining: CHECKPOINT_CEILING - verifiedCheckpointPayloadBytes,
    vaultFreeBytes: null,
    vaultFreeBytesStatus: 'NOT_EXPOSED_BY_GITHUB_API',
  }
}

export function formatAuditSummary(report) {
  return [
    '### Checkpoint vault inventory (read-only)',
    '',
    `- Checkpoint refs inventoried: ${report.checkpointCount}`,
    `- Verified checkpoint payload bytes (Git tree blob sizes): ${report.verifiedCheckpointPayloadBytes}`,
    `- Remaining internal 200,000,000-byte checkpoint cap: ${report.internalCheckpointCapBytesRemaining}`,
    '- Actual vault free bytes: UNKNOWN; GitHub API does not expose remaining private-repository capacity.',
    '- Access: GitHub REST GET only; receipt metadata was read in the runner; ciphertext part contents were not downloaded.',
  ].join('\n') + '\n'
}

export async function runAuditCli({
  env = process.env,
  fetchImpl = globalThis.fetch,
  stdout = (line) => console.log(line),
  stderr = (line) => console.error(line),
  summaryWriter = (path, contents) => appendFile(path, contents, { mode: 0o600 }),
} = {}) {
  try {
    validateRunner(env)
    const report = await auditCheckpointVault({
      repository: env.DIRECT_VAULT_REPOSITORY,
      token: env.DIRECT_VAULT_TOKEN,
      fetchImpl,
    })
    await stdout(JSON.stringify(report))
    if (typeof env.GITHUB_STEP_SUMMARY === 'string' && env.GITHUB_STEP_SUMMARY.length > 0) {
      await summaryWriter(env.GITHUB_STEP_SUMMARY, formatAuditSummary(report))
    }
    return 0
  } catch (error) {
    const code = error instanceof AuditError && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'AUDIT_INTERNAL'
    await stderr(`VAULT_AUDIT_FAIL ${code}`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await runAuditCli()
}
