const token = process.env.PUBLISHING_SCHEDULER_TOKEN
const baseUrl = process.env.PUBLISHING_SCHEDULER_URL ?? 'http://127.0.0.1:3000'

if (!token) {
  console.error('PUBLISHING_SCHEDULER_TOKEN is required.')
  process.exit(1)
}

let endpoint
try {
  endpoint = new URL('/api/internal/publishing-scheduler', baseUrl)
} catch {
  console.error('PUBLISHING_SCHEDULER_URL is invalid.')
  process.exit(1)
}

try {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'x-publishing-scheduler-token': token },
    signal: AbortSignal.timeout(55_000),
  })
  if (!response.ok) {
    console.error(`Publishing scheduler invocation failed with HTTP ${response.status}.`)
    process.exit(1)
  }
  const body = await response.json()
  console.log(JSON.stringify({
    result_code: body.result_code,
    processed_count: body.processed_count,
    published_count: body.published_count,
    blocked_count: body.blocked_count,
  }))
} catch {
  console.error('Publishing scheduler invocation failed.')
  process.exit(1)
}
