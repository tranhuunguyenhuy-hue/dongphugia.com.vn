import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import type { ReviewState } from '../../src/lib/content-review/types'

const require = createRequire(import.meta.url)
const { createContentChangePlan } = require('../../src/lib/content-review/planner.ts') as typeof import('../../src/lib/content-review/planner')
const { parseContentReviewProposal } = require('../../src/lib/content-review/proposal.ts') as typeof import('../../src/lib/content-review/proposal')

function argumentValue(name: string): string | undefined {
    const prefix = `${name}=`
    return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length)
}

async function main() {
    const input = argumentValue('--input')
    if (!input) throw new Error('--input=/path/to/proposal.json is required')
    if (process.argv.some(value => value === '--execute' || value.startsWith('--execute='))) {
        throw new Error('This planner has no execution mode')
    }
    const proposal = parseContentReviewProposal(JSON.parse(await fs.readFile(input, 'utf8')))
    const direction = process.argv.includes('--rollback') ? 'rollback' : 'apply'
    const state = (argumentValue('--state') || 'ready_to_apply') as ReviewState
    console.log(JSON.stringify(createContentChangePlan(proposal, state, direction), null, 2))
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
})
