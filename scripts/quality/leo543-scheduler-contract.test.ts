import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(process.cwd())
const migration = readFileSync(
    resolve(root, 'supabase/migrations/20260829100000_leo543_scheduler.sql'),
    'utf8',
)
const acceptance = readFileSync(
    resolve(root, 'supabase/tests/leo543_scheduler.sql'),
    'utf8',
)

describe('LEO-543 scheduler source contract', () => {
    it('keeps the isolated target and activation gates fail-closed', () => {
        expect(migration).toContain("project_name = 'dongphugia-runtime'")
        expect(migration).toContain("region = 'ap-southeast-1'")
        expect(migration).toContain("environment = 'preview'")
        expect(migration).toContain('production_writes_allowed is false')
        expect(migration).toContain("enabled boolean not null default false")
        expect(migration).toContain("'leo543-publishing-scheduler'")
        expect(migration).toContain("'* * * * *'")
        expect(migration).toContain("cron.alter_job($1, active => false)")
        expect(migration).not.toMatch(/create extension\s+if not exists\s+(pg_cron|pg_net)/i)
        expect(migration).not.toMatch(/vault\.create_secret|create role .* login/i)
    })

    it('records one-slot idempotency, bounded retries, stale recovery, and sanitized freshness', () => {
        expect(migration).toContain('slot_at timestamptz not null unique')
        expect(migration).toContain('pg_try_advisory_xact_lock')
        expect(migration).toContain("'STALE_RUN_RECOVERY'")
        expect(migration).toContain("'HTTP_RETRY_SCHEDULED'")
        expect(migration).toContain("'WRITE_FREEZE_ACTIVE'")
        expect(migration).toContain("'UNEXPECTED_RESPONSE'")
        expect(migration).toContain('assert_free_tier_headroom(4096)')
        expect(migration).toContain('max_ledger_rows integer not null default 10000')
        expect(migration).toContain("'LEDGER_RETENTION_OWNER_DECISION_REQUIRED'")
        expect(migration).not.toMatch(/delete\s+from\s+dpg_control\.leo543_scheduler_runs/i)
        expect(migration).toContain("to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)')")
        expect(migration).toContain("name = 'leo543_scheduler_token'")
        expect(migration).toContain('endpoint_url text')
        expect(migration).toContain('leo543_publishing_freshness')
        expect(migration).toContain('leo543_publishing_freshness_rows')
        expect(migration).toContain('limit least(greatest(coalesce(p_limit, 100), 1), 100)')
        expect(migration).toContain('with (security_invoker = true)')
        expect(migration).toMatch(
            /from dpg_control\.leo543_scheduler_runs run\s+where run\.status = 'succeeded'/i,
        )
        expect(migration).not.toContain('response_content')
        expect(migration).not.toContain("name = 'leo543_scheduler_url'")
        expect(migration).not.toMatch(/grant select on table dpg_control\.leo543_scheduler_config/i)
        expect(migration).not.toMatch(/grant\s+(select|all)\s+on\s+table\s+dpg_control\.leo543_scheduler_runs\s+to\s+dpg_readonly/i)
    })

    it('keeps live acceptance non-mutating and secret-safe', () => {
        expect(acceptance).toContain('This test does not enable the scheduler')
        expect(acceptance).toContain('rollback;')
        expect(acceptance).toContain('set local role dpg_readonly;')
        expect(acceptance).toContain('raw scheduler table read unexpectedly succeeded')
        expect(acceptance).toContain("has_table_privilege('dpg_readonly', 'dpg_control.leo543_scheduler_runs', 'INSERT')")
        expect(acceptance).toContain("has_function_privilege('dpg_readonly', 'dpg_control.leo543_scheduler_tick()', 'EXECUTE')")
        expect(acceptance).not.toMatch(/select\s+.*decrypted_secret/i)
        expect(acceptance).not.toMatch(/insert into dpg_app\.|update dpg_app\.|delete from dpg_app\./i)
    })
})
