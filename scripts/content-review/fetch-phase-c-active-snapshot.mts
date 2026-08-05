import fs from 'node:fs/promises'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { gunzipSync } from 'node:zlib'

const require = createRequire(import.meta.url)
const { hashObject } = require('../../src/lib/content-review/hash') as typeof import('../../src/lib/content-review/hash')
const { POLICY_HASH, POLICY_CONTRACT } = require('../../src/lib/content-review/policy-contract') as typeof import('../../src/lib/content-review/policy-contract')

const REGION = 'ap-southeast-1'
const HOST_NAME = 'dongphugia-staging-foundation-web'
const CHUNK_SIZE = 20
const OUTPUT_PATH = path.join(process.cwd(), 'scripts/content-review/private/leo-493-phase-c-active-snapshot.json')
const ERROR_PATH = path.join(process.cwd(), 'scripts/content-review/private/leo-493-phase-c-fetch-error.txt')

type InventoryMedia = { kind: 'main' | 'gallery' | 'embedded'; sourceId: string; fingerprint: string; host: 'Bunny CDN' | 'Hita' | 'External' }
type InventoryProduct = {
    id: number
    sku: string | null
    name: string | null
    brand: { id: number; name: string; slug: string } | null
    category: { id: number; name: string; slug: string } | null
    updatedAt: string
    descriptionHash: string
    visibleLength: number
    media: InventoryMedia[]
}

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
    if (matches.length !== 1) throw new Error(`Expected one running SSM-online production host; found ${matches.length}`)
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

const REMOTE_ROWS_JS = String.raw`const crypto=require("crypto");const zlib=require("zlib");const {PrismaClient}=require("@prisma/client");const db=new PrismaClient();const offset=__OFFSET__;const limit=__LIMIT__;const tracking=new Set(["fbclid","gclid","mc_cid","mc_eid","utm_campaign","utm_content","utm_medium","utm_source","utm_term"]);function norm(v){const t=(v||"").trim();if(!t)return "";try{const u=new URL(t);u.hash="";u.hostname=u.hostname.toLowerCase();u.protocol=u.protocol.toLowerCase();for(const key of [...u.searchParams.keys()])if(tracking.has(key.toLowerCase()))u.searchParams.delete(key);u.searchParams.sort();if((u.protocol==="https:"&&u.port==="443")||(u.protocol==="http:"&&u.port==="80"))u.port="";return u.toString();}catch{return t;}}function digest(v){return crypto.createHash("sha256").update(v).digest("hex");}function host(v){try{const h=new URL(v).hostname.toLowerCase();if(h==="cdn.dongphugia.com.vn"||h.endsWith(".b-cdn.net"))return "Bunny CDN";if(h==="hita.com.vn"||h.endsWith(".hita.com.vn"))return "Hita";}catch{}return "External";}function media(kind,sourceId,url){return {kind,sourceId,fingerprint:digest(norm(url)),host:host(url)};}function embedded(html){const urls=[];const re=/<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;let match;while((match=re.exec(html||""))){const value=(match[1]||match[2]||match[3]||"").trim();if(value&&!urls.includes(value))urls.push(value);}return urls;}function visible(html){return (html||"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/\s+/g," ").trim();}(async()=>{const rows=await db.products.findMany({where:{is_active:true},orderBy:{id:"asc"},skip:offset,take:limit,select:{id:true,sku:true,name:true,description:true,updated_at:true,image_main_url:true,brands:{select:{id:true,name:true,slug:true}},categories:{select:{id:true,name:true,slug:true}},product_images:{select:{id:true,image_url:true,sort_order:true},orderBy:{sort_order:"asc"}}}});const out=rows.map(row=>{const mediaRows=[];if(row.image_main_url)mediaRows.push(media("main","main",row.image_main_url));for(const image of [...row.product_images].sort((a,b)=>a.sort_order-b.sort_order||a.id-b.id))mediaRows.push(media("gallery","gallery:"+image.id,image.image_url));for(const [i,url] of embedded(row.description).entries())mediaRows.push(media("embedded","embedded:"+i,url));return {id:row.id,sku:row.sku,name:row.name,brand:row.brands,category:row.categories,updatedAt:new Date(row.updated_at).toISOString(),descriptionHash:digest(row.description||""),visibleLength:visible(row.description).length,media:mediaRows};});process.stdout.write(zlib.gzipSync(Buffer.from(JSON.stringify(out))).toString("base64"));await db["\u0024disconnect"]();})().catch(async()=>{await db["\u0024disconnect"]();process.exit(1);});`

function remoteCommand(mode: 'count' | 'rows', offset = 0): string {
    const remoteJs = mode === 'count'
        ? 'const {PrismaClient}=require("@prisma/client");const db=new PrismaClient();(async()=>{const [active,images]=await Promise.all([db.products.count({where:{is_active:true}}),db.product_images.count({where:{products:{is_active:true}}})]);process.stdout.write(JSON.stringify({activeProducts:active,productImageRows:images}));await db["\\u0024disconnect"]();})().catch(async()=>{await db["\\u0024disconnect"]();process.exit(1);});'
        : REMOTE_ROWS_JS.replace('__OFFSET__', String(offset)).replace('__LIMIT__', String(CHUNK_SIZE))
    return `${REMOTE_PREFIX}js=${shellQuote(remoteJs)}${String.fromCharCode(10)}docker exec "$target" node -e "$js"`
}

function invoke(instanceId: string, command: string, comment: string): string {
    const parameters = JSON.stringify({ commands: [command] })
    const commandId = runAws(['ssm', 'send-command', '--region', REGION, '--document-name', 'AWS-RunShellScript', '--instance-ids', instanceId, '--parameters', parameters, '--comment', comment, '--query', 'Command.CommandId', '--output', 'text'])
    let detail = ''
    for (let attempt = 0; attempt < 45; attempt += 1) {
        detail = runAws(['ssm', 'get-command-invocation', '--region', REGION, '--command-id', commandId, '--instance-id', instanceId, '--query', 'StatusDetails', '--output', 'text'])
        if (['Success', 'Failed', 'Cancelled', 'TimedOut', 'Undeliverable', 'Terminated'].includes(detail)) break
        execFileSync('sleep', ['2'], { stdio: 'ignore' })
    }
    if (detail !== 'Success') {
        const errorText = runAws(['ssm', 'get-command-invocation', '--region', REGION, '--command-id', commandId, '--instance-id', instanceId, '--query', 'StandardErrorContent', '--output', 'text'])
        writeFileSync(ERROR_PATH, errorText, 'utf8')
        throw new Error(`SSM read-only command failed: ${detail || 'timeout'}; diagnosticBytes=${Buffer.byteLength(errorText, 'utf8')}`)
    }
    return runAws(['ssm', 'get-command-invocation', '--region', REGION, '--command-id', commandId, '--instance-id', instanceId, '--query', 'StandardOutputContent', '--output', 'text'])
}

async function main() {
    const instanceId = resolveInstanceId()
    const countValue = JSON.parse(invoke(instanceId, remoteCommand('count'), 'LEO-493 Phase C read-only active inventory count')) as { activeProducts: number; productImageRows: number }
    if (!Number.isInteger(countValue.activeProducts) || countValue.activeProducts < 1) throw new Error('Invalid active product count')
    const products: InventoryProduct[] = []
    const chunkCount = Math.ceil(countValue.activeProducts / CHUNK_SIZE)
    for (let offset = 0; offset < countValue.activeProducts; offset += CHUNK_SIZE) {
        const raw = invoke(instanceId, remoteCommand('rows', offset), `LEO-493 Phase C read-only active inventory chunk ${offset}`)
        const chunk = JSON.parse(gunzipSync(Buffer.from(raw, 'base64')).toString('utf8')) as InventoryProduct[]
        if (!Array.isArray(chunk) || chunk.length > CHUNK_SIZE) throw new Error(`Invalid inventory chunk at offset ${offset}`)
        if (Buffer.byteLength(raw, 'utf8') > 23500) throw new Error(`Inventory chunk exceeds SSM output safety limit at offset ${offset}`)
        products.push(...chunk)
        if ((offset / CHUNK_SIZE + 1) % 25 === 0 || offset + CHUNK_SIZE >= countValue.activeProducts) console.log(`PHASE_C_FETCH_PROGRESS=${Math.min(offset + CHUNK_SIZE, countValue.activeProducts)}/${countValue.activeProducts}`)
    }
    products.sort((left, right) => left.id - right.id)
    if (products.length !== countValue.activeProducts || new Set(products.map((row) => row.id)).size !== products.length) throw new Error(`Inventory completeness failure: expected ${countValue.activeProducts}, received ${products.length}`)
    const skuCounts = new Map<string, number>()
    for (const row of products) { const sku = row.sku?.trim(); if (sku) skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1) }
    const duplicateSkus = [...skuCounts.entries()].filter(([, count]) => count > 1).map(([sku]) => sku).sort()
    const blockerRows = products.filter((row) => !row.sku?.trim() || duplicateSkus.includes(row.sku.trim())).map((row) => ({ id: row.id, sku: row.sku, name: row.name, brand: row.brand?.slug || null, category: row.category?.slug || null, reason: !row.sku?.trim() ? 'MISSING_RAW_SKU' : 'DUPLICATE_RAW_SKU' }))
    const canonical = { schemaVersion: 1, contractVersion: POLICY_CONTRACT.version, policyHash: POLICY_HASH, source: { region: REGION, instanceId, hostName: HOST_NAME, query: 'products WHERE is_active=true; id, exact sku, name, brand/category, updatedAt, description hash/visible length, media fingerprints/hosts' }, counts: { activeProducts: products.length, productImageRows: countValue.productImageRows }, blockers: { missingRawSku: products.filter((row) => !row.sku?.trim()).length, duplicateRawSkuGroups: duplicateSkus.length, blockerRows }, products }
    const snapshotHash = hashObject(canonical)
    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
    await fs.writeFile(OUTPUT_PATH, `${JSON.stringify({ ...canonical, snapshotHash, acquiredAt: new Date().toISOString() }, null, 2)}\n`, 'utf8')
    console.log(`PHASE_C_FETCH_PASS products=${products.length} mediaRows=${countValue.productImageRows} chunks=${chunkCount} snapshotHash=${snapshotHash} databaseWrites=false remoteFetches=false`)
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'Phase C fetch failed'); process.exitCode = 1 })
