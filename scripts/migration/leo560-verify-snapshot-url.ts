import { assertExactSnapshotUrl } from './leo560-shadow-import-lib'

try {
  assertExactSnapshotUrl(process.env.LEO560_SNAPSHOT_URL)
  process.stdout.write('LEO560_SNAPSHOT_URL status=PASS exact_object=true exact_version=true max_expiry_seconds=3600\n')
} catch (error) {
  const reason = error instanceof Error && error.message.startsWith('LEO560_SHADOW_IMPORT_FAILED:')
    ? error.message
    : 'LEO560_SHADOW_IMPORT_FAILED:snapshot_url_validation_failed'
  process.stderr.write(`${reason}\n`)
  process.exitCode = 1
}
