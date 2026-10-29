// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

it('loads canonical CommonJS modules from the ESM runner before denying unprotected execution',()=>{
  const result=spawnSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./build-public-projection.mts',import.meta.url))],{
    cwd:fileURLToPath(new URL('../../',import.meta.url)),
    env:{PATH:process.env.PATH,GITHUB_ACTIONS:'false'},encoding:'utf8',timeout:10000,
  })
  expect(result.status).toBe(1)
  expect(result.signal).toBeNull()
  expect(result.stdout).toBe('')
  expect(JSON.parse(result.stderr.trim())).toEqual({status:'STOP',stage:'M4_PUBLIC_PROJECTION',phase:'PRECHECK',reason:'PROTECTED_BUILD_FAILED',sqlCode:null})
})
