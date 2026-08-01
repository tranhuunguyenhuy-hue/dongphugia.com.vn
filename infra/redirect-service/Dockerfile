FROM nginxinc/nginx-unprivileged@sha256:27985295bdb22a1ef8f712863210bd5877c0f3006494a593e86b3fe0fa55467e

ARG VCS_REF=unknown

LABEL org.opencontainers.image.title="Dongphugia apex redirect" \
      org.opencontainers.image.description="Minimal immutable apex-to-canonical redirect service" \
      org.opencontainers.image.source="https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn" \
      org.opencontainers.image.revision="$VCS_REF"

COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf

RUN nginx -t

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:8080/healthz || exit 1

STOPSIGNAL SIGQUIT
