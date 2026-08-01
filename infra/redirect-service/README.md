# Dongphugia apex redirect service

This service is intentionally independent from the Next.js application. It
listens on unprivileged port `8080`, serves `/healthz`, and returns HTTP `308`
for every other request to `https://www.dongphugia.vn$request_uri`.

The image base is pinned to the immutable
`nginxinc/nginx-unprivileged:1.27.5-alpine` digest recorded in the Dockerfile.
It has no database, Bunny, session or application environment variables.

Build and test locally:

```sh
IMAGE=dongphugia-apex-redirect:local
docker build --platform linux/arm64 \
  --build-arg VCS_REF="$(git rev-parse HEAD)" \
  -t "$IMAGE" infra/redirect-service
REDIRECT_TEST_PORT=18081 infra/redirect-service/test.sh "$IMAGE"
```

Coolify deployment must use only explicit Traefik routers and service labels;
leave the Domains/FQDN field empty so Coolify does not create a competing Caddy
redirect. The service must remain dark-only until a separate DNS approval.
