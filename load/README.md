# Read-only capacity harness

`k6-readonly.js` is deliberately limited to GET traffic. It does not call
quote, order, contact, admin, upload or revalidation write paths, and it
discards response bodies.

## Staging first

Run against the exact ARM64 candidate on staging with synthetic database data:

```sh
k6 run \
  -e BASE_URL=https://<approved-staging-host> \
  -e TARGET_RPS=5 \
  -e DURATION=30s \
  load/k6-readonly.js
```

The approved campaign is warm-up 15 minutes, steady 30 minutes, spike 5
minutes and a bounded two-hour soak. Start at 5 RPS and increase only after
the candidate remains below the thresholds. The first production capacity
target is two times the highest observed 15-minute peak, capped at 20 RPS on
the current `t4g.small` until measured headroom supports a higher limit.

## Production guard

Production refuses to run unless both variables below are present. They are
an authorization marker, not a secret and must identify the approved PM
window:

```sh
ALLOW_PRODUCTION_READONLY_LOAD=true PM_WINDOW_ID=<approved-window-id> \
  BASE_URL=https://www.dongphugia.vn k6 run load/k6-readonly.js
```

Production use requires a fresh maintenance window, pre/post health checks,
write-freeze proof on `.com.vn`, no business writes, and an immediate stop if
5xx exceeds 1%, p95 exceeds two seconds, CPU stays above 80%, memory exceeds
85%, PostgreSQL connections exceed 70%, or a restart/OOM occurs.
