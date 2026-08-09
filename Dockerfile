# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat openssl

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM deps AS builder
COPY . .

ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GTM_ID
ARG BUNNY_CDN_HOSTNAME
ARG DPG_SOURCE_REVISION
ARG DPG_BUILD_RUN_ID
ARG DPG_STAGING_PREVIEW=false

ENV NODE_ENV=production \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_GTM_ID=${NEXT_PUBLIC_GTM_ID} \
    BUNNY_CDN_HOSTNAME=${BUNNY_CDN_HOSTNAME} \
    DPG_SOURCE_REVISION=${DPG_SOURCE_REVISION} \
    DPG_BUILD_RUN_ID=${DPG_BUILD_RUN_ID} \
    DPG_STAGING_PREVIEW=${DPG_STAGING_PREVIEW} \
    DATABASE_URL=postgresql://dpg_build_unreachable:dpg_build_unreachable@127.0.0.1:1/dpg_build_unreachable \
    DIRECT_URL=postgresql://dpg_build_unreachable:dpg_build_unreachable@127.0.0.1:1/dpg_build_unreachable

RUN npx prisma generate && \
    npm run build

FROM node:24-alpine AS runner
WORKDIR /app

ARG DPG_SOURCE_REVISION
ARG DPG_BUILD_RUN_ID
ARG DPG_STAGING_PREVIEW=false

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DPG_SOURCE_REVISION=${DPG_SOURCE_REVISION} \
    DPG_BUILD_RUN_ID=${DPG_BUILD_RUN_ID} \
    DPG_STAGING_PREVIEW=${DPG_STAGING_PREVIEW}

RUN apk add --no-cache libc6-compat openssl && \
    rm -rf /usr/local/lib/node_modules/npm && \
    rm -f /usr/local/bin/npm /usr/local/bin/npx && \
    addgroup -S nodejs && \
    adduser -S nextjs -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/', { signal: AbortSignal.timeout(4000) }).then(async (response) => { await response.body?.cancel(); process.exit(response.ok ? 0 : 1) }).catch(() => process.exit(1))"

CMD ["node", "server.js"]
