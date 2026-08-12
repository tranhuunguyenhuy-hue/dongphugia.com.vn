---
status: accepted
---

# Keep one canonical Blog Post with optimistic concurrency

The Publishing API, human CMS, and public website will use the same canonical Blog Post rather than an AI-specific store or retained revision model. A Post Version and conditional writes prevent stale Agent or administrator updates; changing a scheduled post invalidates its schedule, while changing a live post requires `posts:write`, `posts:publish`, the current version, and an atomic readiness-checked replacement that becomes public immediately. After first publication the post slug and Blog Category are immutable through the Publishing API, and v1 cannot stage a future replacement, hard-delete or unpublish a live post, or restore an older body.
