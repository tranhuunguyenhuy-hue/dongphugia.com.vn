#!/usr/bin/env bash
set -euo pipefail

image="${1:?usage: $0 IMAGE}"
name="dpg-apex-redirect-test-$$"
port="${REDIRECT_TEST_PORT:-18081}"

cleanup() {
  docker rm -f "$name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --rm --name "$name" -p "127.0.0.1:${port}:8080" "$image" >/dev/null

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${port}/healthz" >/dev/null; then
    break
  fi
  sleep 1
done

assert_redirect() {
  local path="$1"
  local expected="https://www.dongphugia.vn${path}"
  local response status location
  response="$(curl --silent --show-error --max-redirs 0 --dump-header - --output /dev/null "http://127.0.0.1:${port}${path}")"
  status="$(printf '%s\n' "$response" | awk 'toupper($1) ~ /^HTTP\// {code=$2} END {print code}')"
  location="$(printf '%s\n' "$response" | awk 'tolower($1)=="location:" {sub(/^[^:]*:[[:space:]]*/, "", $0); print $0}' | tr -d '\r')"
  test "$status" = "308"
  test "$location" = "$expected"
}

test "$(curl -fsS http://127.0.0.1:${port}/healthz)" = "ok"
assert_redirect "/"
assert_redirect "/catalogue/b%C3%B2n-c%E1%BA%A7u?probe=1&sort=asc"
assert_redirect "/encoded%2Fsegment?probe=1"

logs="$(docker logs "$name" 2>&1)"
if printf '%s\n' "$logs" | grep -Eq 'probe=1|sort=asc|%2F'; then
  echo "query string leaked into redirect access logs" >&2
  exit 1
fi
if ! printf '%s\n' "$logs" | grep -Eq '"method":"GET".*"uri":"'; then
  echo "safe redirect access log was not emitted" >&2
  exit 1
fi

response="$(curl --silent --show-error --max-redirs 0 --dump-header - --output /dev/null "http://127.0.0.1:${port}/")"
test "$(printf '%s\n' "$response" | awk 'toupper($1) ~ /^HTTP\// {count++} END {print count}')" = "1"

echo "redirect service tests passed"
