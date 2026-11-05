import { validateSupabaseManagementResponses } from '../supabase-management-response.mjs'
async function main() {
  const token=process.env.SUPABASE_MANAGEMENT_TOKEN
  if(!token)throw new Error('missing')
  const request=async endpoint=>{
    const response=await fetch(`https://api.supabase.com${endpoint}`,{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(15000)})
    if(response.status!==200)throw new Error('request')
    return response.json()
  }
  const organization=await request('/v1/organizations/ymjvuwefhqqlymwlocqn')
  const projects=await request('/v1/organizations/ymjvuwefhqqlymwlocqn/projects?search=dongphugia-runtime&limit=100')
  const result=validateSupabaseManagementResponses(organization,projects,{ref:'bonxyxluzlxfkdetryoo',name:'dongphugia-runtime',region:'ap-southeast-1'})
  if(!result.ok)throw new Error('target')
  process.stdout.write('EXISTING_BACKUP_MANAGEMENT status=PASS free=PASS healthy=PASS target=PASS\n')
}
void main().catch(()=>{process.stderr.write('EXISTING_BACKUP_MANAGEMENT status=FAIL\n');process.exitCode=1})
