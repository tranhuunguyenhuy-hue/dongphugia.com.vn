const COMMAND_PATTERN = /^\/codex dispatch\n```json\n([\s\S]+)\n```$/
const PROTECTED_PATH_PREFIXES = [
  '.artifacts/',
  '.git/',
  '.github/',
  'AGENTS.md',
  'docs/AGENTS.md',
  'docs/WORKFLOW-WITH-CODEX.md',
  'docs/deploy/offline-catalogue-rehearsal.md',
  'scripts/automation/',
  'scripts/backup/',
]

function isAllowedPath(path) {
  return (
    typeof path === 'string' &&
    path.length > 0 &&
    path.length <= 160 &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !path.split('/').some((segment) => segment === '.' || segment === '..') &&
    !PROTECTED_PATH_PREFIXES.some(
      (prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix),
    )
  )
}

function isBoundedText(value, maxLength, { singleLine = false } = {}) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    !value.includes('\0') &&
    (!singleLine || !/[\r\n]/.test(value))
  )
}

export function parseDispatchCommand(body) {
  if (typeof body !== 'string' || body.length > 12_000) {
    throw new Error('DISPATCH_COMMAND_INVALID')
  }
  const match = COMMAND_PATTERN.exec(body)
  if (!match) {
    throw new Error('DISPATCH_COMMAND_INVALID')
  }

  const task = JSON.parse(match[1])
  const expectedKeys = [
    'acceptance',
    'allowed_paths',
    'external_writes',
    'production',
    'task',
    'title',
    'version',
  ]

  if (JSON.stringify(Object.keys(task).sort()) !== JSON.stringify(expectedKeys)) {
    throw new Error('DISPATCH_SCHEMA_INVALID')
  }
  if (
    task.version !== 1 ||
    !isBoundedText(task.title, 120, { singleLine: true }) ||
    !isBoundedText(task.task, 8_000) ||
    !Array.isArray(task.acceptance) ||
    !Array.isArray(task.allowed_paths) ||
    task.production !== false ||
    task.external_writes !== false
  ) {
    throw new Error('DISPATCH_SCHEMA_INVALID')
  }
  if (
    task.acceptance.length === 0 ||
    task.acceptance.length > 20 ||
    !task.acceptance.every((item) => isBoundedText(item, 500))
  ) {
    throw new Error('DISPATCH_SCHEMA_INVALID')
  }
  if (
    task.allowed_paths.length === 0 ||
    task.allowed_paths.length > 16 ||
    !task.allowed_paths.every(isAllowedPath)
  ) {
    throw new Error('DISPATCH_ALLOWED_PATH_INVALID')
  }

  return task
}

export async function validateDispatchEvent({
  event,
  githubApi,
  repository,
  repositoryId,
  ref,
  sha,
}) {
  if (
    event.action !== 'created' ||
    event.repository?.id !== repositoryId ||
    event.repository?.full_name !== repository ||
    event.sender?.id !== event.comment?.user?.id ||
    event.sender?.login !== event.comment?.user?.login ||
    !Number.isSafeInteger(event.issue?.number) ||
    !Number.isSafeInteger(event.comment?.id) ||
    ref !== 'refs/heads/main' ||
    !/^[0-9a-f]{40}$/.test(sha)
  ) {
    throw new Error('DISPATCH_EVENT_INVALID')
  }

  const repositoryResponse = await githubApi(`/repos/${repository}`)
  if (
    repositoryResponse.status !== 200 ||
    repositoryResponse.data?.id !== repositoryId ||
    repositoryResponse.data?.default_branch !== 'main'
  ) {
    throw new Error('DISPATCH_REPOSITORY_UNVERIFIED')
  }

  const actor = encodeURIComponent(event.sender.login)
  const permissionResponse = await githubApi(
    `/repos/${repository}/collaborators/${actor}/permission`,
  )
  if (
    permissionResponse.status !== 200 ||
    permissionResponse.data?.permission !== 'admin' ||
    permissionResponse.data?.user?.id !== event.sender.id
  ) {
    throw new Error('DISPATCH_ACTOR_UNAUTHORIZED')
  }

  const refResponse = await githubApi(`/repos/${repository}/git/ref/heads/main`)
  if (refResponse.status !== 200 || refResponse.data?.object?.sha !== sha) {
    throw new Error('DISPATCH_BASE_REF_UNVERIFIED')
  }

  const branch = `codex/dispatch-${event.issue.number}-${event.comment.id}`
  const branchResponse = await githubApi(
    `/repos/${repository}/git/ref/heads/${encodeURIComponent(branch)}`,
  )
  if (branchResponse.status !== 404) {
    throw new Error('DISPATCH_ALREADY_PROCESSED')
  }

  return {
    dispatch_id: `${repositoryId}:${event.issue.number}:${event.comment.id}`,
    repository,
    repository_id: repositoryId,
    issue_number: event.issue.number,
    source_comment_id: event.comment.id,
    actor_id: event.sender.id,
    base_sha: sha,
    branch,
    task: parseDispatchCommand(event.comment.body),
  }
}
