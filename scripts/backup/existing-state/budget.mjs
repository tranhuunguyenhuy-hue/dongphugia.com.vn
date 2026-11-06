import { execFileSync } from 'node:child_process'
import { lstatSync, readdirSync } from 'node:fs'
import path from 'node:path'
const BUDGET=500000000
try {
  const pages=JSON.parse(execFileSync('gh',['api','--paginate','--slurp','repos/tranhuunguyenhuy-hue/dongphugia.com.vn/actions/artifacts?per_page=100'],{encoding:'utf8',maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']}))
  const artifacts=pages.flatMap(p=>p.artifacts)
  if(artifacts.some(a=>!Number.isSafeInteger(a.size_in_bytes) || a.size_in_bytes<0))throw new Error('inventory')
  const used=artifacts.filter(a=>!a.expired).reduce((sum,a)=>sum+a.size_in_bytes,0)
  let pending=0
  if(process.env.BACKUP_DIR)for(const file of readdirSync(process.env.BACKUP_DIR)) {
    if(!['snapshot.dump.age','state.json.age','public-api.json.age','envelope.json'].includes(file))throw new Error('file')
    const stat=lstatSync(path.join(process.env.BACKUP_DIR,file))
    if(!stat.isFile() || stat.isSymbolicLink())throw new Error('type')
    pending+=stat.size
  }
  if(used+pending>=BUDGET)throw new Error('budget')
  process.stdout.write('EXISTING_BACKUP_ARTIFACT_BUDGET status=PASS\n')
}catch{process.stderr.write('EXISTING_BACKUP_ARTIFACT_BUDGET status=FAIL\n');process.exitCode=1}
