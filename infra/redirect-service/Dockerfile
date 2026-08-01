FROM nginxinc/nginx-unprivileged@sha256:65e3e85dbaed8ba248841d9d58a899b6197106c23cb0ff1a132b7bfe0547e4c0

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
