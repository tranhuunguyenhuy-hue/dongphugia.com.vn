#!/usr/bin/env node

import { readFile } from 'node:fs/promises'

const files = {
  agent: 'infra/monitoring/cloudwatch-agent.json',
  policy: 'infra/monitoring/ec2-cloudwatch-agent-policy.json',
  template: 'infra/monitoring/cloudwatch-monitoring.yaml',
  collector: 'infra/monitoring/sanitize-docker-observation.sh',
  environment: 'infra/monitoring/monitoring.env.example',
  service: 'infra/monitoring/dpg-sanitized-observation.service',
  timer: 'infra/monitoring/dpg-sanitized-observation.timer',
}

const contents = Object.fromEntries(
  await Promise.all(Object.entries(files).map(async ([key, file]) => [key, await readFile(file, 'utf8')])),
)
const checks = []

function check(name, passed) {
  checks.push({ name, passed })
}

let agent
let policy
try {
  agent = JSON.parse(contents.agent)
  policy = JSON.parse(contents.policy)
  check('agent_json', true)
  check('policy_json', true)
} catch {
  check('agent_json', false)
  check('policy_json', false)
}

if (agent) {
  const logFiles = agent.logs?.logs_collected?.files?.collect_list || []
  check(
    'agent_collects_aggregate_file_only',
    logFiles.length === 1 && logFiles[0].file_path === '/var/log/dongphugia/production-aggregate.jsonl',
  )
  check('agent_uses_aggregate_log_group', logFiles[0]?.log_group_name === '/dongphugia/production/aggregate')
  check('agent_does_not_tail_docker_logs', !contents.agent.includes('/var/lib/docker/containers/'))
  check('agent_avoids_unverified_run_as_user', agent.agent?.run_as_user === undefined)
  check('agent_targets_production_region', agent.agent?.region === 'ap-southeast-1')
  check(
    'agent_avoids_unverified_disk_inode_metric',
    !agent.metrics?.metrics_collected?.disk?.measurement?.includes('inodes_used_percent'),
  )
}

if (policy) {
  const actions = policy.Statement.flatMap((statement) => {
    const value = statement.Action || []
    return Array.isArray(value) ? value : [value]
  })
  check('policy_has_no_secret_reads', !actions.some((action) => /secretsmanager|ssm:(get|describe|put|delete)/i.test(action)))
  check('policy_has_no_application_env_reads', !actions.some((action) => /parameterstore|ssm:getparameter/i.test(action)))
}

check('collector_requires_explicit_allowlist', contents.collector.includes('DPG_MONITOR_CONTAINERS'))
check('collector_emits_configuration_failure', contents.collector.includes('monitoring_configuration_missing'))
check('collector_emits_aggregate_fields', [
  'http_5xx_count',
  'db_error_count',
  'tls_error_count',
  'oom_count',
  'health_failure_count',
].every((field) => contents.collector.includes(field)))
check('example_allowlist_is_empty', /^DPG_MONITOR_CONTAINERS=\s*$/m.test(contents.environment))
check('service_runs_collector', contents.service.includes('ExecStart=/usr/local/libexec/dongphugia/sanitize-docker-observation.sh'))
check('timer_runs_every_minute', contents.timer.includes('OnUnitActiveSec=60s'))
check('template_uses_aggregate_log_group', contents.template.includes('/dongphugia/production/aggregate'))
check('template_has_configuration_alarm', contents.template.includes('MonitoringConfigurationMissing'))

const failed = checks.filter((item) => !item.passed)
console.log(JSON.stringify({ ok: failed.length === 0, checks }))
process.exitCode = failed.length === 0 ? 0 : 1
