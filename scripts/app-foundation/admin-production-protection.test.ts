import { describe, expect, it } from 'vitest'
import { verifyAdminProductionProtection } from './admin-production-protection.mjs'

const config = () => ({ name: 'Production', can_admins_bypass: false, deployment_branch_policy: { protected_branches: false, custom_branch_policies: true }, protection_rules: [{ type: 'required_reviewers', reviewers: [{ type: 'User', reviewer: { id: 258872309 } }] }] })
const policies = () => ({ branch_policies: [{ name: 'main', type: 'branch' }] })
describe('Production Admin release protection', () => {
  it('accepts the exact reviewed reviewer and main-only policy', () => expect(verifyAdminProductionProtection(config(), policies())).toBe(true))
  it('rejects bypass, wrong reviewer and extra branches', () => {
    expect(() => verifyAdminProductionProtection({ ...config(), can_admins_bypass: true }, policies())).toThrow('ADMIN_RELEASE_PRODUCTION_PROTECTION_INVALID')
    expect(() => verifyAdminProductionProtection({ ...config(), protection_rules: [] }, policies())).toThrow('ADMIN_RELEASE_PRODUCTION_PROTECTION_INVALID')
    expect(() => verifyAdminProductionProtection(config(), { branch_policies: [{ name: '*', type: 'branch' }] })).toThrow('ADMIN_RELEASE_PRODUCTION_PROTECTION_INVALID')
  })
})
