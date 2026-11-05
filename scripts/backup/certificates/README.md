# Supabase database trust anchor

Public CA downloaded on 2026-11-05 over verified HTTPS from:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Supabase Studio publishes this download pattern in its official source:
https://github.com/supabase/supabase/blob/965977876909fe564c24ce63a470948514855a1e/apps/studio/hooks/custom-content/custom-content.json#L63

Certificate SHA-256 fingerprint:
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`

Valid until 2031-04-26 10:56:53 UTC. This is a public certificate, not a private
key or credential. Node PostgreSQL clients using the exact-target parser trust
this CA and retain default hostname verification and rejectUnauthorized=true.
No live certificate is learned or downloaded at runtime. Renew through a
reviewed source update before expiration or provider CA rotation.

The original read-only diagnostic run 41999982149 reached the session pooler
but failed TLS with SELF_SIGNED_CERT_IN_CHAIN. A public, credential-free
PostgreSQL TLS handshake with this CA validated the endpoint's chain and
hostname. Authentication and SQL acceptance remain separate live checks.
