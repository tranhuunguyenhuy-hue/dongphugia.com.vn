import { execFileSync, spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { describe, expect, it } from 'vitest'

import { ADOPTED_CHECKPOINT_MIGRATIONS, executeRuntimeMigrations } from './supabase-runtime-migrations.mjs'

const { Client } = pg
const postgresImage = process.env.POSTGRES_SNAPSHOT_INTEGRATION_IMAGE
const dockerIntegration = Boolean(postgresImage)

function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

describe('Supabase runtime migration adoption integration', () => {
  it.runIf(dockerIntegration)(
    'attests the checkpoint, applies every remaining migration atomically, and revalidates status',
    async () => {
      const container = `dpg-runtime-migrations-${process.pid}-${Date.now()}`
      docker('run', '--detach', '--name', container, '--publish', '127.0.0.1::5432',
        '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', postgresImage)

      let client
      try {
        for (let attempt = 0; attempt < 45; attempt += 1) {
          const ready = spawnSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres'])
          if (ready.status === 0) break
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
        const port = docker('port', container, '5432/tcp').split(':').at(-1)
        client = new Client({ connectionString: `postgresql://postgres@127.0.0.1:${port}/postgres` })
        await client.connect()
        await client.query(`
          create role anon nologin;
          create role authenticated nologin;
          create role service_role nologin;
          create schema auth;
          create schema storage;
          create schema extensions;
          create extension pgcrypto with schema extensions;
          create function auth.uid() returns uuid language sql stable
            as $$ select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
          create table auth.users (id uuid primary key);
          create table storage.objects (id uuid primary key);
          set search_path to "$user", public, extensions;
        `)

        for (const filename of ADOPTED_CHECKPOINT_MIGRATIONS) {
          await client.query(await readFile(`supabase/migrations/${filename}`, 'utf8'))
        }

        const readonlyAcceptance = (await readFile(
          'supabase/tests/supabase_runtime_adoption_checkpoint.sql', 'utf8',
        )).replace(/^\\set[^\n]*\n/, '')
        const behavioralAcceptance = (await readFile(
          'supabase/tests/supabase_runtime_adoption_behavior.sql', 'utf8',
        )).replace(/^\\set[^\n]*\n/, '')
        await executeRuntimeMigrations(client, 'apply', async () => {
          await client.query(readonlyAcceptance)
          await client.query(behavioralAcceptance)
        })

        const ledger = await client.query('select count(*)::integer as count from dpg_control.runtime_migration_ledger')
        expect(ledger.rows[0]?.count).toBe(22)
        await executeRuntimeMigrations(client, 'status')
      } finally {
        await client?.end().catch(() => undefined)
        spawnSync('docker', ['rm', '--force', container], { stdio: 'ignore' })
      }
    },
    120_000,
  )
})
