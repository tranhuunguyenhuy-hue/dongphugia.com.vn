import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  APPLICATIONS,
  type ApplicationName,
} from '../../packages/app-contracts/src/index'
import {
  ARTIFACT_MANIFEST_NAME,
  EXPECTED_BUILD_TARGETS,
  recomputeAppArtifactDigest,
  type ArtifactManifest,
} from './app-artifact.mts'

const CANDIDATE_CONTRACT = 'dongphugia:app-preview-candidate:v1'
const APPLICATION_NAMES: ApplicationName[] = ['public', 'admin']

type CandidateOptions = Readonly<{
  artifactRoot: string
  sourceCommit: string
  pullRequest: number
  workflowRunId: string
  lockfile: string
  publicLockfile: string
  migrationManifest: string
  evidencePath: string
}>

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument?.startsWith('--')) continue
    const key = argument.slice(2)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`)
    args[key] = value
    index += 1
  }
  return args
}

function requireSourceCommit(value: string) {
  if (!/^[0-9a-f]{40}$/.test(value)) throw new Error('CANDIDATE_SOURCE_COMMIT_INVALID')
  return value
}

async function sha256File(filePath: string) {
  const hash = createHash('sha256')
  hash.update(await readFile(filePath))
  return hash.digest('hex')
}

async function readManifest(artifactRoot: string, application: ApplicationName) {
  const filePath = path.join(artifactRoot, application, ARTIFACT_MANIFEST_NAME)
  return JSON.parse(await readFile(filePath, 'utf8')) as ArtifactManifest
}

function assertManifest(manifest: ArtifactManifest, application: ApplicationName, sourceCommit: string) {
  if (manifest.contract !== 'dongphugia:app-artifact:v1') throw new Error(`CANDIDATE_MANIFEST_CONTRACT_FAILED:${application}`)
  if (manifest.application !== application) throw new Error(`CANDIDATE_MANIFEST_APPLICATION_FAILED:${application}`)
  if (manifest.authority !== APPLICATIONS[application].authority) throw new Error(`CANDIDATE_MANIFEST_AUTHORITY_FAILED:${application}`)
  if (manifest.runtime !== APPLICATIONS[application].runtime) throw new Error(`CANDIDATE_MANIFEST_RUNTIME_FAILED:${application}`)
  if (manifest.sourceCommit !== sourceCommit) throw new Error(`CANDIDATE_MANIFEST_SOURCE_FAILED:${application}`)
  if (manifest.buildTarget !== EXPECTED_BUILD_TARGETS[application]) throw new Error(`CANDIDATE_MANIFEST_TARGET_FAILED:${application}`)
  if (manifest.preview.mode !== 'preview') throw new Error(`CANDIDATE_MANIFEST_MODE_FAILED:${application}`)
  if (!manifest.preview.noindex.htmlMeta || !manifest.preview.noindex.headers || !manifest.preview.noindex.robots) {
    throw new Error(`CANDIDATE_MANIFEST_NOINDEX_FAILED:${application}`)
  }
}

async function getManifests(options: CandidateOptions) {
  const manifests = {
    public: await readManifest(options.artifactRoot, 'public'),
    admin: await readManifest(options.artifactRoot, 'admin'),
  } satisfies Record<ApplicationName, ArtifactManifest>

  for (const application of APPLICATION_NAMES) {
    assertManifest(manifests[application], application, options.sourceCommit)
    const digest = await recomputeAppArtifactDigest(
      path.join(options.artifactRoot, application),
      manifests[application],
    )
    if (digest.artifactSha256 !== manifests[application].artifactSha256) {
      throw new Error(`CANDIDATE_ARTIFACT_DIGEST_FAILED:${application}`)
    }
  }

  if (manifests.public.artifactSha256 === manifests.admin.artifactSha256) {
    throw new Error('CANDIDATE_ARTIFACT_IDENTITIES_NOT_DISTINCT')
  }

  return manifests
}

export async function createPreviewCandidate(options: CandidateOptions) {
  const sourceCommit = requireSourceCommit(options.sourceCommit)
  const manifests = await getManifests({ ...options, sourceCommit })
  const lockfileSha256 = await sha256File(options.lockfile)
  const publicLockfileSha256 = await sha256File(options.publicLockfile)
  const migrationManifestSha256 = await sha256File(options.migrationManifest)
  const publicWorker = manifests.public.publicWorker
  if (!publicWorker) throw new Error('CANDIDATE_PUBLIC_WORKER_EVIDENCE_MISSING')
  const evidence = {
    contract: CANDIDATE_CONTRACT,
    candidate: {
      sourceCommit,
      pullRequest: options.pullRequest,
      workflowRunId: options.workflowRunId,
      buildTarget: 'public-worker-static-assets+admin-independent-runtime',
      lockfileSha256,
      publicLockfileSha256,
      migrationManifestSha256,
      publicArtifactSha256: manifests.public.artifactSha256,
      adminArtifactSha256: manifests.admin.artifactSha256,
      publicWorkerSha256: publicWorker.worker.sha256,
      publicStaticAssetsSha256: publicWorker.staticAssets.sha256,
      publicConfigSha256: publicWorker.configSha256,
    },
    applications: manifests,
    noindex: {
      publicRuntimeProofSha256: manifests.public.runtimeProofSha256,
      adminRuntimeProofSha256: manifests.admin.runtimeProofSha256,
      public: manifests.public.preview.noindex,
      admin: manifests.admin.preview.noindex,
    },
    publication: {
      mode: 'ci-only',
      cloudflareDeployment: 'not-attempted',
      productionCustomDomain: 'forbidden',
      productionDnsOrTraffic: 'unchanged',
    },
  }

  await writeFile(options.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
  return evidence
}

export async function verifyPreviewCandidate(
  options: CandidateOptions,
  expected: Pick<CandidateOptions, 'sourceCommit' | 'pullRequest' | 'workflowRunId'>,
) {
  const evidence = JSON.parse(await readFile(options.evidencePath, 'utf8')) as Awaited<ReturnType<typeof createPreviewCandidate>>
  if (evidence.contract !== CANDIDATE_CONTRACT) throw new Error('CANDIDATE_CONTRACT_FAILED')
  if (evidence.candidate.sourceCommit !== requireSourceCommit(expected.sourceCommit)) throw new Error('CANDIDATE_SOURCE_FAILED')
  if (evidence.candidate.pullRequest !== expected.pullRequest) throw new Error('CANDIDATE_PR_FAILED')
  if (evidence.candidate.workflowRunId !== expected.workflowRunId) throw new Error('CANDIDATE_RUN_FAILED')
  if (evidence.candidate.buildTarget !== 'public-worker-static-assets+admin-independent-runtime') throw new Error('CANDIDATE_BUILD_TARGET_FAILED')
  if (
    !evidence.noindex.public.htmlMeta ||
    !evidence.noindex.public.headers ||
    !evidence.noindex.public.robots ||
    !evidence.noindex.admin.htmlMeta ||
    !evidence.noindex.admin.headers ||
    !evidence.noindex.admin.robots
  ) throw new Error('CANDIDATE_NOINDEX_FAILED')
  if (
    evidence.publication.mode !== 'ci-only' ||
    evidence.publication.cloudflareDeployment !== 'not-attempted' ||
    evidence.publication.productionCustomDomain !== 'forbidden' ||
    evidence.publication.productionDnsOrTraffic !== 'unchanged'
  ) throw new Error('CANDIDATE_PUBLICATION_STATE_FAILED')

  const manifests = await getManifests(options)
  if (evidence.candidate.lockfileSha256 !== await sha256File(options.lockfile)) {
    throw new Error('CANDIDATE_LOCKFILE_FAILED')
  }
  if (evidence.candidate.publicLockfileSha256 !== await sha256File(options.publicLockfile)) {
    throw new Error('CANDIDATE_PUBLIC_LOCKFILE_FAILED')
  }
  if (evidence.candidate.migrationManifestSha256 !== await sha256File(options.migrationManifest)) {
    throw new Error('CANDIDATE_MIGRATION_MANIFEST_FAILED')
  }
  if (evidence.candidate.publicArtifactSha256 !== manifests.public.artifactSha256) throw new Error('CANDIDATE_PUBLIC_ARTIFACT_FAILED')
  if (evidence.candidate.adminArtifactSha256 !== manifests.admin.artifactSha256) throw new Error('CANDIDATE_ADMIN_ARTIFACT_FAILED')
  if (evidence.noindex.publicRuntimeProofSha256 !== manifests.public.runtimeProofSha256) throw new Error('CANDIDATE_PUBLIC_RUNTIME_PROOF_FAILED')
  if (evidence.noindex.adminRuntimeProofSha256 !== manifests.admin.runtimeProofSha256) throw new Error('CANDIDATE_ADMIN_RUNTIME_PROOF_FAILED')
  const publicWorker = manifests.public.publicWorker
  if (
    !publicWorker ||
    evidence.candidate.publicWorkerSha256 !== publicWorker.worker.sha256 ||
    evidence.candidate.publicStaticAssetsSha256 !== publicWorker.staticAssets.sha256 ||
    evidence.candidate.publicConfigSha256 !== publicWorker.configSha256
  ) throw new Error('CANDIDATE_PUBLIC_WORKER_IDENTITY_FAILED')
  return evidence
}

function optionsFromArgs(args: Record<string, string>): CandidateOptions {
  const artifactRoot = path.resolve(args['artifact-root'] || '')
  const sourceCommit = args['source-sha'] || ''
  const pullRequest = Number(args['pr-number'] || 0)
  const workflowRunId = args['workflow-run-id'] || ''
  const lockfile = path.resolve(args.lockfile || 'package-lock.json')
  const publicLockfile = path.resolve(args['public-lockfile'] || 'apps/public/package-lock.json')
  const migrationManifest = path.resolve(args['migration-manifest'] || 'db/postgres-migrations/manifest.json')
  const evidencePath = path.resolve(args.evidence || path.join(artifactRoot, 'candidate-evidence.json'))
  if (!Number.isInteger(pullRequest) || pullRequest < 0) throw new Error('CANDIDATE_PR_INVALID')
  if (!workflowRunId) throw new Error('CANDIDATE_RUN_ID_MISSING')
  return { artifactRoot, sourceCommit, pullRequest, workflowRunId, lockfile, publicLockfile, migrationManifest, evidencePath }
}

async function main() {
  const mode = process.argv[2]
  const args = parseArgs(process.argv.slice(3))
  const options = optionsFromArgs(args)
  if (mode === 'create') {
    const evidence = await createPreviewCandidate(options)
    process.stdout.write(`${JSON.stringify(evidence.candidate)}\n`)
    return
  }
  if (mode === 'verify') {
    const evidence = await verifyPreviewCandidate(options, options)
    process.stdout.write(`${JSON.stringify(evidence.candidate)}\n`)
    return
  }
  throw new Error('CANDIDATE_MODE_INVALID')
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(`LEO563_CANDIDATE_FAILED: ${error.message}`)
    process.exitCode = 1
  })
}

export { CANDIDATE_CONTRACT }
