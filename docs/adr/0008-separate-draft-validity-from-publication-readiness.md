---
status: accepted
---

# Separate Draft validity from Publication Readiness

Every Draft must pass security, payload, slug, active-taxonomy, restricted-HTML, and Managed Media reference validation, while immediate and Scheduled Publication must also pass a stricter Publication Readiness Gate. Publication or scheduling failure leaves the canonical Blog Post unchanged and never silently falls back to a Draft; the caller must explicitly submit a new mutation. The scheduler repeats both readiness and safety checks immediately before publication, permitting incomplete editorial work to remain private without weakening the zero-touch public boundary or introducing an AI quality-scoring service.
