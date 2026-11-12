# GitHub Actions credential and variable inventory

Snapshot: 2026-11-12; repository owner is a user account, not an organization. Main: f8ad30f148a80f1e976a6516efe0371e9184a7c2; PR #291: 0e6c5a471f6e1fe6182f56b44314fb2d8d8c15ac. Names and workflow references only; no secret or variable values were read into this report.

Environment secrets/variables override identically named repository entries for jobs using that environment; reusable workflow jobs use their declared environment and passed secrets, and environment secrets cannot be passed through workflow_call. References below are literal file matches, not proof of effective scope or use. Runtime indirection, old workflow versions and external integrations are not covered.

## Configured entries and literal workflow consumers

Each row lists location, type, name, and workflow filenames on main / PR respectively. A dash means no literal reference was found, not that an entry is safe to delete.

| Location | Type | Name | Main references | PR references |
| --- | --- | --- | --- | --- |
| Repository | secrets | CLOUDFLARE_ACCOUNT_ID | catalogue-preview-diagnostic.yml, catalogue-public-preview-v2.yml, catalogue-public-preview.yml, leo560-shadow-import.yml, migration-preview.yml, production-promotion.yml, public-production-worker.yml | catalogue-preview-diagnostic.yml, catalogue-public-preview-v2.yml, catalogue-public-preview.yml, leo560-shadow-import.yml, migration-preview.yml, preview-public-admin.yml, production-promotion.yml, public-production-worker.yml |
| Repository | secrets | CLOUDFLARE_API_TOKEN | production-promotion.yml, public-production-worker.yml | production-promotion.yml, public-production-worker.yml |
| Repository | secrets | CLOUDFLARE_LEO563_PREVIEW_TOKEN | catalogue-preview-diagnostic.yml, catalogue-public-preview-v2.yml, catalogue-public-preview.yml, migration-preview.yml | catalogue-preview-diagnostic.yml, catalogue-public-preview-v2.yml, catalogue-public-preview.yml |
| Repository | secrets | CLOUDFLARE_READONLY_DISCOVERY_TOKEN | leo560-shadow-import.yml, migration-preview.yml | leo560-shadow-import.yml, migration-preview.yml |
| Repository | secrets | DATABASE_URL | catalogue-checkpoint-key.yml | catalogue-checkpoint-key.yml |
| Repository | secrets | DIRECT_URL | catalogue-checkpoint-key.yml | catalogue-checkpoint-key.yml |
| Repository | secrets | MIGRATION_PREVIEW_DATABASE_URL | — | migration-preview.yml |
| Repository | secrets | PHASE2_PREVIEW_ORDER_INTAKE_SIGNING_SECRET | — | migration-preview.yml, preview-public-admin.yml |
| Repository | vars | CLOUDFLARE_PAGES_PREVIEW_ENABLED | — | — |
| Repository | vars | CLOUDFLARE_PAGES_PREVIEW_PROJECT | — | — |
| Repository | vars | MIGRATION_PREVIEW_DATABASE_SSL_ROOT_CA_PEM | — | migration-preview.yml |
| Repository | vars | MIGRATION_PREVIEW_SOURCE_CONTRACT | — | — |
| Repository | vars | MIGRATION_PREVIEW_SOURCE_ENABLED | — | — |
| Repository | vars | PREVIEW_SUPABASE_PUBLISHABLE_KEY | — | migration-preview.yml, preview-public-admin.yml |
| Repository | vars | PRODUCTION_PUBLISHING_BUNNY_CDN_HOSTNAME | production-candidate.yml | production-candidate.yml |
| catalogue-direct-migration | secrets | DIRECT_CHECKPOINT_AGE_IDENTITY | catalogue-checkpoint-key.yml, catalogue-direct-migration.yml, catalogue-direct-setup.yml | catalogue-checkpoint-key.yml, catalogue-direct-migration.yml, catalogue-direct-setup.yml |
| catalogue-direct-migration | secrets | DIRECT_SOURCE_CA | catalogue-direct-migration.yml, catalogue-direct-setup.yml | catalogue-direct-migration.yml, catalogue-direct-setup.yml |
| catalogue-direct-migration | secrets | DIRECT_SOURCE_DATABASE_URL | catalogue-direct-migration.yml | catalogue-direct-migration.yml |
| catalogue-direct-migration | secrets | DIRECT_TARGET_CA | catalogue-direct-migration.yml, catalogue-direct-setup.yml, catalogue-public-preview-v2.yml | catalogue-direct-migration.yml, catalogue-direct-setup.yml, catalogue-public-preview-v2.yml |
| catalogue-direct-migration | secrets | DIRECT_TARGET_IMPORT_DATABASE_URL | catalogue-direct-migration.yml | catalogue-direct-migration.yml |
| catalogue-direct-migration | secrets | DIRECT_TARGET_READ_DATABASE_URL | catalogue-direct-migration.yml, catalogue-public-preview-v2.yml | catalogue-direct-migration.yml, catalogue-public-preview-v2.yml |
| catalogue-direct-migration | secrets | DIRECT_VAULT_REPOSITORY | catalogue-checkpoint-key.yml, catalogue-checkpoint-vault-audit.yml, catalogue-direct-migration.yml, catalogue-direct-setup.yml | catalogue-checkpoint-key.yml, catalogue-checkpoint-vault-audit.yml, catalogue-direct-migration.yml, catalogue-direct-setup.yml |
| catalogue-direct-migration | secrets | DIRECT_VAULT_TOKEN | catalogue-checkpoint-key.yml, catalogue-checkpoint-vault-audit.yml, catalogue-direct-migration.yml, catalogue-direct-setup.yml | catalogue-checkpoint-key.yml, catalogue-checkpoint-vault-audit.yml, catalogue-direct-migration.yml, catalogue-direct-setup.yml |
| catalogue-direct-migration | vars | DIRECT_CHECKPOINT_AGE_RECIPIENT | catalogue-direct-setup.yml | catalogue-direct-setup.yml |
| catalogue-direct-migration | vars | DIRECT_CLOUDFLARE_FREE_ATTESTATION | catalogue-public-preview.yml | catalogue-public-preview.yml |
| catalogue-direct-migration | vars | DIRECT_ZERO_COST_ATTESTATION | catalogue-direct-migration.yml, catalogue-direct-setup.yml, catalogue-preview-diagnostic.yml | catalogue-direct-migration.yml, catalogue-direct-setup.yml, catalogue-preview-diagnostic.yml |
| catalogue-direct-migration | vars | DIRECT_ZERO_COST_CANDIDATE_EVIDENCE | catalogue-public-preview.yml | catalogue-public-preview.yml |
| catalogue-direct-migration | vars | DIRECT_ZERO_COST_PREVIEW_PUBLICATION_EVIDENCE | catalogue-public-preview.yml | catalogue-public-preview.yml |
| pr-preview | secrets | PREVIEW_CLOUDFLARE_API_TOKEN | pr-preview-cleanup.yml, pr-preview-publish.yml | pr-preview-cleanup.yml, pr-preview-publish.yml |
| pr-preview | vars | PREVIEW_CLOUDFLARE_ACCOUNT_ID | pr-preview-cleanup.yml, pr-preview-publish.yml | pr-preview-cleanup.yml, pr-preview-publish.yml |
| pr-preview | vars | PREVIEW_WORKERS_SUBDOMAIN | pr-preview-publish.yml | pr-preview-publish.yml |
| Production | secrets | CLOUDFLARE_ACCOUNT_ID | catalogue-preview-diagnostic.yml, catalogue-public-preview-v2.yml, catalogue-public-preview.yml, leo560-shadow-import.yml, migration-preview.yml, production-promotion.yml, public-production-worker.yml | catalogue-preview-diagnostic.yml, catalogue-public-preview-v2.yml, catalogue-public-preview.yml, leo560-shadow-import.yml, migration-preview.yml, preview-public-admin.yml, production-promotion.yml, public-production-worker.yml |
| Production | secrets | CLOUDFLARE_API_TOKEN | production-promotion.yml, public-production-worker.yml | production-promotion.yml, public-production-worker.yml |
| Production | vars | PRODUCTION_PUBLISHING_BUNNY_CDN_HOSTNAME | production-candidate.yml | production-candidate.yml |
| runtime-backup | secrets | B11_RECOVERY_AGE_IDENTITY | c-actions-recipient-diagnostic-once.yml, c-actions-recovery.yml | c-actions-recipient-diagnostic-once.yml, c-actions-recovery.yml |
| runtime-backup | secrets | B11_VAULT_CONTENTS_TOKEN | b11-private-rewrap.yml, c-actions-recovery.yml | b11-private-rewrap.yml, c-actions-recovery.yml |
| runtime-backup | secrets | BACKUP_AGE_PRIVATE_KEY | b11-private-rewrap.yml, c-actions-original-authentic-recovery-go-6442512635.yml, c-actions-original-authentic-recovery-once.yml, c-actions-original-key-diagnostic-once.yml, existing-state-backup.yml, runtime-backup.yml, supabase-runtime-rehome.yml | b11-private-rewrap.yml, c-actions-original-authentic-recovery-go-6442512635.yml, c-actions-original-authentic-recovery-once.yml, c-actions-original-key-diagnostic-once.yml, existing-state-backup.yml, runtime-backup.yml, supabase-runtime-rehome.yml |
| runtime-backup | secrets | SUPABASE_MANAGEMENT_TOKEN | existing-state-backup.yml, leo560-shadow-import.yml, supabase-backup-role-bootstrap.yml, supabase-management-token-preflight.yml, supabase-runtime-rehome.yml | existing-state-backup.yml, leo560-shadow-import.yml, supabase-backup-role-bootstrap.yml, supabase-management-token-preflight.yml, supabase-runtime-rehome.yml |
| runtime-backup | secrets | SUPABASE_REHOME_DATABASE_URL | catalogue-checkpoint-key.yml, existing-state-backup.yml, supabase-backup-role-bootstrap.yml, supabase-database-preflight.yml, supabase-runtime-rehome.yml | catalogue-checkpoint-key.yml, existing-state-backup.yml, supabase-backup-role-bootstrap.yml, supabase-database-preflight.yml, supabase-runtime-rehome.yml |
| runtime-backup | secrets | SUPABASE_RUNTIME_DATABASE_URL | catalogue-checkpoint-key.yml, existing-state-backup.yml, runtime-backup.yml | catalogue-checkpoint-key.yml, existing-state-backup.yml, runtime-backup.yml |
| runtime-backup | secrets | SUPABASE_RUNTIME_MIGRATION_URL | leo560-shadow-import.yml | leo560-shadow-import.yml |
| runtime-backup | vars | BACKUP_AGE_RECIPIENT | existing-state-backup.yml, leo560-shadow-import.yml, runtime-backup.yml | existing-state-backup.yml, leo560-shadow-import.yml, runtime-backup.yml |
| runtime-backup | vars | BACKUP_RETENTION_DAYS | runtime-backup.yml | runtime-backup.yml |
| staging | vars | COOLIFY_STAGING_APPLICATION_UUID | — | — |
| staging | vars | STAGING_BUNNY_CDN_HOSTNAME | — | — |
| staging | vars | STAGING_PUBLISHING_BUNNY_CDN_HOSTNAME | — | — |
| staging | vars | STAGING_SITE_URL | — | — |

## Referenced names absent from the enumerated repository/environment locations

These include optional or historical references, reusable-workflow inputs and built-in GITHUB_TOKEN; absence here does not prove a runtime error or lack of organization/user/inherited context.

| Type | Name | Main references | PR references |
| --- | --- | --- | --- |
| secrets | BACKUP_FAILURE_WEBHOOK_URL | runtime-backup.yml | runtime-backup.yml |
| secrets | CLOUDFLARE_PHASE2_PREVIEW_TOKEN | — | preview-public-admin.yml |
| secrets | DIRECT_SOURCE_SETUP_DATABASE_URL | catalogue-direct-setup.yml | catalogue-direct-setup.yml |
| secrets | DIRECT_TARGET_SETUP_DATABASE_URL | catalogue-direct-setup.yml | catalogue-direct-setup.yml |
| secrets | DPG_ARTIFACT_HANDOFF_TOKEN | catalogue-public-preview.yml | catalogue-public-preview.yml |
| secrets | DPG_ARTIFACT_HANDOFF_URL | catalogue-public-preview.yml | catalogue-public-preview.yml |
| secrets | GITHUB_TOKEN | production-candidate.yml, staging-ghcr.yml | production-candidate.yml, staging-ghcr.yml |
| secrets | LEO560_SNAPSHOT_URL | leo560-shadow-import.yml | leo560-shadow-import.yml |
| vars | B11_REWRAP_APPROVED_SHA | b11-private-rewrap.yml | b11-private-rewrap.yml |
| vars | CLOUDFLARE_PAGES_PRODUCTION_PROJECT | production-promotion.yml | production-promotion.yml |
| vars | C_RECOVERY_APPROVED_SHA | c-actions-recovery.yml | c-actions-recovery.yml |
| vars | PRODUCTION_PROMOTION_ENABLED | production-promotion.yml | production-promotion.yml |

## Counts and other stores

Actions repository plus environments: 26 secret entries and 21 variable entries across 10 environments. Empty environments: Preview, Production – dongphugia, Production – dongphugia-com-vn, Production – dongphugia.com.vn, restore-rehearsal.
The repository is user-owned; no organization scope applies. Separate read-only GitHub API queries found zero repository Dependabot secrets and zero repository Codespaces secrets; these are separate stores and excluded from Actions totals.

## Credential contract by need and environment

This is the observed contract as of 2026-11-12. A configured name or a green source check does not establish that the credential has the required scope.

| Need | Current configured credential and consumers | Scope evidence | Contract status |
| --- | --- | --- | --- |
| Generic public PR artifact Preview and cleanup | `pr-preview` environment: `PREVIEW_CLOUDFLARE_API_TOKEN`, `PREVIEW_CLOUDFLARE_ACCOUNT_ID`, `PREVIEW_WORKERS_SUBDOMAIN`; `pr-preview-publish.yml` and `pr-preview-cleanup.yml` | Live secret policy metadata was not readable in this audit. This purpose/account boundary is distinct from the integrated Phase 2 Workers and their Supabase bindings. | Configured; exact permissions/resource scope UNKNOWN. |
| Catalogue Preview | Repository secret `CLOUDFLARE_LEO563_PREVIEW_TOKEN`, consumed by catalogue Preview workflows and migration Preview; those jobs use `catalogue-direct-migration` where declared. | The exact PR #291 run 43140592722 verified an active token internally, then failed to read its account-owned and user-owned token detail records. Its sanitized artifact records `TOKEN_SCOPE_DETAILS_DENIED` and both attempted detail sources. No Worker write ran. | Existing shared credential; account/type/permissions/resource map/expiry UNKNOWN. |
| Integrated Phase 2 Preview Public, Admin and receipt diagnostic | Current PR #291 source expects `CLOUDFLARE_PHASE2_PREVIEW_TOKEN` in environment `phase2-preview` in three publisher jobs. The live GitHub inventory contains neither that environment nor that secret. | No value or effective policy exists at this destination. The earlier run used `CLOUDFLARE_LEO563_PREVIEW_TOKEN`; its token details could not be retrieved. | Source reference exists; credential contract unavailable. Do not treat it as provisioned. |
| Production Worker deployment | `Production` environment `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, consumed by Production workflows | Production scope is a separate trust boundary. No Preview job may use this environment or its credentials. | Separate; not a Preview candidate. |
| Read-only Worker discovery | Repository `CLOUDFLARE_READONLY_DISCOVERY_TOKEN`, referenced by discovery jobs | Exact-head discovery artifact succeeded and reports resource identities/binding names only; token's own permission metadata is not included. | Read-only consumer; scope beyond observed reads UNKNOWN. |

The integrated publisher's historical exact-SHA attestation used the existing repository secret `CLOUDFLARE_LEO563_PREVIEW_TOKEN` (verified at source SHA `489dabce5e90b909a3939c1079d6b0846c42f1dc`). The sanitized artifact from run [43140592722](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/actions/runs/43140592722) says the account-owned and user-owned token detail reads were both denied. The code reached those reads only after the credential verification endpoint returned an active token ID/status. The artifact does not preserve per-endpoint HTTP status; this PR change adds only source label, HTTP status or fixed fetch-failure enum to future sanitized evidence, never response bodies or credential values.

This audit also queried Cloudflare's connected read-only identity. `GET /accounts/d54f3402b9d112ab64d6135e0e3f1fb1/tokens` returned one account-owned token named `dongphugia-preview-github` with `Pages Write`; it is not the GitHub secret and has no Workers Editor scope. `GET /user/tokens` returned HTTP 403, error code 9109 (`Unauthorized to access requested resource`); Cloudflare specified `API Tokens Read` or `API Tokens Write` as the needed permission. Therefore this read path could not reveal user-owned token names or policy details. It did not read or change any secret.

The missing nonsecret fields for `CLOUDFLARE_LEO563_PREVIEW_TOKEN` are its owner type, effective account, permission group IDs/names, exact selected resources, expiry and credential custodian. No evidence establishes that its current permissions allow deployments to the Phase 2 Preview Workers or creation/removal of the temporary diagnostic Worker. Cloudflare's [Workers roles and permissions documentation](https://developers.cloudflare.com/workers/authorization/workers/) says Individual Workers Editor applies to selected existing Workers; it does not authorize creating a Worker that does not exist. The [API token permission reference](https://developers.cloudflare.com/fundamentals/api/reference/permissions/) distinguishes user and account token-read permissions.

The source still contains the `phase2-preview` secret reference, but no hosted environment or value is configured. The source-only contract work does not populate it or map another secret into that reference. The exact next credential evidence can be supplied without disclosing any value: the custodian can report the existing secret's Cloudflare owner type, account, permission groups, selected Worker names, expiry and consumer list from its token details page. Until those facts are established, both reuse of `CLOUDFLARE_LEO563_PREVIEW_TOKEN` for integrated deployment and any change to its permissions remain UNKNOWN. There is no supported basis in this audit to remove any entry or claim a completed consolidation.

No provider, credential, secret or environment changes were made by this audit.

## Job-level environment and reusable workflow map

Static job definitions and literal expression references; a caller may pass a declared secret to a reusable job, and environment-level values shadow same-named repository values. Dynamic environment expressions and inherited secrets require run-specific verification.

| Revision | Workflow / job | Environment | Reusable workflow | Literal references |
| --- | --- | --- | --- | --- |
| main + PR | b11-private-rewrap.yml / rewrap | runtime-backup | — | secrets.B11_VAULT_CONTENTS_TOKEN, secrets.BACKUP_AGE_PRIVATE_KEY, vars.B11_REWRAP_APPROVED_SHA |
| main + PR | c-actions-original-authentic-recovery-go-6442512635.yml / recover | runtime-backup | — | secrets.BACKUP_AGE_PRIVATE_KEY |
| main + PR | c-actions-original-authentic-recovery-once.yml / recover | runtime-backup | — | secrets.BACKUP_AGE_PRIVATE_KEY |
| main + PR | c-actions-original-key-diagnostic-once.yml / diagnose | runtime-backup | — | secrets.BACKUP_AGE_PRIVATE_KEY |
| main + PR | c-actions-recipient-diagnostic-once.yml / diagnose | runtime-backup | — | secrets.B11_RECOVERY_AGE_IDENTITY |
| main + PR | c-actions-recovery.yml / recover | runtime-backup | — | secrets.B11_RECOVERY_AGE_IDENTITY, secrets.B11_VAULT_CONTENTS_TOKEN, vars.C_RECOVERY_APPROVED_SHA |
| main + PR | catalogue-checkpoint-key.yml / bootstrap | catalogue-direct-migration | — | secrets.DIRECT_CHECKPOINT_AGE_IDENTITY, secrets.DIRECT_VAULT_REPOSITORY, secrets.DIRECT_VAULT_TOKEN |
| main + PR | catalogue-checkpoint-key.yml / connection-metadata | runtime-backup | — | secrets.DATABASE_URL, secrets.DIRECT_URL, secrets.SUPABASE_REHOME_DATABASE_URL, secrets.SUPABASE_RUNTIME_DATABASE_URL |
| main + PR | catalogue-checkpoint-vault-audit.yml / audit | catalogue-direct-migration | — | secrets.DIRECT_VAULT_REPOSITORY, secrets.DIRECT_VAULT_TOKEN |
| main + PR | catalogue-direct-migration.yml / execute | catalogue-direct-migration | — | secrets.DIRECT_CHECKPOINT_AGE_IDENTITY, secrets.DIRECT_SOURCE_CA, secrets.DIRECT_SOURCE_DATABASE_URL, secrets.DIRECT_TARGET_CA, secrets.DIRECT_TARGET_IMPORT_DATABASE_URL, secrets.DIRECT_TARGET_READ_DATABASE_URL, secrets.DIRECT_VAULT_REPOSITORY, secrets.DIRECT_VAULT_TOKEN, vars.DIRECT_ZERO_COST_ATTESTATION |
| main + PR | catalogue-direct-setup.yml / setup | catalogue-direct-migration | — | secrets.DIRECT_CHECKPOINT_AGE_IDENTITY, secrets.DIRECT_SOURCE_CA, secrets.DIRECT_SOURCE_SETUP_DATABASE_URL, secrets.DIRECT_TARGET_CA, secrets.DIRECT_TARGET_SETUP_DATABASE_URL, secrets.DIRECT_VAULT_REPOSITORY, secrets.DIRECT_VAULT_TOKEN, vars.DIRECT_CHECKPOINT_AGE_RECIPIENT, vars.DIRECT_ZERO_COST_ATTESTATION |
| main + PR | catalogue-preview-diagnostic.yml / diagnose | catalogue-direct-migration | — | secrets.CLOUDFLARE_ACCOUNT_ID, secrets.CLOUDFLARE_LEO563_PREVIEW_TOKEN, vars.DIRECT_ZERO_COST_ATTESTATION |
| main + PR | catalogue-public-preview-v2.yml / public-preview | catalogue-direct-migration | — | secrets.CLOUDFLARE_ACCOUNT_ID, secrets.CLOUDFLARE_LEO563_PREVIEW_TOKEN, secrets.DIRECT_TARGET_CA, secrets.DIRECT_TARGET_READ_DATABASE_URL |
| main + PR | catalogue-public-preview.yml / public-preview | catalogue-direct-migration | — | secrets.CLOUDFLARE_ACCOUNT_ID, secrets.CLOUDFLARE_LEO563_PREVIEW_TOKEN, secrets.DPG_ARTIFACT_HANDOFF_TOKEN, secrets.DPG_ARTIFACT_HANDOFF_URL, vars.DIRECT_CLOUDFLARE_FREE_ATTESTATION, vars.DIRECT_ZERO_COST_CANDIDATE_EVIDENCE, vars.DIRECT_ZERO_COST_PREVIEW_PUBLICATION_EVIDENCE |
| main + PR | existing-state-backup.yml / execute | runtime-backup | — | secrets.BACKUP_AGE_PRIVATE_KEY, secrets.SUPABASE_MANAGEMENT_TOKEN, secrets.SUPABASE_REHOME_DATABASE_URL, secrets.SUPABASE_RUNTIME_DATABASE_URL, vars.BACKUP_AGE_RECIPIENT |
| main + PR | leo560-shadow-import.yml / shadow-import | runtime-backup | — | secrets.CLOUDFLARE_ACCOUNT_ID, secrets.CLOUDFLARE_READONLY_DISCOVERY_TOKEN, secrets.LEO560_SNAPSHOT_URL, secrets.SUPABASE_MANAGEMENT_TOKEN, secrets.SUPABASE_RUNTIME_MIGRATION_URL, vars.BACKUP_AGE_RECIPIENT |
| PR | migration-preview.yml / app-preview-artifact | repository/default | — | vars.PREVIEW_SUPABASE_PUBLISHABLE_KEY |
| main | migration-preview.yml / cloudflare-preview-upload | repository/default | — | secrets.CLOUDFLARE_ACCOUNT_ID, secrets.CLOUDFLARE_LEO563_PREVIEW_TOKEN |
| main + PR | migration-preview.yml / cloudflare-readonly-discovery | repository/default | — | secrets.CLOUDFLARE_ACCOUNT_ID, secrets.CLOUDFLARE_READONLY_DISCOVERY_TOKEN |
| PR | migration-preview.yml / preview-public-admin | repository/default | ./.github/workflows/preview-public-admin.yml | secrets.CLOUDFLARE_ACCOUNT_ID, secrets.PHASE2_PREVIEW_ORDER_INTAKE_SIGNING_SECRET |
| PR | migration-preview.yml / synthetic-preview-migrations | repository/default | — | secrets.MIGRATION_PREVIEW_DATABASE_URL, vars.MIGRATION_PREVIEW_DATABASE_SSL_ROOT_CA_PEM |
| main + PR | pr-preview-cleanup.yml / cleanup | pr-preview | — | secrets.PREVIEW_CLOUDFLARE_API_TOKEN, vars.PREVIEW_CLOUDFLARE_ACCOUNT_ID |
| main + PR | pr-preview-publish.yml / publish | pr-preview | — | secrets.PREVIEW_CLOUDFLARE_API_TOKEN, vars.PREVIEW_CLOUDFLARE_ACCOUNT_ID, vars.PREVIEW_WORKERS_SUBDOMAIN |
| PR | preview-public-admin.yml / admin-preview-upload | phase2-preview | — | secrets.CLOUDFLARE_ACCOUNT_ID, secrets.CLOUDFLARE_PHASE2_PREVIEW_TOKEN, vars.PREVIEW_SUPABASE_PUBLISHABLE_KEY |
| PR | preview-public-admin.yml / order-intake-diagnostic | phase2-preview | — | secrets.CLOUDFLARE_ACCOUNT_ID, secrets.CLOUDFLARE_PHASE2_PREVIEW_TOKEN, secrets.PHASE2_PREVIEW_ORDER_INTAKE_SIGNING_SECRET, vars.PREVIEW_SUPABASE_PUBLISHABLE_KEY |
| PR | preview-public-admin.yml / public-preview-upload | phase2-preview | — | secrets.CLOUDFLARE_ACCOUNT_ID, secrets.CLOUDFLARE_PHASE2_PREVIEW_TOKEN, secrets.PHASE2_PREVIEW_ORDER_INTAKE_SIGNING_SECRET, vars.PREVIEW_SUPABASE_PUBLISHABLE_KEY |
| main + PR | production-candidate.yml / build | repository/default | — | secrets.GITHUB_TOKEN, vars.PRODUCTION_PUBLISHING_BUNNY_CDN_HOSTNAME |
| main + PR | production-promotion.yml / production-enable-gate | repository/default | — | vars.PRODUCTION_PROMOTION_ENABLED |
| main + PR | production-promotion.yml / production-promotion | production | — | secrets.CLOUDFLARE_ACCOUNT_ID, secrets.CLOUDFLARE_API_TOKEN, vars.CLOUDFLARE_PAGES_PRODUCTION_PROJECT |
| main + PR | public-production-worker.yml / deploy | Production | — | secrets.CLOUDFLARE_ACCOUNT_ID, secrets.CLOUDFLARE_API_TOKEN |
| main + PR | runtime-backup.yml / alert | runtime-backup | — | secrets.BACKUP_FAILURE_WEBHOOK_URL |
| main + PR | runtime-backup.yml / backup | runtime-backup | — | secrets.SUPABASE_RUNTIME_DATABASE_URL, vars.BACKUP_AGE_RECIPIENT, vars.BACKUP_RETENTION_DAYS |
| main + PR | runtime-backup.yml / restore | runtime-backup | — | secrets.BACKUP_AGE_PRIVATE_KEY |
| main + PR | staging-ghcr.yml / isolated-staging | repository/default | — | secrets.GITHUB_TOKEN |
| main + PR | supabase-backup-role-bootstrap.yml / bootstrap | runtime-backup | — | secrets.SUPABASE_MANAGEMENT_TOKEN, secrets.SUPABASE_REHOME_DATABASE_URL |
| main + PR | supabase-database-preflight.yml / verify | runtime-backup | — | secrets.SUPABASE_REHOME_DATABASE_URL |
| main + PR | supabase-management-token-preflight.yml / verify | runtime-backup | — | secrets.SUPABASE_MANAGEMENT_TOKEN |
| main + PR | supabase-runtime-rehome.yml / restore | runtime-backup | — | secrets.BACKUP_AGE_PRIVATE_KEY, secrets.SUPABASE_MANAGEMENT_TOKEN, secrets.SUPABASE_REHOME_DATABASE_URL |
