import { execFileSync } from 'node:child_process'
import { baselineSha, requireGate } from './contract.mjs'
const REPO='tranhuunguyenhuy-hue/dongphugia.com.vn'
const OWNER='tranhuunguyenhuy-hue'
const CLAIM='EXISTING-BACKUP-CLAIMED:'
const api=(endpoint)=>JSON.parse(execFileSync('gh',['api',endpoint],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
export function validateApproval(comment, comments, input, mergeTime) {
  requireGate(comment?.user?.login===OWNER && comment.created_at===comment.updated_at && Date.parse(comment.created_at)>Date.parse(mergeTime),'approval_author_or_time_failed')
  const pattern=`EXISTING-BACKUP-EXECUTE: sha=${input.sha} baseline=${baselineSha} operation=${input.operation} quiescent=yes nonce=`
  requireGate(typeof comment.body==='string' && comment.body.startsWith(pattern) && /^[a-f0-9]{32}$/.test(comment.body.slice(pattern.length)),'approval_body_failed')
  const nonce=comment.body.slice(pattern.length)
  requireGate(!comments.some(c=>c.body?.startsWith(CLAIM) && (c.body.includes(`comment=${comment.id} `) || c.body.includes(`nonce=${nonce} `))),'approval_claimed')
  return nonce
}
export function main() {
  requireGate(process.env.GITHUB_REPOSITORY===REPO && process.env.GITHUB_REF==='refs/heads/main' && process.env.GITHUB_ACTOR===OWNER && process.env.TRIGGERING_ACTOR===OWNER && process.env.GITHUB_RUN_ATTEMPT==='1','dispatch_identity_failed')
  const sha=process.env.APPROVED_SOURCE_SHA
  const operation=process.env.OPERATION
  requireGate(/^[a-f0-9]{40}$/.test(sha ?? '') && sha===process.env.GITHUB_SHA && execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()===sha,'source_failed')
  requireGate(['inspect','bootstrap','backup_restore'].includes(operation),'operation_invalid')
  requireGate(process.env.APPROVED_BASELINE_SHA===baselineSha,'baseline_failed')
  if(operation!=='inspect') {
    const issue=api(`repos/${REPO}/issues/270`);requireGate(issue.state==='open','issue_closed')
    const pulls=api(`repos/${REPO}/commits/${sha}/pulls?per_page=100`)
    const merged=pulls.filter(p=>p.base.ref==='main' && p.merged_at && p.merge_commit_sha===sha)
    requireGate(merged.length===1,'merged_source_failed')
    const pages=JSON.parse(execFileSync('gh',['api','--paginate','--slurp',`repos/${REPO}/issues/270/comments?per_page=100`],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
    const comments=pages.flat()
    const id=process.env.APPROVAL_COMMENT_ID
    requireGate(/^[1-9]\d*$/.test(id ?? ''),'approval_id_invalid')
    const comment=comments.find(c=>String(c.id)===id)
    const nonce=validateApproval(comment,comments,{sha,operation},merged[0].merged_at)
    execFileSync('gh',['api','--method','POST',`repos/${REPO}/issues/270/comments`,'--input','-'],{input:JSON.stringify({body:`${CLAIM} comment=${id} nonce=${nonce} sha=${sha} baseline=${baselineSha} operation=${operation} run=${process.env.GITHUB_RUN_ID} attempt=1`}),stdio:['pipe','ignore','pipe']})
  }
  process.stdout.write(`EXISTING_BACKUP_GATE status=PASS operation=${operation} baseline=${baselineSha}\n`)
}
if(process.argv[1]?.endsWith('/existing-state/execution-gate.mjs')) {try{main()}catch{process.stderr.write('EXISTING_BACKUP_GATE status=FAIL reason=source_or_owner_approval_failed\n');process.exitCode=1}}
