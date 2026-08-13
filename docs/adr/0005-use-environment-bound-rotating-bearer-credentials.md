---
status: accepted
---

# Use environment-bound rotating Bearer credentials

Each Machine Identity will authenticate server-to-server with its own high-entropy opaque Bearer credential, whose secret is shown once and stored only as a hash. Staging and production credentials are separate; production credentials expire after 90 days by default, rotation may overlap at most two active credentials for seven days, expiry never extends on use, and emergency revocation blocks new API requests immediately without changing already published content or independently authorized schedules.
