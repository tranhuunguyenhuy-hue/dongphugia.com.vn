---
status: accepted
---

# Separate resource identity, operation retry, and concurrency

An External Post ID identifies a Blog Post within one Machine Identity, an idempotency key identifies each mutation across rotating credentials for 30 days, and a Post Version protects the canonical resource from stale writes. Creation requires `If-None-Match: *`, updates require the current ETag through `If-Match`, and idempotency records retain only a request hash, safe response, and resource reference rather than credentials, raw HTML, or media binaries.
