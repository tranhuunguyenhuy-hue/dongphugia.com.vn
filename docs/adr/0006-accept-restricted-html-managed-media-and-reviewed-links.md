---
status: accepted
---

# Accept restricted HTML, Managed Media, and reviewed external links

Publishing API v1 will accept restricted HTML and apply only documented harmless normalization before storing the returned sanitized form; unsupported or dangerous markup fails instead of disappearing silently. Blog Posts may reference at most 20 unique integration-owned Managed Media assets across thumbnail, cover, and inline content, uploaded as binary into Bunny-compatible storage; repeating one asset does not consume another slot. External citations are limited to HTTPS URLs whose exact hostname appears in a reviewed static allowlist, with no wildcard matching, hotlinking of images, remote server fetch, or disclosure of Bunny credentials.
