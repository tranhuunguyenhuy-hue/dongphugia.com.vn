import { provisioningSql } from './contract.mjs'

// Generate reviewable SQL only. No database connection and no password generation.
try { process.stdout.write(provisioningSql(process.argv[2])) }
catch { console.error('DIRECT_PROVISION status=STOP reason=INVALID_PURPOSE'); process.exitCode = 1 }
