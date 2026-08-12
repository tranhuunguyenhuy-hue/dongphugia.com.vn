---
status: accepted
---

# Keep the v1 control plane human-operated and audited

V1 will use reviewed admin-only scripts and runbooks, rather than a new CMS control-plane UI, to manage Machine Identities, Integration Sponsors, capabilities, credentials, IP policies, and publishing gates. Control and data-plane mutations produce durable, minimized provenance and audit metadata retained for at least 365 days without credentials or full HTML; operational state and credential-expiry warnings live in the database and structured reports, while email, Slack, webhooks, a separate operation store, and a full media catalog remain later scopes.
