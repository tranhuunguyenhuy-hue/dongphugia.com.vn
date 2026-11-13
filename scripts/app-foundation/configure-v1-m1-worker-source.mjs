// Prepare the explicit M1 Worker data source without ever storing credentials.
import { readFileSync, writeFileSync } from 'node:fs'
const [path, source, hyperdriveId] = process.argv.slice(2)
if (!path || !['snapshot','postgresql'].includes(source)) throw Error('INVALID_PUBLIC_SOURCE')
const cfg = JSON.parse(readFileSync(path,'utf8'))
if (cfg.name !== 'dongphugia-v1-public-production') throw Error('WRONG_WORKER_TARGET')
cfg.vars = { ...(cfg.vars || {}), PUBLIC_CATALOGUE_SOURCE: source }
if (source === 'postgresql') {
  if (!/^[a-f0-9]{32}$/.test(hyperdriveId || '')) throw Error('READONLY_HYPERDRIVE_ID_REQUIRED')
  cfg.hyperdrive = [{binding:'PUBLIC_DB',id:hyperdriveId}]
} else {
  delete cfg.hyperdrive
}
writeFileSync(path, JSON.stringify(cfg,null,2)+'\n','utf8')
