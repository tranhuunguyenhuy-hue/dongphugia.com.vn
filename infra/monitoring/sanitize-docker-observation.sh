#!/bin/sh

set -eu
set -f

output_path="${DPG_MONITOR_OUTPUT:-/var/log/dongphugia/production-aggregate.jsonl}"
window_seconds="${DPG_MONITOR_WINDOW_SECONDS:-90}"
container_allowlist="${DPG_MONITOR_CONTAINERS:-}"
output_directory=$(dirname "$output_path")
mkdir -p "$output_directory"
umask 077

timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
container_count=0
missing_container_count=0
log_line_count=0
http_5xx_count=0
db_error_count=0
tls_error_count=0
oom_count=0
health_failure_count=0

if [ -n "$container_allowlist" ]; then
  container_list=$(printf '%s' "$container_allowlist" | tr ',' ' ')
  old_ifs=$IFS
  IFS=' '
  # Container names cannot contain spaces; the allowlist is intentionally explicit.
  set -- $container_list
  IFS=$old_ifs

  for container in "$@"; do
    container_count=$((container_count + 1))
    if ! docker inspect "$container" >/dev/null 2>&1; then
      missing_container_count=$((missing_container_count + 1))
      continue
    fi

    metrics=$(docker logs --since "${window_seconds}s" --tail 5000 "$container" 2>/dev/null | awk '
      {
        text = tolower($0)
        lines++
        if (text ~ /(^|[^0-9])5[0-9][0-9]([^0-9]|$)/) http_5xx++
        if (text ~ /prisma|database.*(error|fail)|postgres.*(error|fail)|econn|deadlock|connection refused/) db_error++
        if (text ~ /tls|certificate|handshake|ssl/) tls_error++
        if (text ~ /oom|out of memory|killed process|memory cgroup/) oom++
        if (text ~ /health_check_failed|health.*fail/) health_failure++
      }
      END {
        printf "%d %d %d %d %d %d", lines + 0, http_5xx + 0, db_error + 0, tls_error + 0, oom + 0, health_failure + 0
      }
    ') || metrics='0 0 0 0 0 0'

    old_ifs=$IFS
    IFS=' '
    read -r current_lines current_http_5xx current_db_error current_tls_error current_oom current_health_failure <<EOF
$metrics
EOF
    IFS=$old_ifs

    log_line_count=$((log_line_count + current_lines))
    http_5xx_count=$((http_5xx_count + current_http_5xx))
    db_error_count=$((db_error_count + current_db_error))
    tls_error_count=$((tls_error_count + current_tls_error))
    oom_count=$((oom_count + current_oom))
    health_failure_count=$((health_failure_count + current_health_failure))
  done
fi

event='runtime_observation'
exit_code=0
if [ -z "$container_allowlist" ] || [ "$missing_container_count" -gt 0 ]; then
  event='monitoring_configuration_missing'
  exit_code=2
fi

printf '{"event":"%s","timestamp":"%s","window_seconds":%s,"container_count":%s,"missing_container_count":%s,"log_line_count":%s,"http_5xx_count":%s,"db_error_count":%s,"tls_error_count":%s,"oom_count":%s,"health_failure_count":%s}\n' \
  "$event" "$timestamp" "$window_seconds" "$container_count" "$missing_container_count" "$log_line_count" "$http_5xx_count" "$db_error_count" "$tls_error_count" "$oom_count" "$health_failure_count" >> "$output_path"
exit "$exit_code"
