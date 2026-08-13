---
status: accepted
---

# Make Scheduled Publication durable and fail closed

A repository-owned one-shot scheduler, triggered at least once per minute by the accepted host or Coolify path, will perform atomic and duplicate-safe publication transitions under system identity. It rechecks the Machine Identity, `posts:publish`, Global Publishing Gate, write-freeze state, Post Version, and Publication Readiness Gate—but not the continued existence of a Bearer credential—then either makes every public surface current within five minutes, catches up transiently delayed work, or records a Schedule Block that requires explicit rescheduling and never drains silently when authority returns.
