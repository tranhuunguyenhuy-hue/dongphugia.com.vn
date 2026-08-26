# Dongphugia documentation map

Read the smallest set of sources that answers the active task. This map points
to canonical owners; it is not a second workflow manual.

## Always applicable

- Root [`AGENTS.md`](../AGENTS.md): authority, safety, scope, and gates.
- [`WORKFLOW-WITH-CODEX.md`](WORKFLOW-WITH-CODEX.md): routing, source delivery,
  validation, review, PR, merge, Staging, and release path.
- [`AGENTS.md`](AGENTS.md): application conventions; read only for source work.

## Choose by task

- [Current operational state](ops/project-current-state.md): dated Production
  baseline, active deferrals, incident follow-up, and handoff.
- [Domain context](../CONTEXT.md): canonical catalogue and publishing language.
- [Architecture decisions](adr/): hard-to-reverse technical and policy choices.
- [Deployment procedures](deploy/): target-specific Staging and Production
  procedures. Read only the affected runbook.
- [Design system](DESIGN_SYSTEM.md): UI token and component design work.
- [Public sitemap map](SITEMAP.md): crawl, sitemap, and public URL work.

## Publishing integration

[Publishing API v1 integration guide](integrations/publishing-api-v1-integration-guide.vi.md)
is the single human-readable technical integration guide. The Production OpenAPI
document is its machine-readable contract. The [Publishing operation guide]
(operations/ai-agent-publishing-operation-guide.vi.md) is for approved Content
operators and does not authorize connection, credentials, or Platform changes.

Historical status, crawl, planning, and rollout evidence is not workflow
authority. Retain it in Git history or approved quarantine when required.
