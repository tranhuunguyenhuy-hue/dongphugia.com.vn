#!/usr/bin/env bash
set -euo pipefail
set +x
umask 077

# The protected recovery key stays on stdin until it is handed to the
# network-disabled PostgreSQL container. Do not create a host-side key file.
unset DOCKER_CONTEXT
export DOCKER_HOST='unix:///var/run/docker.sock'
exec bash scripts/backup/restore-catalogue-runtime.sh
