// Must be called with freshly fetched GitHub API responses before credentials
// are exposed; a positive result is not an environment approval.
export function verifyAdminProductionProtection(environment, policies) {
  const reviewers = environment?.protection_rules?.filter((item) => item.type === 'required_reviewers')
  const branch = environment?.deployment_branch_policy
  if (environment?.name !== 'Production' || environment.can_admins_bypass !== false
    || !branch || branch.protected_branches !== false || branch.custom_branch_policies !== true
    || !Array.isArray(policies?.branch_policies) || policies.branch_policies.length !== 1
    || policies.branch_policies[0].name !== 'main' || policies.branch_policies[0].type !== 'branch'
    || !Array.isArray(reviewers) || reviewers.length !== 1
    || !Array.isArray(reviewers[0].reviewers) || reviewers[0].reviewers.length !== 1
    || reviewers[0].reviewers[0].type !== 'User' || reviewers[0].reviewers[0].reviewer?.id !== 258872309) {
    throw new Error('ADMIN_RELEASE_PRODUCTION_PROTECTION_INVALID')
  }
  return true
}
