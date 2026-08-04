import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { validateAndGeneratePrecomputedProposals } = require('../../src/lib/content-review/precomputed.ts') as typeof import('../../src/lib/content-review/precomputed')

function argumentValue(name: string): string | undefined {
    const prefix = `${name}=`
    return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length)
}

async function main() {
    const inputPath = argumentValue('--input') || path.join(process.cwd(), 'scripts/content-review/private/leo-489-pilot-package.json')
    const value = JSON.parse(await fs.readFile(inputPath, 'utf8'))
    const result = await validateAndGeneratePrecomputedProposals(value)
    const output = {
        mode: 'precomputed',
        validation: 'PASS',
        products: result.proposals.length,
        packageHash: result.packageHash,
        manifestEntryHash: result.manifestEntryHash,
        proposalsHash: require('../../src/lib/content-review/hash.ts').hashObject(result.proposals.map(proposal => proposal.proposalHash)),
        pendingImages: result.proposals.reduce((total, proposal) => total + proposal.after.images.filter(image => image.decision === 'HUMAN_REVIEW').length, 0),
        existingBunnyKeep: result.proposals.reduce((total, proposal) => total + proposal.after.images.filter(image => image.decision === 'KEEP').length, 0),
        databaseWrites: false,
        remoteFetches: false,
    }
    console.log(JSON.stringify(output, null, 2))
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
})
