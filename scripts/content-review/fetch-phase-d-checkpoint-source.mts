import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { gunzipSync } from 'node:zlib'

const require = createRequire(import.meta.url)
const { hashObject } = require('../../src/lib/content-review/hash') as typeof import('../../src/lib/content-review/hash')
const { POLICY_CONTRACT, POLICY_HASH } = require('../../src/lib/content-review/policy-contract') as typeof import('../../src/lib/content-review/policy-contract')

const REGION = 'ap-southeast-1'
const HOST_NAME = 'dongphugia-staging-foundation-web'
const CHUNK_SIZE = 3
const root = process.cwd()
const cohortPath = path.join(root, 'scripts/content-review/private/leo-493-phase-d-cohort.json')
const outputPath = path.join(root, 'scripts/content-review/private/leo-493-phase-d-checkpoint-source.json')

type Cohort = { policyHash: string; checkpointHash: string; products: Array<{ id: number; checkpoint?: boolean }> }

function runAws(args: string[]): string {
    try {
        return execFileSync('aws', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    } catch {
        throw new Error(`AWS command failed: ${args.slice(0, 3).join(' ')}`)
    }
}

function shellQuote(value: string): string {
    return `'${value.replaceAll("'", `'"'"'`)}'`
}

function resolveInstanceId(): string {
    const ids = JSON.parse(runAws(['ec2', 'describe-instances', '--region', REGION, '--filters', `Name=tag:Name,Values=${HOST_NAME}`, 'Name=instance-state-name,Values=running', '--query', 'Reservations[].Instances[].InstanceId', '--output', 'json'])) as string[]
    const online = JSON.parse(runAws(['ssm', 'describe-instance-information', '--region', REGION, '--filters', 'Key=PingStatus,Values=Online', '--query', 'InstanceInformationList[].InstanceId', '--output', 'json'])) as string[]
    const matches = ids.filter((id) => online.includes(id))
    if (matches.length !== 1) throw new Error(`Expected one running SSM-online host; found ${matches.length}`)
    return matches[0]
}

const REMOTE_PREFIX = String.raw`set -eu
matches=0
env_matches=0
target=""
for c in $(docker ps --quiet); do
  labels=$(docker inspect --format '{{json .Config.Labels}}' "$c")
  envs=$(docker inspect --format '{{json .Config.Env}}' "$c")
  if printf '%s' "$labels" | grep -q 'environmentName.*production' && printf '%s' "$labels" | grep -q 'www.dongphugia.vn'; then
    matches=$((matches+1))
    target="$c"
    if printf '%s' "$envs" | grep -q 'DATABASE_URL=' && printf '%s' "$envs" | grep -q 'DIRECT_URL='; then env_matches=$((env_matches+1)); fi
  fi
done
test "$matches" -eq 1
test "$env_matches" -eq 1
`

const REMOTE_ROWS_JS = String.raw`const zlib=require("zlib");const {PrismaClient}=require("@prisma/client");const db=new PrismaClient();const ids=__IDS__; (async()=>{const rows=await db.products.findMany({where:{is_active:true,id:{in:ids}},orderBy:{id:"asc"},select:{id:true,sku:true,name:true,description:true,features:true,specs:true,updated_at:true,image_main_url:true,brands:{select:{id:true,name:true,slug:true}},categories:{select:{id:true,name:true,slug:true}},product_images:{select:{id:true,image_url:true,alt_text:true,image_type:true,sort_order:true},orderBy:{sort_order:"asc"}}}});process.stdout.write(zlib.gzipSync(Buffer.from(JSON.stringify(rows))).toString("base64"));await db["\u0024disconnect"]();})().catch(async()=>{await db["\u0024disconnect"]();process.exit(1);});`

function remoteCommand(ids: number[]): string {
    const remoteJs = REMOTE_ROWS_JS.replace('__IDS__', JSON.stringify(ids))
    return `${REMOTE_PREFIX}js=${shellQuote(remoteJs)}${String.fromCharCode(10)}docker exec "$target" node -e "$js"`
}

function invoke(instanceId: string, command: string, comment: string): string {
    const parameters = JSON.stringify({ commands: [command] })
    const commandId = runAws(['ssm', 'send-command', '--region', REGION, '--document-name', 'AWS-RunShellScript', '--instance-ids', instanceId, '--parameters', parameters, '--comment', comment, '--query', 'Command.CommandId', '--output', 'text'])
    let status = ''
    for (let attempt = 0; attempt < 60; attempt += 1) {
        status = runAws(['ssm', 'get-command-invocation', '--region', REGION, '--command-id', commandId, '--instance-id', instanceId, '--query', 'StatusDetails', '--output', 'text'])
        if (['Success', 'Failed', 'Cancelled', 'TimedOut', 'Undeliverable', 'Terminated'].includes(status)) break
        execFileSync('sleep', ['2'], { stdio: 'ignore' })
    }
    if (status !== 'Success') throw new Error(`SSM read-only source fetch failed: ${status || 'timeout'}`)
    return runAws(['ssm', 'get-command-invocation', '--region', REGION, '--command-id', commandId, '--instance-id', instanceId, '--query', 'StandardOutputContent', '--output', 'text'])
}

async function main() {
    const cohort = JSON.parse(await fs.readFile(cohortPath, 'utf8')) as Cohort
    if (cohort.policyHash !== POLICY_HASH) throw new Error('Phase D policy hash mismatch')
    const ids = cohort.products.filter((row) => row.checkpoint).map((row) => row.id).sort((a, b) => a - b)
    if (ids.length !== 30 || new Set(ids).size !== ids.length) throw new Error(`Expected 30 unique checkpoint IDs; found ${ids.length}`)
    const instanceId = resolveInstanceId()
    const rows: unknown[] = []
    for (let offset = 0; offset < ids.length; offset += CHUNK_SIZE) {
        const chunkIds = ids.slice(offset, offset + CHUNK_SIZE)
        const encoded = invoke(instanceId, remoteCommand(chunkIds), `LEO-493 Phase D read-only checkpoint source chunk ${offset / CHUNK_SIZE + 1}`)
        if (Buffer.byteLength(encoded, 'utf8') > 23500) throw new Error(`SSM output safety limit exceeded for chunk ${offset / CHUNK_SIZE + 1}`)
        const chunk = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8')) as unknown[]
        if (!Array.isArray(chunk) || chunk.length !== chunkIds.length) throw new Error(`Source completeness failure for chunk ${offset / CHUNK_SIZE + 1}`)
        rows.push(...chunk)
        console.log(`PHASE_D_SOURCE_PROGRESS=${Math.min(offset + CHUNK_SIZE, ids.length)}/${ids.length}`)
    }
    const sortedRows = [...rows].sort((left, right) => Number((left as { id: number }).id) - Number((right as { id: number }).id))
    if (sortedRows.length !== ids.length || sortedRows.some((row, index) => Number((row as { id: number }).id) !== ids[index])) throw new Error('Checkpoint source identity completeness failure')
    const canonical = { schemaVersion: 1, artifact: 'leo-493-phase-d-checkpoint-source', contractVersion: POLICY_CONTRACT.version, policyHash: POLICY_HASH, checkpointHash: cohort.checkpointHash, source: { region: REGION, hostName: HOST_NAME, query: 'selected active products by exact id; id, sku, name, description, features, specs, updatedAt, brand/category and existing image references' }, counts: { products: sortedRows.length }, products: sortedRows }
    const sourceHash = hashObject(canonical)
    await fs.writeFile(outputPath, `${JSON.stringify({ ...canonical, sourceHash, acquiredAt: new Date().toISOString() }, null, 2)}\n`, 'utf8')
    console.log(`PHASE_D_SOURCE_PASS products=${sortedRows.length} sourceHash=${sourceHash} databaseWrites=false remoteFetches=false`)
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'Phase D source fetch failed'); process.exitCode = 1 })
