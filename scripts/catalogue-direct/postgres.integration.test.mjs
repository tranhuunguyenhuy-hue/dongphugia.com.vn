// @vitest-environment node
import pg from 'pg'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CATALOGUE_TABLES, CATALOGUE_RESTORE_ORDER, insertSql, rowsSql, provisioningSql, assertSchema } from './contract.mjs'
import { metadata } from './run.mjs'

const url = process.env.POSTGRES_SNAPSHOT_INTEGRATION_URL
describe.skipIf(!url)('direct data-only mapping on isolated PostgreSQL', () => {
  it('preserves all 27 table hashes, precision, FK/keys and rolls back rows AND sequence restart', async () => {
    const base = new URL(url)
    // This fixture must never connect to either approved remote database or any arbitrary host.
    expect(['127.0.0.1', 'localhost', '[::1]']).toContain(base.hostname)
    const admin = new pg.Client({ connectionString: url })
    await admin.connect()
    const database = `direct_fixture_${process.pid}_${Date.now()}`
    let client, createdRole = false, createdGuest = false
    const guest = `direct_guest_${process.pid}`
    try {
      await admin.query(`create database ${database}`)
      base.pathname = '/' + database
      client = new pg.Client({ connectionString: base.toString() }); await client.connect()
      await client.query('create schema dpg_app')
      for (const namespace of ['public', 'dpg_app']) for (const table of CATALOGUE_TABLES) {
        await client.query(`create table ${namespace}.${table}(id serial primary key,label text,amount numeric(30,2),payload jsonb);
          alter table ${namespace}.${table} enable row level security;
          alter table ${namespace}.${table} force row level security`)
      }
      await client.query('alter table public.products add foreign key(id) references public.brands(id)')
      await client.query('alter table dpg_app.products add foreign key(id) references dpg_app.brands(id)')
      const parity = readFileSync(new URL('./target-parity.sql', import.meta.url), 'utf8')
      const extraColumns = new Map(CATALOGUE_TABLES.map((t) => [t, new Set()]))
      for (const match of parity.matchAll(/alter table dpg_app\."([a-z_]+)" add constraint \w+ UNIQUE \(([^)]+)\)/g)) {
        for (const column of match[2].split(', ')) extraColumns.get(match[1]).add(column)
      }
      extraColumns.get('products').add('stock_status')
      extraColumns.get('product_descriptions').add('clean_issues')
      extraColumns.get('spec_options').add('aliases')
      for (const namespace of ['public', 'dpg_app']) {
        for (const [table, columns] of extraColumns) for (const column of columns) {
          await client.query(`alter table ${namespace}.${table} add column if not exists ${column} text default '${column === 'stock_status' ? 'in_stock' : ''}'`)
        }
        // Both sides are synthetic. Apply the same reviewed parity definitions to
        // prove constraints/nullability without touching either real database.
        if (namespace === 'dpg_app') {
          const failing = parity.replace('\ncommit;', "\ndo $fixture_fail$ begin raise exception 'INJECTED_PREPARE_FAILURE'; end $fixture_fail$;\ncommit;")
          await expect(client.query(failing)).rejects.toMatchObject({ code: 'P0001' })
          await client.query('rollback')
          expect((await client.query("select count(*)::text as n from pg_constraint where connamespace='dpg_app'::regnamespace and conname like 'direct_parity_%'")).rows[0].n).toBe('0')
        }
        await client.query(parity.replaceAll('dpg_app.', `${namespace}.`))
      }
      for (const table of CATALOGUE_TABLES) {
        await client.query(`insert into public.${table}(id,label,amount,payload) values (1,$1,9007199254740993123.25,$2)`,
          ['Tiếng Việt\nquote"\\', JSON.stringify({ text: 'a\nb', nullable: null })])
      }
      await client.query('set search_path=pg_catalog')
      assertSchema(await metadata(client, 'public'), await metadata(client, 'dpg_app'))
      await client.query(`create role ${guest} nologin`); createdGuest = true
      await client.query(`alter default privileges in schema dpg_app grant execute on functions to ${guest}`)
      const failedProvision = provisioningSql('import').replace('\ncommit;', "\ndo $fixture_fail$ begin raise exception 'INJECTED_ROLE_FAILURE'; end $fixture_fail$;\ncommit;")
      await expect(client.query(failedProvision)).rejects.toMatchObject({ code: 'P0001' })
      await client.query('rollback')
      expect((await client.query("select to_regrole('dpg_direct_import') as role")).rows[0].role).toBeNull()
      await client.query(provisioningSql('import')); createdRole = true
      expect((await client.query("select has_function_privilege($1,'dpg_app.direct_catalogue_restart(text,text,bigint)','EXECUTE') as allowed", [guest])).rows[0].allowed).toBe(false)
      const source = new Map()
      const columns = new Map((await metadata(client, 'public')).map((t) => [t.name, t.columns.map((c) => c.name)]))
      for (const table of CATALOGUE_RESTORE_ORDER) source.set(table, (await client.query(rowsSql('public', table))).rows.map((r) => r.row_text))
      await client.query('set session authorization dpg_direct_import')
      await client.query('begin')
      for (const table of CATALOGUE_RESTORE_ORDER) await client.query(insertSql(table, columns.get(table)),
        ['[' + source.get(table).join(',') + ']'])
      await client.query("select dpg_app.direct_catalogue_restart('products','id',2)")
      expect((await client.query('select last_value::text,is_called from dpg_app.products_id_seq')).rows[0])
        .toEqual({ last_value: '2', is_called: false })
      await expect(client.query('insert into dpg_app.products(id) values(1)')).rejects.toMatchObject({ code: '23505' })
      await client.query('rollback')
      expect((await client.query('select count(*)::text as n from dpg_app.products')).rows[0].n).toBe('0')
      expect((await client.query('select last_value::text,is_called from dpg_app.products_id_seq')).rows[0])
        .toEqual({ last_value: '1', is_called: false })
      await client.query('begin')
      for (const table of CATALOGUE_RESTORE_ORDER) {
        await client.query(insertSql(table, columns.get(table)), ['[' + source.get(table).join(',') + ']'])
        expect((await client.query(rowsSql('dpg_app', table))).rows.map((r) => r.row_text)).toEqual(source.get(table))
        await client.query('select dpg_app.direct_catalogue_restart($1,$2,2)', [table, 'id'])
      }
      await client.query('commit')
      await expect(client.query('delete from dpg_app.products')).rejects.toMatchObject({ code: '42501' })
      await expect(client.query("select dpg_app.direct_catalogue_restart('admin_sessions','id',2)")).rejects.toMatchObject({ code: 'P0001' })
      await expect(client.query("select dpg_app.direct_catalogue_restart('products','id',1)")).rejects.toMatchObject({ code: 'P0001' })
      await client.query('reset session authorization')
      await expect(client.query("select dpg_app.direct_catalogue_restart('products','id',2)")).rejects.toMatchObject({ code: 'P0001' })
      await expect(client.query(parity)).rejects.toMatchObject({ code: 'P0001' })
    } finally {
      if (client) { try { await client.query('rollback'); await client.query('reset session authorization') } catch { /* fixture cleanup */ } await client.end() }
      await admin.query(`drop database if exists ${database} with (force)`)
      if (createdRole) await admin.query('revoke connect on database postgres from dpg_direct_import; drop role dpg_direct_import')
      if (createdGuest) await admin.query(`drop role ${guest}`)
      await admin.end()
    }
  }, 90000)
})
