// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { setupConfig } from './secure-setup.mjs'
import { SOURCE, TARGET } from './contract.mjs'
import { assertBeforeSetup } from './setup-state.mjs'
const ca='-----BEGIN CERTIFICATE-----\nsynthetic-test-only'
describe('administrative setup boundary',()=>{
  it('uses the observed free source Session route and preserves verify-full TLS',()=>{
    const c=setupConfig(`postgresql://postgres:example@db.${SOURCE}.supabase.co:5432/postgres`,ca,SOURCE)
    expect(c.host).toBe('aws-1-ap-southeast-1.pooler.supabase.com')
    expect(c.user).toBe('postgres.'+SOURCE)
    expect(c.ssl.rejectUnauthorized).toBe(true)
    expect(c.ssl.servername).toBe(c.host)
    expect(c.port).toBe(5432)
  })
  it('requires the approved target binding and never honors connection overrides',()=>{
    const value=`postgresql://postgres.${TARGET}:example@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`
    expect(setupConfig(value,ca,TARGET).port).toBe(5432)
    expect(()=>setupConfig(value,ca,SOURCE)).toThrow('WRONG_PROJECT')
    for(const extra of ['?host=other.test','?sslmode=disable','#override'])
      expect(()=>setupConfig(value+extra,ca,TARGET)).toThrow('SETUP_URI_OPTIONS_FORBIDDEN')
  })
  it('compares complete affected state while ignoring only snapshot envelope fields',()=>{
    const before={tables:[{name:'a',acl:'private',rls:true,rows:0}],sequences:[],sequence_state:[],new_roles:[],new_helper:null,code_sha:'earlier'}
    assertBeforeSetup(before,{...structuredClone(before),code_sha:'later'})
    for(const field of ['acl','rls','rows']) {
      const drift=structuredClone(before);drift.tables[0][field]='changed'
      expect(()=>assertBeforeSetup(before,drift)).toThrow('SETUP_BEFORE_STATE_CHANGED')
    }
    expect(()=>assertBeforeSetup(before,{...before,new_roles:[{rolname:'unexpected'}]})).toThrow('SETUP_BEFORE_STATE_CHANGED')
  })
})
