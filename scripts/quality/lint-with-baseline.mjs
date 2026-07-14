import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '../..')
const baselinePath = path.join(repositoryRoot, '.eslint-baseline.json')

function normalizeMessage(message) {
    return message.replaceAll(`${repositoryRoot}${path.sep}`, '')
}

function toFingerprint(filePath, message) {
    const relativePath = path.relative(repositoryRoot, filePath)
    const source = [
        relativePath,
        message.line,
        message.column,
        message.ruleId ?? 'unknown-rule',
        normalizeMessage(message.message),
    ].join(':')

    return createHash('sha256').update(source).digest('hex')
}

function collectErrors(results) {
    return results
        .flatMap((result) => result.messages
            .filter((message) => message.severity === 2)
            .map((message) => ({
                file: path.relative(repositoryRoot, result.filePath),
                line: message.line,
                column: message.column,
                rule: message.ruleId ?? 'unknown-rule',
                message: normalizeMessage(message.message),
                fingerprint: toFingerprint(result.filePath, message),
            })))
        .sort((left, right) => left.fingerprint.localeCompare(right.fingerprint))
}

async function readBaseline() {
    const content = await readFile(baselinePath, 'utf8')
    return JSON.parse(content)
}

async function main() {
    const eslint = new ESLint({ cwd: repositoryRoot })
    const results = await eslint.lintFiles(['.'])
    const errors = collectErrors(results)

    if (process.argv.includes('--update')) {
        const baseline = {
            description: 'Known ESLint errors captured during repository cleanup. New errors fail CI.',
            generatedAt: new Date().toISOString(),
            errors,
        }
        await writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`)
        console.log(`Updated ESLint baseline with ${errors.length} known errors.`)
        return
    }

    const baseline = await readBaseline()
    const knownFingerprints = new Set(baseline.errors.map((error) => error.fingerprint))
    const newErrors = errors.filter((error) => !knownFingerprints.has(error.fingerprint))

    if (newErrors.length > 0) {
        console.error(`ESLint found ${newErrors.length} error(s) outside the committed baseline:`)
        for (const error of newErrors) {
            console.error(`${error.file}:${error.line}:${error.column} ${error.rule} ${error.message}`)
        }
        process.exitCode = 1
        return
    }

    const resolvedCount = baseline.errors.length - errors.length
    console.log(
        `ESLint passed: 0 new errors, ${errors.length} known errors remain, ` +
        `${Math.max(resolvedCount, 0)} baseline errors resolved.`
    )
}

main().catch((error) => {
    console.error('Unable to run ESLint baseline check:', error)
    process.exitCode = 1
})
