import {beforeAll,it,expect,vi} from 'vitest'
const state=vi.hoisted(()=>({message:'token=abc123 phone=0901234567'}))
vi.mock('vinext/server/fetch-handler',()=>({default:{fetch:async()=>{throw new Error(state.message)}}}))
let worker:typeof import('../../worker')['default']
beforeAll(async()=>{
 vi.stubGlobal('__DPG_BUILD_SOURCE_SHA__','a'.repeat(40));vi.stubEnv('PUBLIC_CATALOGUE_CHECKPOINT','')
 worker=(await import('../../worker')).default
})
it('keeps failed render non-200 and discloses only a fixed error category',async()=>{
 const log=vi.spyOn(console,'error').mockImplementation(()=>{})
 const response=await worker.fetch(new Request('https://preview.example/ve-chung-toi'),{APP_ENV:'preview',APP_BUILD_TARGET:'public',APP_ORIGIN:'https://preview.invalid',PREVIEW_NOINDEX:'true'},{} as ExecutionContext)
 expect(response.status).toBe(503);expect(response.headers.get('X-DPG-Render-Failure')).toBe('UNCLASSIFIED_EXCEPTION')
 expect(await response.text()).not.toContain('abc123');expect(JSON.stringify(log.mock.calls)).not.toContain('0901234567')
 expect(response.headers.get('Cache-Control')).toContain('no-store');log.mockRestore()
})
it('identifies cross-request I/O without leaking the exception',async()=>{
 const log=vi.spyOn(console,'error').mockImplementation(()=>{})
 state.message='Cannot perform I/O on behalf of a different request'
 const response=await worker.fetch(new Request('https://preview.example/ve-chung-toi'),{APP_ENV:'preview',APP_BUILD_TARGET:'public',APP_ORIGIN:'https://preview.invalid',PREVIEW_NOINDEX:'true'},{} as ExecutionContext)
 expect(response.headers.get('X-DPG-Render-Failure')).toBe('CROSS_REQUEST_IO');expect(response.status).toBe(503);log.mockRestore()
})
