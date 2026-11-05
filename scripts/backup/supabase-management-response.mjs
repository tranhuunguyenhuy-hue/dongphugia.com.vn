import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function validateSupabaseManagementResponses(organization, projectResponse, expectedProject) {
  if (!isRecord(organization) || organization.plan !== 'free') {
    return { ok: false, reason: 'organization_plan_mismatch' }
  }

  if (
    !isRecord(projectResponse)
    || !Array.isArray(projectResponse.projects)
    || !isRecord(projectResponse.pagination)
  ) {
    return { ok: false, reason: 'project_response_shape_mismatch' }
  }

  if (
    !isRecord(expectedProject)
    || typeof expectedProject.ref !== 'string'
    || typeof expectedProject.name !== 'string'
    || typeof expectedProject.region !== 'string'
  ) {
    return { ok: false, reason: 'expected_project_config_missing' }
  }

  const exactProjectExists = projectResponse.projects.some(project => (
    isRecord(project)
    && project.ref === expectedProject.ref
    && project.name === expectedProject.name
    && project.region === expectedProject.region
    && project.status === 'ACTIVE_HEALTHY'
  ))

  if (!exactProjectExists) {
    return { ok: false, reason: 'exact_project_identity_mismatch' }
  }

  return { ok: true }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function main() {
  const [organizationPath, projectsPath] = process.argv.slice(2)
  if (!organizationPath || !projectsPath) {
    process.stdout.write('SUPABASE_MANAGEMENT_TARGET_VERIFY status=FAIL reason=response_paths_missing\n')
    process.exitCode = 1
    return
  }

  let organization
  let projects
  try {
    organization = readJson(organizationPath)
    projects = readJson(projectsPath)
  } catch {
    process.stdout.write('SUPABASE_MANAGEMENT_TARGET_VERIFY status=FAIL reason=invalid_management_response\n')
    process.exitCode = 1
    return
  }

  const result = validateSupabaseManagementResponses(organization, projects, {
    ref: process.env.SUPABASE_PROJECT_REF,
    name: process.env.SUPABASE_PROJECT_NAME,
    region: process.env.SUPABASE_PROJECT_REGION,
  })

  if (!result.ok) {
    process.stdout.write(`SUPABASE_MANAGEMENT_TARGET_VERIFY status=FAIL reason=${result.reason}\n`)
    process.exitCode = 1
    return
  }

  process.stdout.write('SUPABASE_MANAGEMENT_TARGET_VERIFY status=PASS organization_plan=free exact_project=ACTIVE_HEALTHY management_requests=GET_only\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
