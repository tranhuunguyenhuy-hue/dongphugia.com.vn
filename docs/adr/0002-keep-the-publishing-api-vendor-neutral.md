---
status: accepted
---

# Keep the Publishing API vendor-neutral

The Publishing API will expose vendor-neutral HTTPS REST/JSON under `/api/publishing/v1`, with its OpenAPI 3.1 document at `/api/publishing/v1/openapi.json`, for internally managed Publishing Agents. Publishing Agents own research, content generation, and credential custody; Dongphugia owns authentication, validation, sanitization, persistence, scheduling, and authorized publication, while model SDKs, prompts, workflow orchestration, multi-tenant onboarding, and taxonomy mutation stay outside v1. Post listing is restricted to the calling Machine Identity, uses stable keyset pagination with 20 records by default and 100 at most, and may filter by lifecycle state and update time; authenticated taxonomy discovery returns only active classifications.
