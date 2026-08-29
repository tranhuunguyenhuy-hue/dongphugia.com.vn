import { readFile } from 'node:fs/promises'

const REPORT_KEYS = [
  'brokenBlogLinkCount',
  'duplicateSkuCount',
  'ms885AcceptedGapMatchCount',
  'ms885BadMembershipCount',
  'ms885ExcludedMembershipCount',
  'ms885FamilyCount',
  'ms885MembershipCount',
  'ms885OpenGapCount',
  'ms885UnexpectedOpenGapCount',
  'requiredTablesPresent',
]

export function validateRuntimeSemantics(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return ['semantic report is invalid']
  }
  if (JSON.stringify(Object.keys(report).sort()) !== JSON.stringify(REPORT_KEYS)) {
    return ['semantic report is invalid']
  }
  if (typeof report.requiredTablesPresent !== 'boolean'
    || REPORT_KEYS.filter((key) => key !== 'requiredTablesPresent')
      .some((key) => !Number.isInteger(report[key]) || report[key] < 0)) {
    return ['semantic report is invalid']
  }

  const violations = []
  if (!report.requiredTablesPresent) violations.push('required table invariant failed')
  if (report.duplicateSkuCount !== 0) violations.push('duplicate SKU invariant failed')
  if (report.brokenBlogLinkCount !== 0) violations.push('Blog relationship invariant failed')
  if (report.ms885FamilyCount !== 1) violations.push('MS885 family invariant failed')
  if (report.ms885MembershipCount !== 18 || report.ms885BadMembershipCount !== 0) {
    violations.push('MS885 membership invariant failed')
  }
  if (report.ms885OpenGapCount !== 2
    || report.ms885AcceptedGapMatchCount !== 2
    || report.ms885UnexpectedOpenGapCount !== 0) {
    violations.push('MS885 catalogue gap invariant failed')
  }
  if (report.ms885ExcludedMembershipCount !== 0) {
    violations.push('MS885 excluded member invariant failed')
  }
  return violations
}

async function main() {
  const [mode, reportPath] = process.argv.slice(2)
  if (mode !== 'validate' || !reportPath) {
    throw new Error('usage: node scripts/backup/runtime-validation-contract.mjs validate <report>')
  }
  const report = JSON.parse(await readFile(reportPath, 'utf8'))
  const violations = validateRuntimeSemantics(report)
  if (violations.length > 0) {
    process.stderr.write(`LEO540_RUNTIME_VALIDATION status=FAIL violation_count=${violations.length}\n`)
    process.exitCode = 1
    return
  }
  process.stdout.write('LEO540_RUNTIME_VALIDATION status=PASS\n')
}

if (process.argv[1]?.endsWith('/runtime-validation-contract.mjs')) void main().catch(() => {
  process.stderr.write('LEO540_RUNTIME_VALIDATION status=FAIL error=invalid_report\n')
  process.exitCode = 1
})
