import { it, expect } from 'vitest'
import { inspect } from './database.mjs'
import { baseline, tables, sequences, INVENTORY_SQL } from './contract.mjs'
function fake(fail) {
  const calls=[]
  return {calls,async query(sql){
    calls.push(sql)
    if(sql.includes('pg_database_size'))return {rows:[{version:true,size:true,target:true,no_large_objects:true}]}
    if(sql===INVENTORY_SQL)return {rows:[{inventory:baseline}]}
    if(sql.includes('jsonb_agg(to_jsonb(entry)')) {
      if(fail)throw Object.assign(new Error('Query read timeout'),{detail:'PRIVATE_SECRET'})
      return {rows:[{state:[...tables,...sequences].map(x=>({identity:x.name,count:'1',hash:'a'.repeat(64)}))}]}
    }
    return {rows:[]}
  }}
}
it('fingerprints only inside a rolled-back read-only transaction',async()=>{
  const client=fake(false),events=[]
  await inspect(client,(...event)=>events.push(event))
  expect(client.calls[0]).toBe('begin transaction isolation level repeatable read read only')
  expect(client.calls.at(-1)).toBe('rollback')
  expect(events.at(-1)).toEqual(['fingerprint','PASS'])
  expect(JSON.stringify(events)).not.toContain('aaaaaaaa')
})
it('classifies client query timeout without emitting error detail and still rolls back',async()=>{
  const client=fake(true),events=[]
  await expect(inspect(client,(...event)=>events.push(event))).rejects.toThrow('Query read timeout')
  expect(events.at(-1)).toEqual(['fingerprint','FAIL','CLIENT_QUERY_TIMEOUT'])
  expect(client.calls.at(-1)).toBe('rollback')
  expect(JSON.stringify(events)).not.toContain('PRIVATE_SECRET')
})
